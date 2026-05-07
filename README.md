# FlowTube

FlowTube is a Chrome-only extension that manages YouTube tutorial audio and YouTube or YouTube Music focus music while you work inside Chrome.

The main idea is simple:

- When a tutorial pauses, ends, or you leave it for work, FlowTube starts focus music.
- When the tutorial starts again or you return to it, FlowTube pauses the music.
- If FlowTube guesses wrong, you can correct it with manual tab overrides or channel memory.

FlowTube does not use the YouTube API. It works by using a content script on YouTube pages, finding the page `HTMLVideoElement`, and sending play/pause/state messages between the page and the background service worker.

## Scope

FlowTube runs only on:

- `https://www.youtube.com/*`
- `https://music.youtube.com/*`

FlowTube is Chrome-only:

- It works inside Chrome tabs.
- It cannot detect desktop apps like VS Code.
- The keyboard shortcut only works when Chrome receives the shortcut.
- Chrome does not allow the extension popup to open automatically.

No data leaves the browser. Settings, overrides, diagnostics, and preferences are stored locally with `chrome.storage.local`.

## Features

- YouTube and YouTube Music content scripts
- `HTMLVideoElement` play, pause, ended, and state detection
- Automatic tutorial-to-music switching
- Automatic music-to-tutorial pausing
- Work-tab detection
- Custom work sites
- Keyword-based music scoring with reasons
- Manual tab overrides
- Local channel memory
- Default music source fallback
- Autoplay failure recovery
- Compact diagnostics
- Temporary automation disable
- Meeting/call protection
- Noisy YouTube tab controls
- Undo last FlowTube action
- Popup settings
- Detect YouTube tabs
- Toggle Now
- Keyboard shortcut: `Alt + Shift + F`
- On-page toast
- Music fade-up
- Multiple YouTube tab prevention

## Architecture

FlowTube uses normal Chrome Extension Manifest V3 architecture:

- `manifest.json`: permissions, host access, action popup, content scripts, background worker, keyboard command.
- `src/background.ts`: event-driven extension brain.
- `src/content.ts`: runs inside YouTube pages and controls video elements.
- `src/popup.html`, `src/popup.ts`, `src/popup.css`: compact popup UI.
- `src/utils/scoring.ts`: keyword music/tutorial scoring.
- `src/utils/storage.ts`: settings, overrides, diagnostics, undo state.
- `src/utils/workSites.ts`: default/custom work site and meeting site checks.
- `src/utils/youtube.ts`: YouTube tab lookup and tab messaging helpers.

Chrome permissions:

- `tabs`
- `storage`

Host permissions:

- `https://www.youtube.com/*`
- `https://music.youtube.com/*`

No extra permissions are requested.

## Default Settings

FlowTube starts with:

- Automation enabled: `true`
- Trigger: `both`
- Work-tab behavior: `work-only`
- Pause music when tutorial plays: `true`
- Pause music when returning to tutorial: `true`
- Prevent multiple YouTube tabs playing: `true`
- Music detection: `balanced`
- Start delay: `2000ms`
- Toasts: `true`
- Custom work sites: `[]`
- Open default music when missing: `false`
- Meeting protection: `true`
- Pause music on meeting tab: `true`

## Automatic Behavior

### When A Tutorial Pauses Or Ends

FlowTube:

1. Treats the sender tab as the tutorial tab.
2. Respects manual tutorial override if one exists and is still open.
3. Checks whether automation is currently active.
4. Checks Trigger mode.
5. Waits for the configured start delay.
6. Finds the best music tab.
7. Pauses other YouTube tabs if multiple-tab prevention is enabled.
8. Sends `PLAY_VIDEO` to the music tab.
9. Saves the successful music URL as `lastMusicUrl`.
10. Records diagnostics and undo state.
11. Shows a toast if enabled.

### When A Tutorial Starts Playing

FlowTube:

1. Treats the playing tab as the tutorial candidate unless it is the current music tab.
2. Pauses the current music tab if `Pause music when tutorial plays` is enabled.
3. Pauses other YouTube tabs if multiple-tab prevention is enabled.
4. Records the action for diagnostics.

### When You Leave A Tutorial For A Work Tab

FlowTube:

1. Watches Chrome tab activation events.
2. Checks whether the previous active tab was the remembered tutorial tab.
3. Checks Trigger mode.
4. Checks Work-tab behavior.
5. Checks meeting protection.
6. Starts music after the configured delay if the destination tab qualifies.

This only works for tab switches inside Chrome. If you switch from Chrome to VS Code, FlowTube does not receive a Chrome tab activation event.

### When You Return To The Tutorial

FlowTube:

1. Checks whether the activated tab is the remembered tutorial tab.
2. Pauses the current music tab if `Pause music when returning to tutorial` is enabled.
3. Does not auto-play the tutorial.

### When FlowTube Starts Music

FlowTube:

1. Sends `PLAY_VIDEO` to the selected YouTube tab.
2. The content script calls `video.play()`.
3. The content script handles rejected promises safely.
4. If playback succeeds, the content script fades volume up from `0` to the current tab volume.
5. If playback fails, FlowTube stores a visible autoplay error.

## Popup Overview

Open the popup by clicking the FlowTube toolbar icon.

The popup is split into compact sections:

1. Status and temporary disable
2. Automation controls
3. Quick actions
4. Diagnostics
5. Detected YouTube tabs
6. Default music source
7. Custom work sites
8. Channel preferences

Chrome does not allow FlowTube to open this popup automatically during page events or shortcut events.

## Automation Status

The main Automation checkbox controls automatic behavior.

When Automation is ON:

- Pause/end triggers can start music.
- Leaving a tutorial for a work tab can start music.
- Returning to the tutorial can pause music.
- Tutorial playback can pause music.

When Automation is OFF:

- Automatic behavior stops.
- Manual popup actions can still be used.
- Stored settings are preserved.

## Temporary Disable

Temporary disable pauses automation without changing the main Automation setting.

Options:

- `Off 15m`: disable automatic triggers for 15 minutes.
- `Off 1h`: disable automatic triggers for 1 hour.
- `Off restart`: disable automatic triggers until browser restart.
- `Re-enable`: clear temporary disable immediately.

Manual actions like Toggle Now, Pause all, and Detect tabs are still available.

## Trigger

Trigger controls what can start music automatically.

`Both`:

- Start music when the tutorial pauses or ends.
- Start music when you leave the tutorial for a valid work tab.

`Pause/ended only`:

- Start music only when the tutorial pauses or ends.
- Tab switching does not start music.

`Leaving tutorial only`:

- Start music only when you leave the tutorial for a valid work tab.
- Pausing or ending the tutorial does not start music.

## Work Tab Behavior

Work-tab behavior controls which destination tabs count as work.

`Only work tabs`:

- Music starts only when the new active tab matches a default or custom work site.

`Any non-YouTube tab`:

- Music starts when the new active tab is not YouTube or YouTube Music.

`Disabled`:

- Leaving the tutorial never starts music.
- Pause/end behavior and manual actions can still work.

## Default Work Sites

These work by default:

- `github.com`
- `gitlab.com`
- `bitbucket.org`
- `stackoverflow.com`
- `developer.mozilla.org`
- `localhost`
- `127.0.0.1`
- `chatgpt.com`
- `docs.google.com`
- `notion.so`
- `figma.com`
- `trello.com`
- `atlassian.net`

## Custom Work Sites

The Custom work sites section lets you add domains without removing defaults.

Examples:

- `linear.app`
- `vercel.com`
- `localhost:3000`
- `admin.myapp.test`
- `mycompany.com`

Input normalization:

- Trims whitespace.
- Lowercases input.
- Removes `http://` or `https://`.
- Removes paths and trailing slashes.
- Rejects empty values.
- Avoids duplicates.

Custom sites are stored in `customWorkSites`.

## Music Detection

Every open YouTube tab receives a score and reasons.

FlowTube looks at:

- Tab title
- Tab URL
- Channel preference, if available
- Manual tab overrides
- Ignored tab IDs

Sensitivity thresholds:

- Conservative: score must be at least `10`.
- Balanced: score must be at least `5`.
- Aggressive: score must be greater than `0`.

If exactly one other YouTube tab exists, FlowTube can use it as a fallback even when the score is low. This supports the common setup of one tutorial tab plus one music tab.

### Positive Music Signals

Examples that add points:

- `music.youtube.com`
- `lofi`
- `lo-fi`
- `lo fi`
- `music`
- `playlist`
- `mix`
- `radio`
- `beats`
- `ambient`
- `instrumental`
- `instrumentals`
- `official audio`
- `audio`
- `song`
- `songs`
- `study music`
- `focus music`
- `deep focus`
- `coding music`
- `work music`
- `background music`
- `concentration music`
- `productivity music`
- `chill music`
- `relaxing music`
- `study beats`
- `focus beats`
- `live set`
- `dj set`
- `full album`
- `album`
- `soundtrack`
- `ost`
- `remix`
- `chill`
- `relax`
- `relaxing`
- `calm`
- `vibes`
- `live`
- `stream`
- `compilation`
- `hour`
- `hours`
- `jazz`
- `piano`
- `classical`
- `synthwave`
- `retrowave`
- `lofi hip hop`
- `hip hop beats`
- `electronic`
- `house`
- `techno`
- `drum and bass`
- `dnb`
- `meditation`
- `sleep`
- `rain sounds`
- `nature sounds`
- `white noise`
- `brown noise`
- URL contains `list=`

### Tutorial/Code Signals

Examples that subtract points:

- `tutorial`
- `course`
- `lesson`
- `how to`
- `lecture`
- `coding tutorial`
- `programming tutorial`
- `code tutorial`
- `learn to code`
- `learn coding`
- `learn programming`
- `learn javascript`
- `learn typescript`
- `learn python`
- `full course`
- `complete course`
- `beginner course`
- `masterclass`
- `bootcamp`
- `class`
- `workshop`
- `training`
- `walkthrough`
- `guide`
- `step by step`
- `for beginners`
- `beginner`
- `advanced`
- `learn`
- `learning`
- `programming`
- `explained`
- `explanation`
- `deep dive`
- `build`
- `building`
- `project`
- `developer`
- `development`
- `software`
- `web dev`
- `web development`
- `frontend`
- `backend`
- `full stack`
- `javascript`
- `typescript`
- `python`
- `react`
- `next.js`
- `node.js`
- `node`
- `api`
- `html`
- `css`
- `database`
- `sql`
- `debug`
- `debugging`
- `setup`
- `install`
- `configure`
- `architecture`
- `system design`
- `algorithm`
- `algorithms`
- `data structures`
- `crash course`
- `coding`
- `code`
- `vs code`
- `vscode`
- `github`
- `git`
- `docker`
- `kubernetes`
- `aws`
- `firebase`
- `supabase`

Matching is case-insensitive.

Detected type:

- `music`: score passes the balanced threshold.
- `tutorial`: score is negative.
- `unknown`: score is neither clearly music nor clearly tutorial.

## Manual Tab Overrides

Manual tab overrides let you correct FlowTube when detection is wrong.

Each detected YouTube tab has buttons:

- `Use as music`
- `Use as tutorial`
- `Ignore`

Behavior:

- Manual music tab is preferred over scoring if the tab is still open.
- Manual tutorial tab is used as the remembered tutorial when relevant.
- Ignored tabs are excluded from automatic music selection.
- Closed or unreachable override tabs are ignored safely.
- Overrides persist across popup closes.

Labels shown in the tab list:

- `manual music`
- `manual tutorial`
- `ignored tab`

Clear overrides with:

- `Clear manual tab overrides`

Stored state:

- `manualMusicTabId?: number`
- `manualTutorialTabId?: number`
- `ignoredTabIds: number[]`

## Channel Memory

FlowTube tries to read the channel name from YouTube pages using several simple selectors. If it cannot find a channel, it leaves `channelName` empty and continues safely.

Each detected tab can set a channel rule:

- `Always music`
- `Always tutorial`
- `Ignore channel`

Behavior:

- Channel marked as music strongly prefers that channel as music.
- Channel marked as tutorial strongly classifies that channel as tutorial and avoids choosing it as music.
- Ignored channel is excluded from automatic music selection.
- Channel preferences override keyword scoring.

Reasons shown in scoring:

- `Channel marked as music`
- `Channel marked as tutorial`
- `Channel ignored`

The Channel preferences section lists saved rules:

- Channel name
- Preference
- Remove button
- Clear all channel preferences button

Stored state:

```ts
channelPreferences: {
  [channelName: string]: "music" | "tutorial" | "ignored";
}
```

## Default Music Source

Default music source helps when no obvious music tab is open.

In Detected YouTube tabs:

- `Set default` saves that tab URL as the default music source.

In Default music source:

- `Open default music when no music tab is found`
- `Clear default music source`

Behavior:

- When music starts successfully, FlowTube saves that URL as `lastMusicUrl`.
- If no music tab is found and `Open default music when no music tab is found` is enabled, FlowTube opens the default URL in a background tab.
- FlowTube waits briefly for the new tab to load, then attempts playback.
- FlowTube has a short guard to avoid opening repeated default music tabs.

Autoplay can still be blocked by Chrome until you click the music tab once.

## Autoplay Recovery

When `video.play()` fails, FlowTube does not crash or silently fail.

It stores `lastError`:

```ts
{
  type: "autoplay_blocked" | "tab_unreachable" | "no_music_tab" | "unknown";
  message: string;
  tabId?: number;
  timestamp: number;
}
```

Error types:

- `autoplay_blocked`: Chrome or YouTube blocked playback.
- `tab_unreachable`: FlowTube could not message the tab.
- `no_music_tab`: no usable music tab or default source was found.
- `unknown`: failure did not match a known category.

If a tab ID exists, Diagnostics enables:

- `Open affected tab`

FlowTube also asks the content script to show this toast:

```text
FlowTube couldn't autoplay music. Click this tab once to allow playback.
```

## Diagnostics

Diagnostics are intentionally compact.

They show:

- Automation state
- Last action
- Last error
- Tutorial tab title, or `None`
- Music tab title, or `None`
- YouTube tabs detected
- Shortcut: `Alt + Shift + F`
- Playing YouTube tabs with title and URL

Buttons:

- `Refresh`
- `Clear error`
- `Open affected tab`
- `Detect YouTube tabs`

FlowTube stores:

```ts
lastAction?: {
  type: string;
  message: string;
  timestamp: number;
}
```

and `lastError`.

## Noisy YouTube Tab Controls

FlowTube can query all YouTube and YouTube Music tabs and ask each content script for video state.

A tab is considered playing when:

- `paused === false`
- `ended === false`

Actions:

- `Pause all YouTube tabs`: sends `PAUSE_VIDEO` to every detected YouTube or YouTube Music tab.
- `Pause other YouTube tabs`: sends `PAUSE_VIDEO` to every detected YouTube or YouTube Music tab except the active tab.
- Diagnostics lists currently playing YouTube tabs.

## Meeting Protection

Meeting protection avoids accidental music during browser-based calls.

Protected sites:

- `meet.google.com`
- `zoom.us`
- `teams.microsoft.com`
- `discord.com`
- `web.whatsapp.com`

When `Meeting protection` is enabled:

- Activating a meeting tab does not auto-start music.
- Pending music starts are cleared.

When `Pause music on meeting tab` is enabled:

- FlowTube pauses current music when a meeting tab becomes active.

## Undo Last Action

Undo is conservative.

If FlowTube started a music tab, Undo pauses that music tab.

FlowTube does not blindly resume many previously paused videos, because that can create unexpected audio chaos.

Undo expires after about 60 seconds.

## Toggle Now And Shortcut

`Toggle now` runs the same logic as the keyboard shortcut.

Default shortcut:

```text
Alt + Shift + F
```

Shortcut behavior:

If detected music is currently playing:

- Pause music.
- Focus the remembered tutorial tab if available.
- Do not auto-play the tutorial.

If the active tab is YouTube and music is not playing:

- Pause the active YouTube video.
- Mark it as tutorial.
- Start best detected music.

If the active tab is not YouTube and music is not playing:

- Start best detected music.

Shortcut customization:

1. Open `chrome://extensions/shortcuts`
2. Find FlowTube
3. Change `Toggle between tutorial and focus music`

FlowTube opens that Chrome page from `Change keyboard shortcut`. It does not implement a custom shortcut recorder.

## Content Script Details

The content script runs on YouTube and YouTube Music pages.

It:

- Finds the main `HTMLVideoElement`.
- Listens for `play`.
- Listens for `pause`.
- Listens for `ended`.
- Sends video events to the background worker.
- Returns video state when asked.
- Plays or pauses the video when asked.
- Shows a small toast when asked.
- Handles extension reload context invalidation safely.

Video state includes:

- Whether a video exists
- Title
- URL
- Channel name when available
- Paused state
- Ended state
- Current time
- Duration

The content script does not rely on YouTube play/pause button selectors.

## Background Worker Details

The background service worker is event-driven.

It listens for:

- Content script video events
- Popup messages
- Tab activation
- Tab removal
- Chrome command shortcut
- Tab updates only when waiting for a default music tab to load

It does not use long-running intervals.

It tracks in memory:

- `lastTutorialTabId`
- `currentMusicTabId`
- `lastActiveTabId`
- Pending start-music timeout
- Default music open guard timestamp

It stores locally:

- Settings
- Manual overrides
- Channel preferences
- Diagnostics
- Undo action

## Toasts And Fade-Up

When FlowTube successfully starts music, it can show:

```text
FlowTube started music
```

or:

```text
FlowTube started focus music
```

When autoplay fails, it can show:

```text
FlowTube couldn't autoplay music. Click this tab once to allow playback.
```

When music starts, the content script:

- Saves the target volume.
- Sets video volume to `0`.
- Calls `video.play()`.
- Fades to the target volume over about `1.2s`.
- Restores the original volume if playback fails.

## Stored Data

FlowTube uses `chrome.storage.local`.

Storage keys:

- `flowtubeSettings`
- `flowtubeManualOverrides`
- `flowtubeChannelPreferences`
- `flowtubeDiagnostics`
- `flowtubeUndoAction`

No data is sent to a server.

No analytics are collected.

No account is required.

## Install Dependencies

```bash
npm install
```

## Build

```bash
npm run build
```

The build output is written to `dist`.

## Development Build

```bash
npm run dev
```

This runs Vite build watch mode.

## Typecheck

```bash
npm run typecheck
```

## Load In Chrome

1. `npm install`
2. `npm run build`
3. Open `chrome://extensions`
4. Enable Developer Mode
5. Click `Load unpacked`
6. Select the `dist` folder

After reloading the extension, refresh open YouTube tabs so the newest content script is active.

## Basic Test

1. Open a YouTube tutorial tab.
2. Open a YouTube or YouTube Music music tab.
3. Open the FlowTube popup.
4. Click `Detect YouTube tabs`.
5. Confirm the music tab has a useful score or use `Use as music`.
6. Pause the tutorial.
7. Music should attempt to play after the configured delay.
8. Play the tutorial again.
9. Music should pause.

## Work Tab Test

1. Open a tutorial tab.
2. Open a music tab.
3. Open a work tab such as GitHub, ChatGPT, localhost, Docs, Notion, or Figma.
4. Set Trigger to `Both` or `Leaving tutorial only`.
5. Set Work tab behavior to `Only work tabs`.
6. Activate the tutorial tab.
7. Switch to the work tab.
8. Music should attempt to play after the configured delay.

## Manual Override Test

1. Open two or more YouTube tabs.
2. Click `Detect YouTube tabs`.
3. Click `Use as music` on the music tab.
4. Click `Use as tutorial` on the tutorial tab.
5. Pause or leave the tutorial.
6. FlowTube should use the manually selected music tab.
7. Click `Clear manual tab overrides` to reset.

## Channel Memory Test

1. Open a YouTube tab where FlowTube can read the channel.
2. Click `Detect YouTube tabs`.
3. Click `Always music`, `Always tutorial`, or `Ignore channel`.
4. Detect tabs again.
5. The scoring reasons should show the channel preference.
6. Clear the rule from Channel preferences when needed.

## Autoplay Recovery Test

1. Use a music tab that Chrome has not interacted with yet.
2. Trigger FlowTube to start music.
3. If Chrome blocks autoplay, Diagnostics should show an autoplay error.
4. Click `Open affected tab`.
5. Click once on the music tab.
6. Try again.

## Noisy Tab Test

1. Start multiple YouTube videos.
2. Open the popup.
3. Diagnostics should list playing YouTube tabs.
4. Click `Pause all YouTube tabs` to stop all.
5. Or click `Pause other YouTube tabs` to keep only the active tab.

## Known Limitations

- Chrome may block autoplay until you click the music tab once.
- YouTube page structure can change.
- Channel extraction is best-effort and may be missing.
- Detection is keyword-based plus local manual preferences.
- FlowTube only works inside Chrome.
- FlowTube cannot detect desktop apps like VS Code.
- Chrome extension shortcuts only fire when Chrome receives them.
- Chrome does not allow extensions to auto-open the toolbar popup.
- No Spotify or Apple Music support.
- No login.
- No backend.
- No cloud sync.
- No analytics.
- No AI classification.
