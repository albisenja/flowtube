import {
  CHANNEL_PREFERENCES_STORAGE_KEY,
  DIAGNOSTICS_STORAGE_KEY,
  MANUAL_OVERRIDES_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  UNDO_STORAGE_KEY,
  type ChannelPreferences,
  type DiagnosticsState,
  type FlowTubeSettings,
  type LastAction,
  type LastError,
  type ManualOverrides,
  type UndoAction
} from "../types";
import { normalizeWorkSite } from "./workSites";

export const DEFAULT_SETTINGS: FlowTubeSettings = {
  automationEnabled: true,
  triggerMode: "both",
  workTabBehavior: "work-only",
  pauseMusicOnTutorialPlay: true,
  pauseMusicOnTutorialReturn: true,
  preventMultipleYouTubeTabs: true,
  musicDetectionSensitivity: "balanced",
  startMusicDelayMs: 2000,
  showToast: true,
  customWorkSites: [],
  openDefaultMusicWhenMissing: false,
  meetingProtectionEnabled: true,
  pauseMusicOnMeetingTab: true
};

export const DEFAULT_MANUAL_OVERRIDES: ManualOverrides = {
  ignoredTabIds: []
};

export async function getSettings(): Promise<FlowTubeSettings> {
  const result = await chromeStorageGet<{ [SETTINGS_STORAGE_KEY]?: Partial<FlowTubeSettings> }>(SETTINGS_STORAGE_KEY);
  const stored = result[SETTINGS_STORAGE_KEY] ?? {};

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    customWorkSites: normalizeWorkSites(stored.customWorkSites ?? DEFAULT_SETTINGS.customWorkSites)
  };
}

export async function saveSettings(partialSettings: Partial<FlowTubeSettings>): Promise<FlowTubeSettings> {
  const nextSettings = {
    ...(await getSettings()),
    ...partialSettings
  };

  nextSettings.customWorkSites = normalizeWorkSites(nextSettings.customWorkSites);

  const serializableSettings = removeUndefinedValues(nextSettings) as unknown as FlowTubeSettings;

  await chromeStorageSet({ [SETTINGS_STORAGE_KEY]: serializableSettings });
  return serializableSettings;
}

export async function resetSettings(): Promise<FlowTubeSettings> {
  await chromeStorageSet({ [SETTINGS_STORAGE_KEY]: DEFAULT_SETTINGS });
  return DEFAULT_SETTINGS;
}

export async function getManualOverrides(): Promise<ManualOverrides> {
  const result = await chromeStorageGet<{ [MANUAL_OVERRIDES_STORAGE_KEY]?: Partial<ManualOverrides> }>(
    MANUAL_OVERRIDES_STORAGE_KEY
  );
  const stored = result[MANUAL_OVERRIDES_STORAGE_KEY] ?? {};

  return {
    ...DEFAULT_MANUAL_OVERRIDES,
    ...stored,
    ignoredTabIds: uniqueNumbers(stored.ignoredTabIds ?? [])
  };
}

export async function saveManualOverrides(partial: Partial<ManualOverrides>): Promise<ManualOverrides> {
  const next = {
    ...(await getManualOverrides()),
    ...partial
  };

  next.ignoredTabIds = uniqueNumbers(next.ignoredTabIds);
  await chromeStorageSet({ [MANUAL_OVERRIDES_STORAGE_KEY]: next });
  return next;
}

export async function resetManualOverrides(): Promise<ManualOverrides> {
  await chromeStorageSet({ [MANUAL_OVERRIDES_STORAGE_KEY]: DEFAULT_MANUAL_OVERRIDES });
  return DEFAULT_MANUAL_OVERRIDES;
}

export async function getChannelPreferences(): Promise<ChannelPreferences> {
  const result = await chromeStorageGet<{ [CHANNEL_PREFERENCES_STORAGE_KEY]?: ChannelPreferences }>(
    CHANNEL_PREFERENCES_STORAGE_KEY
  );
  return result[CHANNEL_PREFERENCES_STORAGE_KEY] ?? {};
}

export async function saveChannelPreferences(preferences: ChannelPreferences): Promise<ChannelPreferences> {
  await chromeStorageSet({ [CHANNEL_PREFERENCES_STORAGE_KEY]: preferences });
  return preferences;
}

export async function clearChannelPreferences(): Promise<ChannelPreferences> {
  await chromeStorageSet({ [CHANNEL_PREFERENCES_STORAGE_KEY]: {} });
  return {};
}

export async function getStoredDiagnostics(): Promise<Partial<DiagnosticsState>> {
  const result = await chromeStorageGet<{ [DIAGNOSTICS_STORAGE_KEY]?: Partial<DiagnosticsState> }>(
    DIAGNOSTICS_STORAGE_KEY
  );
  return result[DIAGNOSTICS_STORAGE_KEY] ?? {};
}

export async function saveLastAction(action: LastAction): Promise<void> {
  const diagnostics = await getStoredDiagnostics();
  await chromeStorageSet({ [DIAGNOSTICS_STORAGE_KEY]: { ...diagnostics, lastAction: action } });
}

export async function saveLastError(error: LastError | undefined): Promise<void> {
  const diagnostics = await getStoredDiagnostics();
  await chromeStorageSet({ [DIAGNOSTICS_STORAGE_KEY]: { ...diagnostics, lastError: error } });
}

export async function getUndoAction(): Promise<UndoAction | undefined> {
  const result = await chromeStorageGet<{ [UNDO_STORAGE_KEY]?: UndoAction }>(UNDO_STORAGE_KEY);
  return result[UNDO_STORAGE_KEY];
}

export async function saveUndoAction(action: UndoAction | undefined): Promise<void> {
  await chromeStorageSet({ [UNDO_STORAGE_KEY]: action });
}

export function isAutomationCurrentlyActive(settings: FlowTubeSettings): boolean {
  if (!settings.automationEnabled) {
    return false;
  }

  if (settings.disabledUntil === "browser_restart") {
    return false;
  }

  if (typeof settings.disabledUntil === "number" && settings.disabledUntil > Date.now()) {
    return false;
  }

  return true;
}

export function normalizeWorkSites(sites: string[]): string[] {
  return Array.from(new Set(sites.map(normalizeWorkSite).filter(Boolean)));
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value))));
}

function removeUndefinedValues(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function chromeStorageGet<T>(keys: string | string[]): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result as T);
    });
  });
}

function chromeStorageSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => {
      resolve();
    });
  });
}
