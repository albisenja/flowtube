const DEFAULT_WORK_SITES = [
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "stackoverflow.com",
  "developer.mozilla.org",
  "localhost",
  "127.0.0.1",
  "chatgpt.com",
  "docs.google.com",
  "notion.so",
  "figma.com",
  "trello.com",
  "atlassian.net"
];

const MEETING_SITES = ["meet.google.com", "zoom.us", "teams.microsoft.com", "discord.com", "web.whatsapp.com"];

export function isWorkUrl(url: string, customWorkSites: string[] = []): boolean {
  const parsed = parseUrl(url);

  if (!parsed) {
    return false;
  }

  return [...DEFAULT_WORK_SITES, ...customWorkSites].some((site) => hostMatchesSite(parsed.hostname, parsed.host, site));
}

export function isMeetingUrl(url: string): boolean {
  const parsed = parseUrl(url);

  if (!parsed) {
    return false;
  }

  return MEETING_SITES.some((site) => hostMatchesSite(parsed.hostname, parsed.host, site));
}

export function isYouTubeUrl(url: string): boolean {
  const parsed = parseUrl(url);
  return parsed?.hostname === "www.youtube.com" || parsed?.hostname === "music.youtube.com";
}

export function normalizeWorkSite(input: string): string {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return "";
  }

  const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//, "");
  return withoutProtocol.replace(/\/.*$/, "").replace(/\/$/, "");
}

function hostMatchesSite(hostname: string, host: string, site: string): boolean {
  const normalized = normalizeWorkSite(site);

  if (!normalized) {
    return false;
  }

  return host === normalized || hostname === normalized || hostname.endsWith(`.${normalized}`);
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
