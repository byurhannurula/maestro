import type { ImportJob } from "@/lib/import/store";
import type { Song } from "@/lib/types";

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/\bfeat\.?.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function pickMatch(job: ImportJob, candidates: Song[]): Song | null {
  const jt = norm(job.title ?? "");
  const ja = norm(job.artist ?? "");
  let best: Song | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const ct = norm(c.title);
    const ca = norm(c.artist);
    let score = 0;
    if (ct === jt) score += 2;
    else if (jt && (ct.includes(jt) || jt.includes(ct))) score += 1;
    if (ja && (ca.includes(ja) || ja.includes(ca))) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 2 ? best : null;
}
