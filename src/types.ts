export const SETTINGS_STORAGE_KEY = "flowtubeSettings";
export const MANUAL_OVERRIDES_STORAGE_KEY = "flowtubeManualOverrides";
export const CHANNEL_PREFERENCES_STORAGE_KEY = "flowtubeChannelPreferences";
export const DIAGNOSTICS_STORAGE_KEY = "flowtubeDiagnostics";
export const UNDO_STORAGE_KEY = "flowtubeUndoAction";

export type TriggerMode = "pause-only" | "leave-only" | "both";
export type WorkTabBehavior = "work-only" | "any-non-youtube" | "disabled";
export type MusicDetectionSensitivity = "conservative" | "balanced" | "aggressive";
export type DisabledUntil = number | "browser_restart";
export type ChannelPreference = "music" | "tutorial" | "ignored";

export interface FlowTubeSettings {
  automationEnabled: boolean;
  triggerMode: TriggerMode;
  workTabBehavior: WorkTabBehavior;
  pauseMusicOnTutorialPlay: boolean;
  pauseMusicOnTutorialReturn: boolean;
  preventMultipleYouTubeTabs: boolean;
  musicDetectionSensitivity: MusicDetectionSensitivity;
  startMusicDelayMs: number;
  showToast: boolean;
  customWorkSites: string[];
  defaultMusicUrl?: string;
  lastMusicUrl?: string;
  openDefaultMusicWhenMissing: boolean;
  meetingProtectionEnabled: boolean;
  pauseMusicOnMeetingTab: boolean;
  disabledUntil?: DisabledUntil;
}

export interface ManualOverrides {
  manualMusicTabId?: number;
  manualTutorialTabId?: number;
  ignoredTabIds: number[];
}

export type ChannelPreferences = Record<string, ChannelPreference>;

export interface LastError {
  type: "autoplay_blocked" | "tab_unreachable" | "no_music_tab" | "unknown";
  message: string;
  tabId?: number;
  timestamp: number;
}

export interface LastAction {
  type: string;
  message: string;
  timestamp: number;
}

export interface UndoAction {
  startedMusicTabId?: number;
  pausedTabIds: number[];
  focusedTabId?: number;
  timestamp: number;
}

export interface DiagnosticsState {
  automationActive: boolean;
  automationEnabled: boolean;
  temporaryDisableText?: string;
  lastAction?: LastAction;
  lastError?: LastError;
  tutorialTab?: TabSummary;
  musicTab?: TabSummary;
  youtubeTabCount: number;
  playingTabs: YouTubeTabInfo[];
  undoAvailable: boolean;
}

export interface TabSummary {
  tabId: number;
  title: string;
  url: string;
}

export interface MusicScoreResult {
  score: number;
  reasons: string[];
  detectedType: "music" | "tutorial" | "unknown";
}

export interface YouTubeTabInfo {
  tabId: number;
  title: string;
  url: string;
  channelName?: string;
  score: number;
  scoreResult: MusicScoreResult;
}

export interface VideoMetadata {
  title: string;
  url: string;
  channelName?: string;
  isYouTubeMusic: boolean;
  paused: boolean;
}

export interface VideoState {
  exists: boolean;
  title: string;
  url: string;
  channelName?: string;
  paused: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
}

export type VideoEventType = "VIDEO_PLAY" | "VIDEO_PAUSE" | "VIDEO_ENDED";
export type VideoCommandType = "PLAY_VIDEO" | "PAUSE_VIDEO" | "GET_VIDEO_STATE" | "SHOW_TOAST";

export interface VideoEventMessage {
  type: VideoEventType;
  metadata: VideoMetadata;
  state: VideoState;
}

export interface PlayVideoMessage {
  type: "PLAY_VIDEO";
}

export interface PauseVideoMessage {
  type: "PAUSE_VIDEO";
}

export interface GetVideoStateMessage {
  type: "GET_VIDEO_STATE";
}

export interface ShowToastMessage {
  type: "SHOW_TOAST";
  text: string;
}

export interface VideoStateResponseMessage {
  type: "VIDEO_STATE_RESPONSE";
  state: VideoState;
  ok: boolean;
  error?: string;
}

export interface BasicResponse {
  ok: boolean;
  error?: string;
}

export interface AutomationEnabledResponse {
  type: "AUTOMATION_ENABLED_RESPONSE";
  enabled: boolean;
}

export interface SettingsResponse {
  type: "SETTINGS_RESPONSE";
  settings: FlowTubeSettings;
}

export interface YouTubeTabsResponseMessage {
  type: "YOUTUBE_TABS_RESPONSE";
  tabs: YouTubeTabInfo[];
  overrides: ManualOverrides;
  channelPreferences: ChannelPreferences;
}

export interface DiagnosticsResponse {
  type: "DIAGNOSTICS_RESPONSE";
  diagnostics: DiagnosticsState;
}

export interface SetAutomationEnabledMessage {
  type: "SET_AUTOMATION_ENABLED";
  enabled: boolean;
}

export interface SetSettingsMessage {
  type: "SET_SETTINGS";
  settings: Partial<FlowTubeSettings>;
}

export interface SetManualTabRoleMessage {
  type: "SET_MANUAL_TAB_ROLE";
  tabId: number;
  role: "music" | "tutorial" | "ignored";
}

export interface SetChannelPreferenceMessage {
  type: "SET_CHANNEL_PREFERENCE";
  channelName: string;
  preference: ChannelPreference;
}

export interface RemoveChannelPreferenceMessage {
  type: "REMOVE_CHANNEL_PREFERENCE";
  channelName: string;
}

export interface AddCustomWorkSiteMessage {
  type: "ADD_CUSTOM_WORK_SITE";
  site: string;
}

export interface RemoveCustomWorkSiteMessage {
  type: "REMOVE_CUSTOM_WORK_SITE";
  site: string;
}

export interface SetDefaultMusicTabMessage {
  type: "SET_DEFAULT_MUSIC_TAB";
  tabId: number;
}

export interface DisableTemporarilyMessage {
  type: "DISABLE_TEMPORARILY";
  duration: 15 | 60 | "browser_restart";
}

export type RuntimeMessage =
  | VideoEventMessage
  | PlayVideoMessage
  | PauseVideoMessage
  | GetVideoStateMessage
  | ShowToastMessage
  | VideoStateResponseMessage
  | { type: "GET_AUTOMATION_ENABLED" }
  | SetAutomationEnabledMessage
  | { type: "GET_SETTINGS" }
  | SetSettingsMessage
  | { type: "GET_YOUTUBE_TABS" }
  | { type: "RUN_TOGGLE_ACTION" }
  | { type: "OPEN_SHORTCUT_SETTINGS" }
  | SetManualTabRoleMessage
  | { type: "CLEAR_MANUAL_OVERRIDES" }
  | SetChannelPreferenceMessage
  | RemoveChannelPreferenceMessage
  | { type: "CLEAR_CHANNEL_PREFERENCES" }
  | AddCustomWorkSiteMessage
  | RemoveCustomWorkSiteMessage
  | { type: "RESET_CUSTOM_WORK_SITES" }
  | SetDefaultMusicTabMessage
  | { type: "CLEAR_DEFAULT_MUSIC" }
  | DisableTemporarilyMessage
  | { type: "RE_ENABLE_NOW" }
  | { type: "GET_DIAGNOSTICS" }
  | { type: "CLEAR_LAST_ERROR" }
  | { type: "OPEN_MUSIC_TAB" }
  | { type: "PAUSE_ALL_YOUTUBE" }
  | { type: "PAUSE_OTHER_YOUTUBE" }
  | { type: "UNDO_LAST_ACTION" };
