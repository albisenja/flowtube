import type {
  AutomationEnabledResponse,
  BasicResponse,
  ChannelPreference,
  DiagnosticsResponse,
  DiagnosticsState,
  FlowTubeSettings,
  LastError,
  ManualOverrides,
  RuntimeMessage,
  SettingsResponse,
  TabSummary,
  VideoEventMessage,
  VideoEventType,
  VideoStateResponseMessage,
  YouTubeTabInfo,
  YouTubeTabsResponseMessage
} from "./types";
import {
  getChannelPreferences,
  getManualOverrides,
  getSettings,
  getStoredDiagnostics,
  getUndoAction,
  isAutomationCurrentlyActive,
  normalizeWorkSites,
  resetManualOverrides,
  saveChannelPreferences,
  saveLastAction,
  saveLastError,
  saveManualOverrides,
  saveSettings,
  saveUndoAction
} from "./utils/storage";
import { isMeetingUrl, isWorkUrl, isYouTubeUrl, normalizeWorkSite } from "./utils/workSites";
import { queryYouTubeTabs, sendMessageToTab } from "./utils/youtube";

const SUPPRESS_MS = 5000;
const DEFAULT_MUSIC_OPEN_GUARD_MS = 30000;
const UNDO_EXPIRES_MS = 60000;

let lastTutorialTabId: number | null = null;
let currentMusicTabId: number | null = null;
let lastActiveTabId: number | null = null;
let pendingStartMusicTimeout: ReturnType<typeof setTimeout> | null = null;
let lastDefaultMusicOpenAt = 0;

const suppressedEvents = new Map<number, Map<VideoEventType, number>>();

chrome.runtime.onInstalled.addListener(() => {
  getSettings().catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  clearBrowserRestartDisable().catch(() => undefined);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (lastTutorialTabId === tabId) lastTutorialTabId = null;
  if (currentMusicTabId === tabId) currentMusicTabId = null;
  if (lastActiveTabId === tabId) lastActiveTabId = null;
  suppressedEvents.delete(tabId);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  handleTabActivated(activeInfo.tabId).catch(() => undefined);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-flowtube") {
    handleFlowTubeToggle().catch(() => undefined);
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (message.type === "GET_AUTOMATION_ENABLED") {
    getAutomationEnabledResponse().then(sendResponse);
    return true;
  }

  if (message.type === "SET_AUTOMATION_ENABLED") {
    saveSettings({ automationEnabled: message.enabled, disabledUntil: undefined }).then((settings) => {
      sendResponse(toAutomationEnabledResponse(settings));
    });
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    getSettings().then((settings) => {
      const response: SettingsResponse = { type: "SETTINGS_RESPONSE", settings };
      sendResponse(response);
    });
    return true;
  }

  if (message.type === "SET_SETTINGS") {
    saveSettings(message.settings).then((settings) => {
      const response: SettingsResponse = { type: "SETTINGS_RESPONSE", settings };
      sendResponse(response);
    });
    return true;
  }

  if (message.type === "GET_YOUTUBE_TABS") {
    getYouTubeTabsResponse().then(sendResponse);
    return true;
  }

  if (message.type === "RUN_TOGGLE_ACTION") {
    handleFlowTubeToggle().then(sendResponse);
    return true;
  }

  if (message.type === "OPEN_SHORTCUT_SETTINGS") {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "SET_MANUAL_TAB_ROLE") {
    setManualTabRole(message.tabId, message.role).then(sendResponse);
    return true;
  }

  if (message.type === "CLEAR_MANUAL_OVERRIDES") {
    resetManualOverrides().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "SET_CHANNEL_PREFERENCE") {
    setChannelPreference(message.channelName, message.preference).then(sendResponse);
    return true;
  }

  if (message.type === "REMOVE_CHANNEL_PREFERENCE") {
    removeChannelPreference(message.channelName).then(sendResponse);
    return true;
  }

  if (message.type === "CLEAR_CHANNEL_PREFERENCES") {
    saveChannelPreferences({}).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "ADD_CUSTOM_WORK_SITE") {
    addCustomWorkSite(message.site).then((settings) => sendResponse({ type: "SETTINGS_RESPONSE", settings }));
    return true;
  }

  if (message.type === "REMOVE_CUSTOM_WORK_SITE") {
    removeCustomWorkSite(message.site).then((settings) => sendResponse({ type: "SETTINGS_RESPONSE", settings }));
    return true;
  }

  if (message.type === "RESET_CUSTOM_WORK_SITES") {
    saveSettings({ customWorkSites: [] }).then((settings) => sendResponse({ type: "SETTINGS_RESPONSE", settings }));
    return true;
  }

  if (message.type === "SET_DEFAULT_MUSIC_TAB") {
    setDefaultMusicTab(message.tabId).then(sendResponse);
    return true;
  }

  if (message.type === "CLEAR_DEFAULT_MUSIC") {
    saveSettings({ defaultMusicUrl: undefined }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "DISABLE_TEMPORARILY") {
    disableTemporarily(message.duration).then((settings) => sendResponse({ type: "SETTINGS_RESPONSE", settings }));
    return true;
  }

  if (message.type === "RE_ENABLE_NOW") {
    saveSettings({ disabledUntil: undefined }).then((settings) => sendResponse({ type: "SETTINGS_RESPONSE", settings }));
    return true;
  }

  if (message.type === "GET_DIAGNOSTICS") {
    buildDiagnostics().then((diagnostics) => {
      const response: DiagnosticsResponse = { type: "DIAGNOSTICS_RESPONSE", diagnostics };
      sendResponse(response);
    });
    return true;
  }

  if (message.type === "CLEAR_LAST_ERROR") {
    saveLastError(undefined).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "OPEN_MUSIC_TAB") {
    openMusicTabForRecovery().then(sendResponse);
    return true;
  }

  if (message.type === "PAUSE_ALL_YOUTUBE") {
    pauseAllYouTubeTabs().then(sendResponse);
    return true;
  }

  if (message.type === "PAUSE_OTHER_YOUTUBE") {
    pauseOtherFromActiveTab().then(sendResponse);
    return true;
  }

  if (message.type === "UNDO_LAST_ACTION") {
    undoLastAction().then(sendResponse);
    return true;
  }

  if (isVideoEvent(message)) {
    const tabId = sender.tab?.id;

    if (typeof tabId !== "number" || isSuppressed(tabId, message.type)) {
      return false;
    }

    handleVideoEvent(tabId, message).catch(() => undefined);
    return false;
  }

  return false;
});

async function handleVideoEvent(tabId: number, message: VideoEventMessage): Promise<void> {
  const settings = await getSettings();
  lastActiveTabId = tabId;

  if (!isAutomationCurrentlyActive(settings)) {
    return;
  }

  const overrides = await getManualOverrides();

  if (overrides.manualMusicTabId === tabId || overrides.ignoredTabIds.includes(tabId)) {
    return;
  }

  if (message.type === "VIDEO_PAUSE" || message.type === "VIDEO_ENDED") {
    if (settings.triggerMode === "pause-only" || settings.triggerMode === "both") {
      lastTutorialTabId = (await getValidManualTutorialTabId(overrides)) ?? tabId;
      scheduleStartMusic(tabId, settings, "FlowTube started music");
      await recordAction("tutorial_pause", "Tutorial paused or ended; queued music");
    }

    return;
  }

  if (message.type === "VIDEO_PLAY") {
    if (tabId !== currentMusicTabId) {
      lastTutorialTabId = (await getValidManualTutorialTabId(overrides)) ?? tabId;
    }

    const pausedIds: number[] = [];

    if (settings.pauseMusicOnTutorialPlay && currentMusicTabId !== null && currentMusicTabId !== tabId) {
      if ((await pauseTab(currentMusicTabId))?.ok) pausedIds.push(currentMusicTabId);
    }

    if (settings.preventMultipleYouTubeTabs) {
      pausedIds.push(...(await pauseOtherYouTubeTabs(tabId)));
    }

    if (pausedIds.length > 0) {
      await saveUndoAction({ pausedTabIds: pausedIds, timestamp: Date.now() });
      await recordAction("tutorial_play", "Tutorial started; paused other YouTube tabs");
    }
  }
}

async function handleTabActivated(tabId: number): Promise<void> {
  const previousTabId = lastActiveTabId;
  lastActiveTabId = tabId;

  const settings = await getSettings();

  if (!isAutomationCurrentlyActive(settings)) {
    return;
  }

  const activeTab = await getTab(tabId);
  const activeUrl = activeTab?.url ?? "";

  if (settings.meetingProtectionEnabled && isMeetingUrl(activeUrl)) {
    clearPendingStartMusic();

    if (settings.pauseMusicOnMeetingTab && currentMusicTabId !== null) {
      await pauseTab(currentMusicTabId);
      await recordAction("meeting_protection", "Meeting tab active; paused music");
    }

    return;
  }

  const tutorialTabId = await getEffectiveTutorialTabId();

  if (tabId === tutorialTabId) {
    if (settings.pauseMusicOnTutorialReturn && currentMusicTabId !== null && currentMusicTabId !== tabId) {
      await pauseTab(currentMusicTabId);
      await recordAction("tutorial_return", "Returned to tutorial; paused music");
    }

    return;
  }

  if (settings.workTabBehavior === "disabled") {
    return;
  }

  if (previousTabId === null || previousTabId !== tutorialTabId) {
    return;
  }

  if (settings.triggerMode !== "leave-only" && settings.triggerMode !== "both") {
    return;
  }

  if (isWorkTrigger(activeUrl, settings)) {
    scheduleStartMusic(previousTabId, settings, "FlowTube started focus music");
    await recordAction("left_tutorial", "Left tutorial for work tab; queued music");
  }
}

async function handleFlowTubeToggle(): Promise<BasicResponse> {
  const settings = await getSettings();
  const activeTab = await getActiveTab();
  const activeTabId = activeTab?.id;
  const activeUrl = activeTab?.url ?? "";
  const playingMusicTabId = await findPlayingMusicTabId(settings);

  if (playingMusicTabId !== null) {
    currentMusicTabId = playingMusicTabId;
    await pauseTab(playingMusicTabId);
    await focusTutorialTab();
    await recordAction("manual_toggle", "Shortcut paused music and focused tutorial");
    return { ok: true };
  }

  if (typeof activeTabId === "number" && isYouTubeUrl(activeUrl) && activeTabId !== currentMusicTabId) {
    lastTutorialTabId = activeTabId;
    await pauseTab(activeTabId);
    await startMusic(activeTabId, settings, "FlowTube started music");
    await recordAction("manual_toggle", "Shortcut paused tutorial and started music");
    return { ok: true };
  }

  await startMusic(lastTutorialTabId ?? activeTabId ?? null, settings, "FlowTube started music");
  await recordAction("manual_toggle", "Shortcut started music");
  return { ok: true };
}

function scheduleStartMusic(sourceTabId: number, settings: FlowTubeSettings, toastText: string): void {
  clearPendingStartMusic();
  pendingStartMusicTimeout = setTimeout(() => {
    pendingStartMusicTimeout = null;
    startMusic(sourceTabId, settings, toastText).catch(() => undefined);
  }, settings.startMusicDelayMs);
}

async function startMusic(sourceTabId: number | null, settings: FlowTubeSettings, toastText: string): Promise<void> {
  clearPendingStartMusic();

  const musicTab = await findBestMusicTab(sourceTabId, settings);

  if (!musicTab) {
    await openDefaultMusicIfPossible(sourceTabId, settings, toastText);
    return;
  }

  const pausedTabIds = settings.preventMultipleYouTubeTabs ? await pauseOtherYouTubeTabs(musicTab.tabId) : [];
  const response = await playTab(musicTab.tabId);

  if (response?.ok) {
    currentMusicTabId = musicTab.tabId;
    await saveSettings({ lastMusicUrl: musicTab.url });
    await saveUndoAction({
      startedMusicTabId: musicTab.tabId,
      pausedTabIds,
      timestamp: Date.now()
    });
    await recordAction("started_music", `Started music: ${musicTab.title}`);

    if (settings.showToast) {
      await showToast(musicTab.tabId, toastText);
    }

    return;
  }

  await handlePlayFailure(musicTab.tabId, response, "Could not autoplay detected music tab");
}

async function findBestMusicTab(
  excludedTabId: number | null,
  settings: FlowTubeSettings
): Promise<YouTubeTabInfo | null> {
  const channelPreferences = await getChannelPreferences();
  const overrides = await getManualOverrides();
  const tabs = await queryYouTubeTabs(channelPreferences);
  const ignoredIds = new Set(overrides.ignoredTabIds);

  if (typeof overrides.manualMusicTabId === "number" && !ignoredIds.has(overrides.manualMusicTabId)) {
    const manualTab = tabs.find((tab) => tab.tabId === overrides.manualMusicTabId);

    if (manualTab && manualTab.tabId !== excludedTabId && manualTab.scoreResult.detectedType !== "tutorial") {
      return manualTab;
    }
  }

  const otherTabs = tabs.filter((tab) => {
    if (tab.tabId === excludedTabId) return false;
    if (ignoredIds.has(tab.tabId)) return false;
    if (tab.scoreResult.reasons.includes("Channel ignored")) return false;
    return true;
  });
  const threshold = getMusicThreshold(settings);
  const candidates = otherTabs.filter((tab) => tab.score >= threshold).sort((a, b) => b.score - a.score);

  if (candidates[0]) {
    return candidates[0];
  }

  return otherTabs.length === 1 ? otherTabs[0] : null;
}

async function openDefaultMusicIfPossible(
  sourceTabId: number | null,
  settings: FlowTubeSettings,
  toastText: string
): Promise<void> {
  if (!settings.openDefaultMusicWhenMissing || !settings.defaultMusicUrl) {
    await recordAction("music_missing", "No music tab found");
    await recordError("no_music_tab", "No music tab found. Use Detect YouTube tabs, set a manual music tab, or set a default music source.");
    return;
  }

  if (Date.now() - lastDefaultMusicOpenAt < DEFAULT_MUSIC_OPEN_GUARD_MS) {
    await recordAction("music_missing", "Default music open skipped to avoid duplicate tabs");
    await recordError("no_music_tab", "No open music tab found, and FlowTube skipped opening another default tab to avoid duplicates.");
    return;
  }

  lastDefaultMusicOpenAt = Date.now();
  const createdTab = await createBackgroundTab(settings.defaultMusicUrl);

  if (!createdTab?.id) {
    await recordError("tab_unreachable", "Could not open default music tab");
    return;
  }

  await waitForTabLoad(createdTab.id);

  if (settings.preventMultipleYouTubeTabs) {
    await pauseOtherYouTubeTabs(createdTab.id);
  }

  const response = await playTab(createdTab.id);

  if (response?.ok) {
    currentMusicTabId = createdTab.id;
    await saveSettings({ lastMusicUrl: settings.defaultMusicUrl });
    await saveUndoAction({
      startedMusicTabId: createdTab.id,
      pausedTabIds: sourceTabId ? [sourceTabId] : [],
      timestamp: Date.now()
    });
    await recordAction("started_default_music", "Opened and started default music source");

    if (settings.showToast) {
      await showToast(createdTab.id, toastText);
    }

    return;
  }

  await handlePlayFailure(createdTab.id, response, "Could not autoplay default music source");
}

async function pauseOtherYouTubeTabs(allowedTabId: number, secondAllowedTabId: number | null = null): Promise<number[]> {
  const tabs = await queryYouTubeTabs(await getChannelPreferences());
  const targets = tabs.filter((tab) => tab.tabId !== allowedTabId && tab.tabId !== secondAllowedTabId);
  const pausedIds: number[] = [];

  for (const tab of targets) {
    const response = await pauseTab(tab.tabId);
    if (response?.ok) pausedIds.push(tab.tabId);
  }

  return pausedIds;
}

async function pauseAllYouTubeTabs(): Promise<BasicResponse> {
  const tabs = await queryYouTubeTabs(await getChannelPreferences());
  const pausedIds: number[] = [];

  for (const tab of tabs) {
    const response = await pauseTab(tab.tabId);
    if (response?.ok) pausedIds.push(tab.tabId);
  }

  await saveUndoAction({ pausedTabIds: pausedIds, timestamp: Date.now() });
  await recordAction("pause_all", "Paused all YouTube tabs");
  return { ok: true };
}

async function pauseOtherFromActiveTab(): Promise<BasicResponse> {
  const activeTab = await getActiveTab();
  const allowedTabId = activeTab?.id;

  if (typeof allowedTabId !== "number") {
    return { ok: false, error: "No active tab found." };
  }

  const pausedIds = await pauseOtherYouTubeTabs(allowedTabId);
  await saveUndoAction({ pausedTabIds: pausedIds, timestamp: Date.now() });
  await recordAction("pause_others", "Paused other YouTube tabs");
  return { ok: true };
}

async function undoLastAction(): Promise<BasicResponse> {
  const undo = await getUndoAction();

  if (!undo || Date.now() - undo.timestamp > UNDO_EXPIRES_MS) {
    await saveUndoAction(undefined);
    return { ok: false, error: "No recent action to undo." };
  }

  if (typeof undo.startedMusicTabId === "number") {
    await pauseTab(undo.startedMusicTabId);
  }

  if (typeof undo.focusedTabId === "number") {
    chrome.tabs.update(undo.focusedTabId, { active: true }, () => {
      void chrome.runtime.lastError;
    });
  }

  await saveUndoAction(undefined);
  await recordAction("undo", "Undid last FlowTube action");
  return { ok: true };
}

async function playTab(tabId: number): Promise<BasicResponse | null> {
  suppressEvent(tabId, "VIDEO_PLAY");
  return sendMessageToTab<BasicResponse>(tabId, { type: "PLAY_VIDEO" });
}

async function pauseTab(tabId: number): Promise<BasicResponse | null> {
  suppressEvent(tabId, "VIDEO_PAUSE");
  return sendMessageToTab<BasicResponse>(tabId, { type: "PAUSE_VIDEO" });
}

async function showToast(tabId: number, text: string): Promise<void> {
  await sendMessageToTab<BasicResponse>(tabId, { type: "SHOW_TOAST", text });
}

async function isTabPlaying(tabId: number): Promise<boolean> {
  const response = await sendMessageToTab<VideoStateResponseMessage>(tabId, { type: "GET_VIDEO_STATE" });
  return Boolean(response?.ok && response.state.exists && !response.state.paused && !response.state.ended);
}

async function findPlayingMusicTabId(settings: FlowTubeSettings): Promise<number | null> {
  if (currentMusicTabId !== null && (await isTabPlaying(currentMusicTabId))) {
    return currentMusicTabId;
  }

  const threshold = getMusicThreshold(settings);
  const overrides = await getManualOverrides();
  const musicCandidates = (await queryYouTubeTabs(await getChannelPreferences()))
    .filter((tab) => tab.score >= threshold && !overrides.ignoredTabIds.includes(tab.tabId))
    .sort((a, b) => b.score - a.score);

  for (const tab of musicCandidates) {
    if (await isTabPlaying(tab.tabId)) {
      return tab.tabId;
    }
  }

  return null;
}

async function focusTutorialTab(): Promise<void> {
  const tutorialTabId = await getEffectiveTutorialTabId();

  if (tutorialTabId === null) {
    return;
  }

  const tab = await getTab(tutorialTabId);

  if (!tab) {
    return;
  }

  chrome.tabs.update(tutorialTabId, { active: true }, () => {
    void chrome.runtime.lastError;
  });
}

async function getEffectiveTutorialTabId(): Promise<number | null> {
  return (await getValidManualTutorialTabId(await getManualOverrides())) ?? lastTutorialTabId;
}

async function getValidManualTutorialTabId(overrides: ManualOverrides): Promise<number | null> {
  if (typeof overrides.manualTutorialTabId !== "number") {
    return null;
  }

  return (await getTab(overrides.manualTutorialTabId)) ? overrides.manualTutorialTabId : null;
}

function isWorkTrigger(url: string, settings: FlowTubeSettings): boolean {
  if (settings.meetingProtectionEnabled && isMeetingUrl(url)) {
    return false;
  }

  if (settings.workTabBehavior === "work-only") {
    return isWorkUrl(url, settings.customWorkSites);
  }

  if (settings.workTabBehavior === "any-non-youtube") {
    return Boolean(url) && !isYouTubeUrl(url);
  }

  return false;
}

function getMusicThreshold(settings: FlowTubeSettings): number {
  if (settings.musicDetectionSensitivity === "conservative") return 10;
  if (settings.musicDetectionSensitivity === "aggressive") return 1;
  return 5;
}

function clearPendingStartMusic(): void {
  if (pendingStartMusicTimeout === null) return;
  clearTimeout(pendingStartMusicTimeout);
  pendingStartMusicTimeout = null;
}

async function setManualTabRole(tabId: number, role: "music" | "tutorial" | "ignored"): Promise<BasicResponse> {
  const overrides = await getManualOverrides();
  const ignoredTabIds = overrides.ignoredTabIds.filter((id) => id !== tabId);

  if (role === "music") {
    await saveManualOverrides({ manualMusicTabId: tabId, ignoredTabIds });
  }

  if (role === "tutorial") {
    lastTutorialTabId = tabId;
    await saveManualOverrides({ manualTutorialTabId: tabId, ignoredTabIds });
  }

  if (role === "ignored") {
    await saveManualOverrides({
      manualMusicTabId: overrides.manualMusicTabId === tabId ? undefined : overrides.manualMusicTabId,
      manualTutorialTabId: overrides.manualTutorialTabId === tabId ? undefined : overrides.manualTutorialTabId,
      ignoredTabIds: [...ignoredTabIds, tabId]
    });
  }

  await recordAction("manual_override", `Marked tab ${tabId} as ${role}`);
  return { ok: true };
}

async function setChannelPreference(channelName: string, preference: ChannelPreference): Promise<BasicResponse> {
  const trimmed = channelName.trim();

  if (!trimmed) {
    return { ok: false, error: "Missing channel name." };
  }

  await saveChannelPreferences({
    ...(await getChannelPreferences()),
    [trimmed]: preference
  });
  await recordAction("channel_preference", `Marked channel as ${preference}: ${trimmed}`);
  return { ok: true };
}

async function removeChannelPreference(channelName: string): Promise<BasicResponse> {
  const preferences = await getChannelPreferences();
  delete preferences[channelName];
  await saveChannelPreferences(preferences);
  return { ok: true };
}

async function addCustomWorkSite(site: string): Promise<FlowTubeSettings> {
  const settings = await getSettings();
  const normalized = normalizeWorkSite(site);

  if (!normalized) {
    return settings;
  }

  return saveSettings({ customWorkSites: normalizeWorkSites([...settings.customWorkSites, normalized]) });
}

async function removeCustomWorkSite(site: string): Promise<FlowTubeSettings> {
  const normalized = normalizeWorkSite(site);
  const settings = await getSettings();
  return saveSettings({ customWorkSites: settings.customWorkSites.filter((item) => item !== normalized) });
}

async function setDefaultMusicTab(tabId: number): Promise<BasicResponse> {
  const tab = await getTab(tabId);
  const url = tab?.url;

  if (!url || !isYouTubeUrl(url)) {
    return { ok: false, error: "Selected tab is not a YouTube tab." };
  }

  await saveSettings({ defaultMusicUrl: url });
  await recordAction("default_music", "Set default music source");
  return { ok: true };
}

async function disableTemporarily(duration: 15 | 60 | "browser_restart"): Promise<FlowTubeSettings> {
  const disabledUntil = duration === "browser_restart" ? "browser_restart" : Date.now() + duration * 60 * 1000;
  clearPendingStartMusic();
  await recordAction("temporary_disable", "Temporarily disabled automation");
  return saveSettings({ disabledUntil });
}

async function getYouTubeTabsResponse(): Promise<YouTubeTabsResponseMessage> {
  const channelPreferences = await getChannelPreferences();
  return {
    type: "YOUTUBE_TABS_RESPONSE",
    tabs: await queryYouTubeTabs(channelPreferences),
    overrides: await getManualOverrides(),
    channelPreferences
  };
}

async function buildDiagnostics(): Promise<DiagnosticsState> {
  const settings = await getSettings();
  const stored = await getStoredDiagnostics();
  const channelPreferences = await getChannelPreferences();
  const tabs = await queryYouTubeTabs(channelPreferences);
  const playingTabs = [];

  for (const tab of tabs) {
    if (await isTabPlaying(tab.tabId)) playingTabs.push(tab);
  }

  const undo = await getUndoAction();

  return {
    automationActive: isAutomationCurrentlyActive(settings),
    automationEnabled: settings.automationEnabled,
    temporaryDisableText: getTemporaryDisableText(settings),
    lastAction: stored.lastAction,
    lastError: stored.lastError,
    tutorialTab: await getTabSummary(await getEffectiveTutorialTabId()),
    musicTab: await getTabSummary(currentMusicTabId),
    youtubeTabCount: tabs.length,
    playingTabs,
    undoAvailable: Boolean(undo && Date.now() - undo.timestamp <= UNDO_EXPIRES_MS)
  };
}

async function openMusicTabForRecovery(): Promise<BasicResponse> {
  const diagnostics = await getStoredDiagnostics();
  const tabId = diagnostics.lastError?.tabId ?? currentMusicTabId;

  if (typeof tabId !== "number") {
    return { ok: false, error: "No music tab to open." };
  }

  chrome.tabs.update(tabId, { active: true }, () => {
    void chrome.runtime.lastError;
  });
  return { ok: true };
}

async function handlePlayFailure(
  tabId: number,
  response: BasicResponse | null,
  fallbackMessage: string
): Promise<void> {
  const message = response?.error ?? fallbackMessage;
  const normalizedMessage = message.toLowerCase();
  const type: LastError["type"] =
    response === null
      ? "tab_unreachable"
      : normalizedMessage.includes("play") ||
          normalizedMessage.includes("autoplay") ||
          normalizedMessage.includes("notallowed")
        ? "autoplay_blocked"
        : "unknown";
  await recordError(type, message, tabId);
  await showToast(tabId, "FlowTube couldn't autoplay music. Click this tab once to allow playback.");
}

async function recordAction(type: string, message: string): Promise<void> {
  await saveLastAction({ type, message, timestamp: Date.now() });
}

async function recordError(type: LastError["type"], message: string, tabId?: number): Promise<void> {
  await saveLastError({ type, message, tabId, timestamp: Date.now() });
}

async function clearBrowserRestartDisable(): Promise<void> {
  const settings = await getSettings();

  if (settings.disabledUntil === "browser_restart") {
    await saveSettings({ disabledUntil: undefined });
  }
}

function getTemporaryDisableText(settings: FlowTubeSettings): string | undefined {
  if (settings.disabledUntil === "browser_restart") {
    return "Temporarily disabled until browser restart";
  }

  if (typeof settings.disabledUntil === "number" && settings.disabledUntil > Date.now()) {
    return `Temporarily disabled until ${new Date(settings.disabledUntil).toLocaleTimeString()}`;
  }

  return undefined;
}

async function getTabSummary(tabId: number | null): Promise<TabSummary | undefined> {
  if (tabId === null) return undefined;
  const tab = await getTab(tabId);
  if (!tab?.id) return undefined;

  return {
    tabId: tab.id,
    title: tab.title ?? "Untitled tab",
    url: tab.url ?? ""
  };
}

function getAutomationEnabledResponse(): Promise<AutomationEnabledResponse> {
  return getSettings().then(toAutomationEnabledResponse);
}

function toAutomationEnabledResponse(settings: FlowTubeSettings): AutomationEnabledResponse {
  return {
    type: "AUTOMATION_ENABLED_RESPONSE",
    enabled: settings.automationEnabled
  };
}

function isVideoEvent(message: RuntimeMessage): message is VideoEventMessage {
  return message.type === "VIDEO_PLAY" || message.type === "VIDEO_PAUSE" || message.type === "VIDEO_ENDED";
}

function suppressEvent(tabId: number, eventType: VideoEventType): void {
  const events = suppressedEvents.get(tabId) ?? new Map<VideoEventType, number>();
  events.set(eventType, Date.now() + SUPPRESS_MS);
  suppressedEvents.set(tabId, events);
}

function isSuppressed(tabId: number, eventType: VideoEventType): boolean {
  const events = suppressedEvents.get(tabId);
  const expiresAt = events?.get(eventType);

  if (!events || !expiresAt) return false;

  if (expiresAt < Date.now()) {
    events.delete(eventType);
    return false;
  }

  events.delete(eventType);
  return true;
}

function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(chrome.runtime.lastError ? null : tabs[0] ?? null);
    });
  });
}

function getTab(tabId: number): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      resolve(chrome.runtime.lastError ? null : tab);
    });
  });
}

function createBackgroundTab(url: string): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      resolve(chrome.runtime.lastError ? null : tab);
    });
  });
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(done, 5000);

    function done(): void {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    function listener(updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo): void {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        done();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}
