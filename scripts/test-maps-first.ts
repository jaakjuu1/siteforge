import { getDb } from "../src/pipeline/crm/db.js";
import { auditWebsite } from "../src/pipeline/prospector/audit.js";
import { calculatePainScore, calculateSiteforgeFit } from "../src/pipeline/prospector/score.js";

function visibilityGapScore(p: any, painScore: number) {
  let score = 0;
  const reviews = p.review_count ?? 0;
  const rating = p.google_rating ?? 0;

  if (reviews >= 5) score += 2;
  if (reviews >= 20) score += 2;
  if (rating >= 4.2 && reviews >= 5) score += 1;
  if (p.website) score += Math.min(4, Math.max(0, painScore - 2));
  else score += 6;

  return Math.min(score, 10);
}

function commercial(name: string, pain: number, fit: number) {
  let s = 0;
  const l = name.toLowerCase();
  if (["sähkö", "lvi", "putki", "sauma", "urakointi", "asennus", "remontti"].some((x) => l.includes(x))) s += 4;
  if (pain >= 5) s += 3;
  if (fit >= 8) s += 3;
  return Math.min(s, 10);
}

async function main() {
  const db = getDb();
  const candidates: any[] = db.prepare(`
    SELECT * FROM prospects
    WHERE city = ?
      AND website IS NOT NULL
      AND website NOT LIKE '%sahkomiehet.com%'
      AND website NOT LIKE '%suomenyritysrekisteri%'
      AND website NOT LIKE '%localnow.net%'
      AND website NOT LIKE '%puolustusvoimat.fi%'
      AND website NOT LIKE '%tlmaint.fi%'
      AND website NOT LIKE '%jokiwatti.fi%'
  `).all("Jyväskylä");

  const out = [];

  for (const p of candidates) {
    if (!/(sahko|power|rentola|asennus)/i.test(`${p.website} ${p.business_name}`)) continue;

    const audit = await auditWebsite(p.website);
    const pain = calculatePainScore(audit);
    const fit = calculateSiteforgeFit(audit);
    const vis = visibilityGapScore(p, pain.score);
    const com = commercial(p.business_name, pain.score, fit.score);
    const opp = Math.round((vis * 0.4 + fit.score * 0.35 + com * 0.25) * 10) / 10;

    out.push({
      name: p.business_name,
      website: p.website,
      pain: pain.score,
      fit: fit.score,
      status: fit.fitStatus,
      reason: fit.disqualifiedReason,
      vis,
      com,
      opp,
      reviews: p.review_count || 0,
      rating: p.google_rating || null,
    });
  }

  out.sort((a, b) => b.opp - a.opp || b.pain - a.pain);
  console.log(JSON.stringify(out, null, 2));
  db.close();
}

main();
