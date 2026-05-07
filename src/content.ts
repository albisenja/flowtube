import type {
  BasicResponse,
  RuntimeMessage,
  ShowToastMessage,
  VideoEventMessage,
  VideoState,
  VideoStateResponseMessage
} from "./types";

let activeVideo: HTMLVideoElement | null = null;
let observer: MutationObserver | null = null;
let extensionContextValid = true;
let fadeTimer: number | null = null;
let toastTimer: number | null = null;
let toastElement: HTMLDivElement | null = null;

const FADE_UP_DURATION_MS = 1200;
const FADE_UP_STEPS = 12;

function getMetadata(video: HTMLVideoElement | null = findMainVideo()) {
  return {
    title: document.title,
    url: window.location.href,
    channelName: getChannelName(),
    isYouTubeMusic: window.location.hostname === "music.youtube.com",
    paused: video?.paused ?? true
  };
}

function getVideoState(video: HTMLVideoElement | null = findMainVideo()): VideoState {
  return {
    exists: Boolean(video),
    title: document.title,
    url: window.location.href,
    channelName: getChannelName(),
    paused: video?.paused ?? true,
    ended: video?.ended ?? false,
    currentTime: video?.currentTime ?? 0,
    duration: Number.isFinite(video?.duration) ? video?.duration ?? 0 : 0
  };
}

function sendVideoEvent(type: VideoEventMessage["type"], video: HTMLVideoElement): void {
  if (!extensionContextValid) {
    return;
  }

  const message: VideoEventMessage = {
    type,
    metadata: getMetadata(video),
    state: getVideoState(video)
  };

  try {
    chrome.runtime.sendMessage(message, () => {
      if (chrome.runtime.lastError?.message?.includes("Extension context invalidated")) {
        disableStaleContentScript();
      }
    });
  } catch (error) {
    if (isExtensionContextError(error)) {
      disableStaleContentScript();
      return;
    }

    throw error;
  }
}

function disableStaleContentScript(): void {
  extensionContextValid = false;
  stopFade();
  removeToast();

  if (activeVideo) {
    detachVideoListeners(activeVideo);
    activeVideo = null;
  }

  observer?.disconnect();
  observer = null;
}

function isExtensionContextError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Extension context invalidated");
}

function detachVideoListeners(video: HTMLVideoElement): void {
  video.removeEventListener("play", handlePlay);
  video.removeEventListener("pause", handlePause);
  video.removeEventListener("ended", handleEnded);
}

function attachVideoListeners(video: HTMLVideoElement): void {
  video.addEventListener("play", handlePlay);
  video.addEventListener("pause", handlePause);
  video.addEventListener("ended", handleEnded);
}

function handlePlay(event: Event): void {
  sendVideoEvent("VIDEO_PLAY", event.currentTarget as HTMLVideoElement);
}

function handlePause(event: Event): void {
  sendVideoEvent("VIDEO_PAUSE", event.currentTarget as HTMLVideoElement);
}

function handleEnded(event: Event): void {
  sendVideoEvent("VIDEO_ENDED", event.currentTarget as HTMLVideoElement);
}

function refreshActiveVideo(): void {
  const nextVideo = findMainVideo();

  if (!nextVideo || nextVideo === activeVideo) {
    return;
  }

  if (activeVideo) {
    detachVideoListeners(activeVideo);
  }

  activeVideo = nextVideo;
  attachVideoListeners(activeVideo);
}

async function playVideo(): Promise<BasicResponse> {
  const video = findMainVideo();

  if (!video) {
    return { ok: false, error: "No video element found." };
  }

  const targetVolume = getFadeTargetVolume(video);
  stopFade();
  video.volume = 0;

  try {
    await video.play();
    fadeVolumeTo(video, targetVolume);
    return { ok: true };
  } catch (error) {
    video.volume = targetVolume;

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Video playback was blocked."
    };
  }
}

function pauseVideo(): BasicResponse {
  const video = findMainVideo();

  if (!video) {
    return { ok: false, error: "No video element found." };
  }

  stopFade();
  video.pause();
  return { ok: true };
}

function showToast(text: string): BasicResponse {
  if (!document.body) {
    return { ok: false, error: "Page is not ready." };
  }

  if (!toastElement) {
    toastElement = document.createElement("div");
    toastElement.id = "flowtube-toast";
    toastElement.style.cssText = [
      "position:fixed",
      "right:20px",
      "bottom:20px",
      "z-index:2147483647",
      "padding:10px 12px",
      "border-radius:8px",
      "background:rgba(15,23,42,0.92)",
      "color:#fff",
      "font:13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "box-shadow:0 8px 24px rgba(0,0,0,0.24)",
      "opacity:0",
      "transform:translateY(8px)",
      "transition:opacity 160ms ease, transform 160ms ease",
      "pointer-events:none"
    ].join(";");
    document.body.append(toastElement);
  }

  toastElement.textContent = text;
  requestAnimationFrame(() => {
    if (!toastElement) return;
    toastElement.style.opacity = "1";
    toastElement.style.transform = "translateY(0)";
  });

  if (toastTimer !== null) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(removeToast, 2000);
  return { ok: true };
}

function removeToast(): void {
  if (toastTimer !== null) {
    window.clearTimeout(toastTimer);
    toastTimer = null;
  }

  toastElement?.remove();
  toastElement = null;
}

function getFadeTargetVolume(video: HTMLVideoElement): number {
  if (video.volume > 0) {
    return video.volume;
  }

  return 0.5;
}

function fadeVolumeTo(video: HTMLVideoElement, targetVolume: number): void {
  let step = 0;
  const stepMs = FADE_UP_DURATION_MS / FADE_UP_STEPS;

  const tick = () => {
    step += 1;
    video.volume = Math.min(targetVolume, (targetVolume * step) / FADE_UP_STEPS);

    if (step < FADE_UP_STEPS && !video.paused) {
      fadeTimer = window.setTimeout(tick, stepMs);
      return;
    }

    fadeTimer = null;
  };

  fadeTimer = window.setTimeout(tick, stepMs);
}

function stopFade(): void {
  if (fadeTimer === null) {
    return;
  }

  window.clearTimeout(fadeTimer);
  fadeTimer = null;
}

function findMainVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll("video"));

  if (videos.length === 0) {
    return null;
  }

  return videos
    .map((video) => ({
      video,
      score: scoreVideoElement(video)
    }))
    .sort((a, b) => b.score - a.score)[0]?.video ?? null;
}

function scoreVideoElement(video: HTMLVideoElement): number {
  const rect = video.getBoundingClientRect();
  const area = Math.max(0, rect.width) * Math.max(0, rect.height);
  let score = area;

  if (video.readyState > 0) score += 1000;
  if (!video.paused) score += 500;
  if (rect.width > 0 && rect.height > 0) score += 250;

  return score;
}

function getChannelName(): string | undefined {
  const selectors = [
    "ytd-video-owner-renderer ytd-channel-name a",
    "#owner ytd-channel-name a",
    "#upload-info ytd-channel-name a",
    "ytmusic-player-bar .subtitle a",
    "yt-formatted-string.ytd-channel-name a"
  ];

  for (const selector of selectors) {
    const text = document.querySelector<HTMLElement>(selector)?.textContent?.trim();

    if (text) {
      return text;
    }
  }

  const ownerText = document.querySelector<HTMLElement>("#owner-name")?.textContent?.trim();
  return ownerText || undefined;
}

try {
  chrome.runtime.onMessage.addListener(
    (message: RuntimeMessage, _sender, sendResponse: (response: BasicResponse | VideoStateResponseMessage) => void) => {
      if (message.type === "PLAY_VIDEO") {
        playVideo().then(sendResponse);
        return true;
      }

      if (message.type === "PAUSE_VIDEO") {
        sendResponse(pauseVideo());
        return false;
      }

      if (message.type === "GET_VIDEO_STATE") {
        sendResponse({
          type: "VIDEO_STATE_RESPONSE",
          ok: true,
          state: getVideoState()
        });
        return false;
      }

      if (message.type === "SHOW_TOAST") {
        sendResponse(showToast((message as ShowToastMessage).text));
        return false;
      }

      return false;
    }
  );
} catch (error) {
  if (!isExtensionContextError(error)) {
    throw error;
  }
}

refreshActiveVideo();

observer = new MutationObserver(() => {
  refreshActiveVideo();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});
