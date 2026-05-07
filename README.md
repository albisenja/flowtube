# FlowTube

FlowTube is a Chrome-only extension that switches between a YouTube tutorial and YouTube or YouTube Music focus music while you work in Chrome.

If you just want setup and usage steps, read `INSTRUCTIONS.md`.

## What It Does

- Starts focus music when a tutorial pauses, ends, or you leave it for a work tab.
- Pauses music when the tutorial starts again or you return to it.
- Lets you correct detection with manual tab overrides.
- Remembers channel preferences locally.
- Provides diagnostics, undo, noisy tab controls, and meeting protection.

FlowTube does not use the YouTube API. It works with YouTube page video elements through a Chrome Extension Manifest V3 content script and background service worker.

## Supported Sites

FlowTube only runs on:

- `https://www.youtube.com/*`
- `https://music.youtube.com/*`

It works inside Chrome tabs only. It cannot detect desktop apps like VS Code, and Chrome may block autoplay until you click the music tab once.

## Quick Start

```bash
npm install
npm run build
```

Then load the extension:

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the generated `dist` folder.
5. Refresh any open YouTube tabs.

## Basic Use

1. Open a YouTube tutorial tab.
2. Open a YouTube or YouTube Music music tab.
3. Open the FlowTube popup.
4. Click `Detect YouTube tabs`.
5. Use `Use as tutorial` or `Use as music` if FlowTube guesses wrong.
6. Pause the tutorial or switch to a work tab.
7. FlowTube should start music after the configured delay.

Default shortcut:

```text
Alt + Shift + F
```

Shortcut settings are managed at `chrome://extensions/shortcuts`.

## Main Features

- Automatic tutorial-to-music switching
- Automatic music pausing when tutorials resume
- Work-tab detection with custom work sites
- YouTube and YouTube Music support
- Manual music/tutorial/ignore tab overrides
- Channel memory for music, tutorial, or ignored channels
- Default music source fallback
- Autoplay failure recovery
- Meeting/call protection
- Pause all or pause other YouTube tabs
- Undo last FlowTube action
- Popup diagnostics
- On-page toast messages
- Music fade-up

## Project Structure

- `manifest.json`: Chrome extension manifest.
- `src/background.ts`: background service worker and automation logic.
- `src/content.ts`: YouTube page video detection and playback control.
- `src/popup.html`, `src/popup.ts`, `src/popup.css`: popup UI.
- `src/utils/`: scoring, storage, work-site, and YouTube tab helpers.
- `public/`: extension assets.
- `dist/`: generated build output.

## Commands

```bash
npm run build
npm run dev
npm run typecheck
```

## Privacy

No data leaves the browser. Settings, overrides, diagnostics, and preferences are stored locally with `chrome.storage.local`.

FlowTube does not include analytics, a backend, cloud sync, login, or AI classification.

## Limitations

- Chrome may block autoplay until the music tab has been clicked once.
- YouTube page structure can change.
- Channel detection is best effort.
- Detection is keyword-based plus local preferences.
- Chrome extension shortcuts only fire when Chrome receives them.
- Chrome does not allow extensions to open the toolbar popup automatically.
- Spotify, Apple Music, and desktop apps are not supported.

For practical setup, usage, and troubleshooting steps, see `INSTRUCTIONS.md`.
