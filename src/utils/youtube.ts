import type { ChannelPreferences, VideoStateResponseMessage, YouTubeTabInfo } from "../types";
import { scoreMusicCandidate } from "./scoring";

const YOUTUBE_URL_PATTERNS = ["https://www.youtube.com/*", "https://music.youtube.com/*"];

export function isYouTubeUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "www.youtube.com" || hostname === "music.youtube.com";
  } catch {
    return false;
  }
}

export function isYouTubeMusicUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "music.youtube.com";
  } catch {
    return false;
  }
}

export async function queryYouTubeTabs(channelPreferences: ChannelPreferences = {}): Promise<YouTubeTabInfo[]> {
  const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
    chrome.tabs.query({ url: YOUTUBE_URL_PATTERNS }, (result) => {
      resolve(chrome.runtime.lastError ? [] : result);
    });
  });

  const enrichedTabs = await Promise.all(
    tabs
      .filter((tab): tab is chrome.tabs.Tab & { id: number } => typeof tab.id === "number")
      .map(async (tab) => {
        const state = await sendMessageToTab<VideoStateResponseMessage>(tab.id, { type: "GET_VIDEO_STATE" });
        const title = tab.title ?? state?.state.title ?? "Untitled YouTube tab";
        const url = tab.url ?? state?.state.url ?? "";
        const channelName = state?.state.channelName;
        const scoreResult = applyChannelPreference(
          scoreMusicCandidate({ title, url }),
          channelName,
          channelPreferences
        );

        return {
          tabId: tab.id,
          title,
          url,
          channelName,
          score: scoreResult.score,
          scoreResult
        };
      })
  );

  return enrichedTabs.sort((a, b) => b.score - a.score);
}

export function sendMessageToTab<T>(tabId: number, message: unknown): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response: T | undefined) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

      resolve(response ?? null);
    });
  });
}

function applyChannelPreference(
  scoreResult: YouTubeTabInfo["scoreResult"],
  channelName: string | undefined,
  channelPreferences: ChannelPreferences
): YouTubeTabInfo["scoreResult"] {
  if (!channelName) {
    return scoreResult;
  }

  const preference = channelPreferences[channelName];

  if (preference === "music") {
    return {
      score: scoreResult.score + 100,
      reasons: ["Channel marked as music", ...scoreResult.reasons],
      detectedType: "music"
    };
  }

  if (preference === "tutorial") {
    return {
      score: scoreResult.score - 100,
      reasons: ["Channel marked as tutorial", ...scoreResult.reasons],
      detectedType: "tutorial"
    };
  }

  if (preference === "ignored") {
    return {
      score: -999,
      reasons: ["Channel ignored", ...scoreResult.reasons],
      detectedType: "tutorial"
    };
  }

  return scoreResult;
}
