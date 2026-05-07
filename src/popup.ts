import type {
  AutomationEnabledResponse,
  ChannelPreference,
  DiagnosticsResponse,
  DiagnosticsState,
  FlowTubeSettings,
  RuntimeMessage,
  SettingsResponse,
  YouTubeTabsResponseMessage
} from "./types";

const statusText = query<HTMLElement>("#status");
const temporaryStatus = query<HTMLElement>("#temporary-status");
const automationToggle = query<HTMLInputElement>("#automation-toggle");
const triggerMode = query<HTMLSelectElement>("#trigger-mode");
const workTabBehavior = query<HTMLSelectElement>("#work-tab-behavior");
const pauseOnPlay = query<HTMLInputElement>("#pause-on-play");
const pauseOnReturn = query<HTMLInputElement>("#pause-on-return");
const preventMultiple = query<HTMLInputElement>("#prevent-multiple");
const meetingProtection = query<HTMLInputElement>("#meeting-protection");
const pauseOnMeeting = query<HTMLInputElement>("#pause-on-meeting");
const musicDetection = query<HTMLSelectElement>("#music-detection");
const startDelay = query<HTMLSelectElement>("#start-delay");
const openDefaultMusic = query<HTMLInputElement>("#open-default-music");
const defaultMusicUrl = query<HTMLElement>("#default-music-url");
const toggleNowButton = query<HTMLButtonElement>("#toggle-now");
const undoButton = query<HTMLButtonElement>("#undo-action");
const pauseAllButton = query<HTMLButtonElement>("#pause-all");
const pauseOthersButton = query<HTMLButtonElement>("#pause-others");
const detectTabsButton = query<HTMLButtonElement>("#detect-tabs");
const shortcutSettingsButton = query<HTMLButtonElement>("#shortcut-settings");
const refreshDiagnosticsButton = query<HTMLButtonElement>("#refresh-diagnostics");
const clearErrorButton = query<HTMLButtonElement>("#clear-error");
const openMusicTabButton = query<HTMLButtonElement>("#open-music-tab");
const clearOverridesButton = query<HTMLButtonElement>("#clear-overrides");
const clearDefaultMusicButton = query<HTMLButtonElement>("#clear-default-music");
const workSiteInput = query<HTMLInputElement>("#work-site-input");
const addWorkSiteButton = query<HTMLButtonElement>("#add-work-site");
const resetWorkSitesButton = query<HTMLButtonElement>("#reset-work-sites");
const clearChannelPreferencesButton = query<HTMLButtonElement>("#clear-channel-preferences");
const diagnosticsList = query<HTMLDListElement>("#diagnostics");
const playingTabs = query<HTMLUListElement>("#playing-tabs");
const tabsList = query<HTMLUListElement>("#tabs-list");
const workSitesList = query<HTMLUListElement>("#work-sites-list");
const channelPreferencesList = query<HTMLUListElement>("#channel-preferences-list");

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing popup element: ${selector}`);
  return element;
}

function sendMessage<TResponse>(message: RuntimeMessage): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: TResponse) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(response);
    });
  });
}

function applySettings(settings: FlowTubeSettings): void {
  automationToggle.checked = settings.automationEnabled;
  triggerMode.value = settings.triggerMode;
  workTabBehavior.value = settings.workTabBehavior;
  pauseOnPlay.checked = settings.pauseMusicOnTutorialPlay;
  pauseOnReturn.checked = settings.pauseMusicOnTutorialReturn;
  preventMultiple.checked = settings.preventMultipleYouTubeTabs;
  meetingProtection.checked = settings.meetingProtectionEnabled;
  pauseOnMeeting.checked = settings.pauseMusicOnMeetingTab;
  musicDetection.value = settings.musicDetectionSensitivity;
  startDelay.value = String(settings.startMusicDelayMs);
  openDefaultMusic.checked = settings.openDefaultMusicWhenMissing;
  defaultMusicUrl.textContent = settings.defaultMusicUrl ? `Default: ${settings.defaultMusicUrl}` : "No default music source set.";
  statusText.textContent = settings.automationEnabled ? "Automation is ON" : "Automation is OFF";
  temporaryStatus.textContent = getTemporaryDisableText(settings);
  renderWorkSites(settings.customWorkSites);
}

async function loadSettings(): Promise<void> {
  const response = await sendMessage<SettingsResponse>({ type: "GET_SETTINGS" });
  applySettings(response.settings);
}

async function savePartialSettings(settings: Partial<FlowTubeSettings>): Promise<void> {
  const response = await sendMessage<SettingsResponse>({ type: "SET_SETTINGS", settings });
  applySettings(response.settings);
}

async function refreshEverything(): Promise<void> {
  await loadSettings();
  await refreshDiagnostics();
  await detectYouTubeTabs();
}

function renderTabs(response: YouTubeTabsResponseMessage): void {
  tabsList.replaceChildren();
  renderChannelPreferences(response.channelPreferences);

  if (response.tabs.length === 0) {
    appendTextItem(tabsList, "No open YouTube tabs found.");
    return;
  }

  for (const tab of response.tabs) {
    const item = document.createElement("li");
    item.className = "tab-item";

    const title = div("tab-title", tab.title);
    const metaParts = [`${tab.scoreResult.detectedType} | score ${tab.score}`];
    if (tab.channelName) metaParts.push(`channel: ${tab.channelName}`);
    if (response.overrides.manualMusicTabId === tab.tabId) metaParts.push("manual music");
    if (response.overrides.manualTutorialTabId === tab.tabId) metaParts.push("manual tutorial");
    if (response.overrides.ignoredTabIds.includes(tab.tabId)) metaParts.push("ignored tab");

    const meta = div("tab-meta", metaParts.join(" | "));
    const reasons = div(
      "tab-reasons",
      tab.scoreResult.reasons.length > 0 ? tab.scoreResult.reasons.join(", ") : "No score signals"
    );
    const url = div("tab-url", tab.url);
    const actions = document.createElement("div");
    actions.className = "mini-actions";

    actions.append(
      actionButton("Use as music", () => setManualTabRole(tab.tabId, "music")),
      actionButton("Use as tutorial", () => setManualTabRole(tab.tabId, "tutorial")),
      actionButton("Ignore", () => setManualTabRole(tab.tabId, "ignored")),
      actionButton("Set default", () => setDefaultMusic(tab.tabId))
    );

    if (tab.channelName) {
      actions.append(
        actionButton("Always music", () => setChannelPreference(tab.channelName!, "music")),
        actionButton("Always tutorial", () => setChannelPreference(tab.channelName!, "tutorial")),
        actionButton("Ignore channel", () => setChannelPreference(tab.channelName!, "ignored"))
      );
    }

    item.append(title, meta, reasons, url, actions);
    tabsList.append(item);
  }
}

function renderDiagnostics(diagnostics: DiagnosticsState): void {
  diagnosticsList.replaceChildren();
  addDiagnostic("Automation", diagnostics.automationActive ? "Active" : diagnostics.automationEnabled ? "Temporarily off" : "Off");
  addDiagnostic("Last action", diagnostics.lastAction?.message ?? "None");
  addDiagnostic("Last error", diagnostics.lastError ? `${diagnostics.lastError.type}: ${diagnostics.lastError.message}` : "None");
  addDiagnostic("Tutorial tab", diagnostics.tutorialTab?.title ?? "None");
  addDiagnostic("Music tab", diagnostics.musicTab?.title ?? "None");
  addDiagnostic("YouTube tabs", String(diagnostics.youtubeTabCount));
  addDiagnostic("Shortcut", "Alt + Shift + F");
  undoButton.disabled = !diagnostics.undoAvailable;
  openMusicTabButton.disabled = !diagnostics.lastError?.tabId && !diagnostics.musicTab?.tabId;
  renderPlayingTabs(diagnostics.playingTabs);
}

function renderWorkSites(sites: string[]): void {
  workSitesList.replaceChildren();

  if (sites.length === 0) {
    appendTextItem(workSitesList, "No custom work sites.");
    return;
  }

  for (const site of sites) {
    const item = document.createElement("li");
    item.className = "list-row";
    item.append(document.createTextNode(site), actionButton("Remove", () => removeWorkSite(site)));
    workSitesList.append(item);
  }
}

function renderChannelPreferences(preferences: Record<string, ChannelPreference>): void {
  channelPreferencesList.replaceChildren();
  const entries = Object.entries(preferences);

  if (entries.length === 0) {
    appendTextItem(channelPreferencesList, "No saved channel preferences.");
    return;
  }

  for (const [channelName, preference] of entries) {
    const item = document.createElement("li");
    item.className = "list-row";
    item.append(document.createTextNode(`${channelName}: ${preference}`), actionButton("Remove", () => removeChannelPreference(channelName)));
    channelPreferencesList.append(item);
  }
}

function renderPlayingTabs(tabs: YouTubeTabsResponseMessage["tabs"]): void {
  playingTabs.replaceChildren();

  if (tabs.length === 0) {
    appendTextItem(playingTabs, "No playing YouTube tabs detected.");
    return;
  }

  for (const tab of tabs) {
    const item = document.createElement("li");
    item.className = "tab-item";
    item.append(div("tab-title", tab.title), div("tab-url", tab.url));
    playingTabs.append(item);
  }
}

function addDiagnostic(label: string, value: string): void {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  diagnosticsList.append(dt, dd);
}

function div(className: string, text: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  return element;
}

function actionButton(text: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mini-button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function appendTextItem(list: HTMLUListElement, text: string): void {
  const item = document.createElement("li");
  item.className = "empty";
  item.textContent = text;
  list.append(item);
}

function getTemporaryDisableText(settings: FlowTubeSettings): string {
  if (settings.disabledUntil === "browser_restart") return "Temporarily disabled until browser restart.";
  if (typeof settings.disabledUntil === "number" && settings.disabledUntil > Date.now()) {
    return `Temporarily disabled until ${new Date(settings.disabledUntil).toLocaleTimeString()}.`;
  }
  return "";
}

async function detectYouTubeTabs(): Promise<void> {
  const response = await sendMessage<YouTubeTabsResponseMessage>({ type: "GET_YOUTUBE_TABS" });
  renderTabs(response);
}

async function refreshDiagnostics(): Promise<void> {
  const response = await sendMessage<DiagnosticsResponse>({ type: "GET_DIAGNOSTICS" });
  renderDiagnostics(response.diagnostics);
}

function setManualTabRole(tabId: number, role: "music" | "tutorial" | "ignored"): void {
  sendMessage({ type: "SET_MANUAL_TAB_ROLE", tabId, role }).then(refreshEverything).catch(() => undefined);
}

function setChannelPreference(channelName: string, preference: ChannelPreference): void {
  sendMessage({ type: "SET_CHANNEL_PREFERENCE", channelName, preference }).then(refreshEverything).catch(() => undefined);
}

function removeChannelPreference(channelName: string): void {
  sendMessage({ type: "REMOVE_CHANNEL_PREFERENCE", channelName }).then(refreshEverything).catch(() => undefined);
}

function setDefaultMusic(tabId: number): void {
  sendMessage({ type: "SET_DEFAULT_MUSIC_TAB", tabId }).then(refreshEverything).catch(() => undefined);
}

function removeWorkSite(site: string): void {
  sendMessage<SettingsResponse>({ type: "REMOVE_CUSTOM_WORK_SITE", site })
    .then((response) => applySettings(response.settings))
    .catch(() => undefined);
}

automationToggle.addEventListener("change", () => {
  sendMessage<AutomationEnabledResponse>({ type: "SET_AUTOMATION_ENABLED", enabled: automationToggle.checked })
    .then((response) => {
      statusText.textContent = response.enabled ? "Automation is ON" : "Automation is OFF";
      return refreshDiagnostics();
    })
    .catch(() => {
      automationToggle.checked = !automationToggle.checked;
    });
});

triggerMode.addEventListener("change", () => {
  savePartialSettings({ triggerMode: triggerMode.value as FlowTubeSettings["triggerMode"] }).catch(() => undefined);
});
workTabBehavior.addEventListener("change", () => {
  savePartialSettings({ workTabBehavior: workTabBehavior.value as FlowTubeSettings["workTabBehavior"] }).catch(() => undefined);
});
pauseOnPlay.addEventListener("change", () => {
  savePartialSettings({ pauseMusicOnTutorialPlay: pauseOnPlay.checked }).catch(() => undefined);
});
pauseOnReturn.addEventListener("change", () => {
  savePartialSettings({ pauseMusicOnTutorialReturn: pauseOnReturn.checked }).catch(() => undefined);
});
preventMultiple.addEventListener("change", () => {
  savePartialSettings({ preventMultipleYouTubeTabs: preventMultiple.checked }).catch(() => undefined);
});
meetingProtection.addEventListener("change", () => {
  savePartialSettings({ meetingProtectionEnabled: meetingProtection.checked }).catch(() => undefined);
});
pauseOnMeeting.addEventListener("change", () => {
  savePartialSettings({ pauseMusicOnMeetingTab: pauseOnMeeting.checked }).catch(() => undefined);
});
musicDetection.addEventListener("change", () => {
  savePartialSettings({ musicDetectionSensitivity: musicDetection.value as FlowTubeSettings["musicDetectionSensitivity"] }).catch(
    () => undefined
  );
});
startDelay.addEventListener("change", () => {
  savePartialSettings({ startMusicDelayMs: Number(startDelay.value) }).catch(() => undefined);
});
openDefaultMusic.addEventListener("change", () => {
  savePartialSettings({ openDefaultMusicWhenMissing: openDefaultMusic.checked }).catch(() => undefined);
});

toggleNowButton.addEventListener("click", () => {
  sendMessage({ type: "RUN_TOGGLE_ACTION" }).then(refreshEverything).catch(() => undefined);
});
undoButton.addEventListener("click", () => {
  sendMessage({ type: "UNDO_LAST_ACTION" }).then(refreshEverything).catch(() => undefined);
});
pauseAllButton.addEventListener("click", () => {
  sendMessage({ type: "PAUSE_ALL_YOUTUBE" }).then(refreshEverything).catch(() => undefined);
});
pauseOthersButton.addEventListener("click", () => {
  sendMessage({ type: "PAUSE_OTHER_YOUTUBE" }).then(refreshEverything).catch(() => undefined);
});
detectTabsButton.addEventListener("click", () => {
  detectTabsButton.disabled = true;
  detectYouTubeTabs()
    .finally(() => {
      detectTabsButton.disabled = false;
    })
    .catch(() => undefined);
});
shortcutSettingsButton.addEventListener("click", () => {
  sendMessage({ type: "OPEN_SHORTCUT_SETTINGS" }).catch(() => undefined);
});
refreshDiagnosticsButton.addEventListener("click", () => {
  refreshDiagnostics().catch(() => undefined);
});
clearErrorButton.addEventListener("click", () => {
  sendMessage({ type: "CLEAR_LAST_ERROR" }).then(refreshDiagnostics).catch(() => undefined);
});
openMusicTabButton.addEventListener("click", () => {
  sendMessage({ type: "OPEN_MUSIC_TAB" }).catch(() => undefined);
});
clearOverridesButton.addEventListener("click", () => {
  sendMessage({ type: "CLEAR_MANUAL_OVERRIDES" }).then(refreshEverything).catch(() => undefined);
});
clearDefaultMusicButton.addEventListener("click", () => {
  sendMessage({ type: "CLEAR_DEFAULT_MUSIC" }).then(refreshEverything).catch(() => undefined);
});
addWorkSiteButton.addEventListener("click", () => {
  sendMessage<SettingsResponse>({ type: "ADD_CUSTOM_WORK_SITE", site: workSiteInput.value })
    .then((response) => {
      workSiteInput.value = "";
      applySettings(response.settings);
    })
    .catch(() => undefined);
});
resetWorkSitesButton.addEventListener("click", () => {
  sendMessage<SettingsResponse>({ type: "RESET_CUSTOM_WORK_SITES" })
    .then((response) => applySettings(response.settings))
    .catch(() => undefined);
});
clearChannelPreferencesButton.addEventListener("click", () => {
  sendMessage({ type: "CLEAR_CHANNEL_PREFERENCES" }).then(refreshEverything).catch(() => undefined);
});

query<HTMLButtonElement>("#disable-15").addEventListener("click", () => {
  sendMessage<SettingsResponse>({ type: "DISABLE_TEMPORARILY", duration: 15 }).then((response) => applySettings(response.settings));
});
query<HTMLButtonElement>("#disable-60").addEventListener("click", () => {
  sendMessage<SettingsResponse>({ type: "DISABLE_TEMPORARILY", duration: 60 }).then((response) => applySettings(response.settings));
});
query<HTMLButtonElement>("#disable-restart").addEventListener("click", () => {
  sendMessage<SettingsResponse>({ type: "DISABLE_TEMPORARILY", duration: "browser_restart" }).then((response) =>
    applySettings(response.settings)
  );
});
query<HTMLButtonElement>("#re-enable").addEventListener("click", () => {
  sendMessage<SettingsResponse>({ type: "RE_ENABLE_NOW" }).then((response) => applySettings(response.settings));
});

refreshEverything().catch(() => undefined);
