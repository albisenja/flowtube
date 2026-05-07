import type { MusicScoreResult } from "../types";

type ScoredTerm = [term: string, points: number];

const POSITIVE_TERMS: ScoredTerm[] = [
  ["music.youtube.com", 12],
  ["lo-fi", 8],
  ["lo fi", 8],
  ["lofi", 8],
  ["music", 8],
  ["playlist", 7],
  ["mix", 7],
  ["radio", 7],
  ["beats", 6],
  ["ambient", 6],
  ["instrumental", 6],
  ["instrumentals", 6],
  ["official audio", 6],
  ["audio", 5],
  ["song", 6],
  ["songs", 6],
  ["study music", 5],
  ["focus music", 5],
  ["deep focus", 5],
  ["coding music", 5],
  ["work music", 5],
  ["background music", 5],
  ["concentration music", 5],
  ["productivity music", 5],
  ["chill music", 5],
  ["relaxing music", 5],
  ["study beats", 5],
  ["focus beats", 5],
  ["live set", 5],
  ["dj set", 5],
  ["full album", 5],
  ["album", 5],
  ["soundtrack", 5],
  ["ost", 5],
  ["remix", 5],
  ["chill", 4],
  ["relax", 4],
  ["relaxing", 4],
  ["calm", 4],
  ["vibes", 4],
  ["live", 4],
  ["stream", 4],
  ["compilation", 4],
  ["hour", 4],
  ["hours", 4],
  ["jazz", 4],
  ["piano", 4],
  ["classical", 4],
  ["synthwave", 4],
  ["retrowave", 4],
  ["lofi hip hop", 4],
  ["hip hop beats", 4],
  ["electronic", 3],
  ["house", 3],
  ["techno", 3],
  ["drum and bass", 3],
  ["dnb", 3],
  ["meditation", 3],
  ["sleep", 3],
  ["rain sounds", 3],
  ["nature sounds", 3],
  ["white noise", 3],
  ["brown noise", 3]
];

const NEGATIVE_TERMS: ScoredTerm[] = [
  ["tutorial", 10],
  ["course", 8],
  ["lesson", 8],
  ["how to", 8],
  ["lecture", 8],
  ["coding tutorial", 10],
  ["programming tutorial", 10],
  ["code tutorial", 10],
  ["learn to code", 9],
  ["learn coding", 9],
  ["learn programming", 9],
  ["learn javascript", 9],
  ["learn typescript", 9],
  ["learn python", 9],
  ["full course", 8],
  ["complete course", 8],
  ["beginner course", 8],
  ["masterclass", 8],
  ["bootcamp", 8],
  ["class", 7],
  ["workshop", 7],
  ["training", 7],
  ["walkthrough", 7],
  ["guide", 7],
  ["step by step", 7],
  ["for beginners", 7],
  ["beginner", 6],
  ["advanced", 6],
  ["learn", 6],
  ["learning", 6],
  ["programming", 6],
  ["explained", 6],
  ["explanation", 6],
  ["deep dive", 6],
  ["build", 6],
  ["building", 6],
  ["project", 6],
  ["developer", 6],
  ["development", 6],
  ["software", 6],
  ["web dev", 6],
  ["web development", 6],
  ["frontend", 6],
  ["backend", 6],
  ["full stack", 6],
  ["javascript", 6],
  ["typescript", 6],
  ["python", 6],
  ["react", 6],
  ["next.js", 6],
  ["node.js", 6],
  ["node", 5],
  ["api", 5],
  ["html", 5],
  ["css", 5],
  ["database", 5],
  ["sql", 5],
  ["debug", 5],
  ["debugging", 5],
  ["setup", 5],
  ["install", 5],
  ["configure", 5],
  ["architecture", 5],
  ["system design", 5],
  ["algorithm", 5],
  ["algorithms", 5],
  ["data structures", 5],
  ["crash course", 5],
  ["coding", 5],
  ["code", 5],
  ["vs code", 4],
  ["vscode", 4],
  ["github", 4],
  ["git", 4],
  ["docker", 4],
  ["kubernetes", 4],
  ["aws", 4],
  ["firebase", 4],
  ["supabase", 4]
];

export function scoreMusicCandidate(input: { title: string; url: string }): MusicScoreResult {
  const title = input.title.toLowerCase();
  const url = input.url.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  for (const [term, points] of POSITIVE_TERMS) {
    const normalizedTerm = term.toLowerCase();
    const source = normalizedTerm.includes(".") ? url : title;

    if (source.includes(normalizedTerm)) {
      score += points;
      reasons.push(`+${points} ${normalizedTerm}`);
    }
  }

  if (url.includes("list=")) {
    score += 4;
    reasons.push("+4 playlist URL");
  }

  for (const [term, points] of NEGATIVE_TERMS) {
    const normalizedTerm = term.toLowerCase();

    if (title.includes(normalizedTerm)) {
      score -= points;
      reasons.push(`-${points} ${normalizedTerm}`);
    }
  }

  return {
    score,
    reasons,
    detectedType: getDetectedType(score)
  };
}

function getDetectedType(score: number): MusicScoreResult["detectedType"] {
  if (score >= 5) {
    return "music";
  }

  if (score < 0) {
    return "tutorial";
  }

  return "unknown";
}
