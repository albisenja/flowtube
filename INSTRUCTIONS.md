# FlowTube Quick Instructions

Use this file when you just need the practical setup, usage, and troubleshooting steps.

## What FlowTube Does

FlowTube is a Chrome extension for switching between a YouTube tutorial and focus music.

- Pause or leave a tutorial: FlowTube starts music.
- Play or return to the tutorial: FlowTube pauses music.
- If detection is wrong: use manual tab overrides in the popup.

## Install And Build

From the project folder:

```bash
npm install
npm run build
```

The extension files are generated in `dist`.

## Load In Chrome

1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select the `flowtube/dist` folder.
5. Refresh any open YouTube tabs after loading or rebuilding.

## Basic Use

1. Open a YouTube tutorial tab.
2. Open a YouTube or YouTube Music tab for focus music.
3. Click the FlowTube toolbar icon.
4. Click `Detect YouTube tabs`.
5. If needed, click `Use as tutorial` or `Use as music`.
6. Pause the tutorial or switch to a work tab.
7. FlowTube should start the music after the configured delay.
8. Play or return to the tutorial to pause the music.

## Useful Controls

- `Automation`: turns automatic switching on or off.
- `Toggle Now`: manually switches between tutorial and music.
- `Use as music`: marks the selected tab as the music tab.
- `Use as tutorial`: marks the selected tab as the tutorial tab.
- `Ignore`: prevents FlowTube from selecting that tab automatically.
- `Pause all YouTube tabs`: stops noisy YouTube tabs.
- `Clear manual tab overrides`: resets manual tab choices.

## Keyboard Shortcut

Default shortcut:

```text
Alt + Shift + F
```

To change it:

1. Open `chrome://extensions/shortcuts`.
2. Find FlowTube.
3. Change `Toggle between tutorial and focus music`.

## Work Tabs

FlowTube can start music when you leave a tutorial for a work tab.

Default work sites include GitHub, GitLab, Stack Overflow, MDN, localhost, ChatGPT, Google Docs, Notion, Figma, Trello, and Atlassian.

To add your own:

1. Open the popup.
2. Find `Custom work sites`.
3. Add a domain like `linear.app`, `vercel.com`, or `localhost:3000`.

## Troubleshooting

- If music does not autoplay, click the music tab once. Chrome may block autoplay until the tab has user interaction.
- If FlowTube picks the wrong tab, use `Use as music`, `Use as tutorial`, or `Ignore`.
- If changes do not appear after rebuilding, reload the extension in `chrome://extensions` and refresh YouTube tabs.
- If nothing happens, open the popup and check `Diagnostics`.

## Development

Build once:

```bash
npm run build
```

Watch for changes:

```bash
npm run dev
```

Typecheck:

```bash
npm run typecheck
```
