#!/usr/bin/env tsx

import { searchProspects } from "./search.js";
import { upsertProspect, updateProspectAudit, updateProspectStatus } from "../crm/pipeline.js";
import { closeDb } from "../crm/db.js";
import { auditWebsite } from "./audit.js";
import { calculatePainScore, calculateSiteforgeFit } from "./score.js";

interface RankedDirectoryProspect {
  id: number;
  business_name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  review_count: number | null;
  google_rating: number | null;
  source_type: string;
  visibility_gap_score: number;
  commercial_upside_score: number;
  opportunity_score: number;
  pain_score: number;
  siteforge_fit_score: number;
  fit_status: string;
  disqualified_reason: string | null;
  notes: string[];
}

function normalizeBusinessName(name: string): string {
  return name
    .replace(/^etusivu\s*/i, "")
    .replace(/^keski\s*/i, "KS Sähköpalvelu ")
    .replace(/^sähköurakointi\s*$/i, "")
    .replace(/^sähkömies,?\s*/i, "")
    .replace(/^pienet sähkötyöt\. se on se meidän juttu\.\s*/i, "")
    .trim();
}

function isDirectoryLikeWebsite(url: string | null): boolean {
  if (!url) return false;
  const blocked = [
    "finder.fi",
    "fonecta.fi",
    "suomenyritysrekisteri.fi",
    "localnow.net",
    "walttia.fi",
    "klinik.fi",
    "hyvaks.fi",
    "puolustusvoimat.fi",
    "sahkomiehet.com",
    "/alueet/",
  ];
  return blocked.some((p) => url.includes(p));
}

function visibilityGapScore(p: {
  website: string | null;
  review_count: number | null;
  google_rating: number | null;
}, painScore: number): { score: number; notes: string[] } {
  let score = 0;
  const notes: string[] = [];
  const reviews = p.review_count ?? 0;
  const rating = p.google_rating ?? 0;

  if (reviews >= 5) {
    score += 2;
    notes.push("Hakemistodatan perusteella yrityksellä on jo näkyvyyttä.");
  }
  if (reviews >= 20) {
    score += 2;
    notes.push("Arvosteluja on runsaasti suhteessa heikkoon verkkosivuun.");
  }
  if (rating >= 4.2 && reviews >= 5) {
    score += 1;
    notes.push("Hyvä maine, mutta verkon konversiopolku voi olla heikko.");
  }
  if (p.website) {
    score += Math.min(4, Math.max(0, painScore - 2));
    notes.push("Nykyisessä sivussa on näkyvää parannusvaraa.");
  } else {
    score += 6;
    notes.push("Yritykseltä puuttuu oma verkkosivu kokonaan.");
  }

  return { score: Math.min(score, 10), notes };
}

function commercialUpsideScore(name: string, painScore: number, fitScore: number): { score: number; notes: string[] } {
  let score = 0;
  const notes: string[] = [];
  const lower = name.toLowerCase();

  const contractorSignals = ["sähkö", "lvi", "putki", "sauma", "urakointi", "asennus", "remontti"];
  if (contractorSignals.some((s) => lower.includes(s))) {
    score += 4;
    notes.push("Toimiala sopii hyvin tarjouspyyntö- ja paikallisnäkyvyysvetoiseen sivustoon.");
  }
  if (painScore >= 5) {
    score += 3;
    notes.push("Nykyinen sivu tai näkyvyys jättää todennäköisesti liidejä pöydälle.");
  }
  if (fitScore >= 8) {
    score += 3;
    notes.push("SiteForge pystyy todennäköisesti parantamaan tätä casea selvästi.");
  }

  return { score: Math.min(score, 10), notes };
}

async function main() {
  const args = process.argv.slice(2);
  let niche = "sahko";
  let city = "Jyväskylä";
  let limit = 20;
  let source: "finder" | "both" = "finder";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--niche") niche = args[++i];
    if (args[i] === "--city") city = args[++i];
    if (args[i] === "--limit") limit = parseInt(args[++i], 10);
    if (args[i] === "--source") source = args[++i] as "finder" | "both";
  }

  console.log(`📒 Directory-first discovery: ${niche} @ ${city} (source: ${source})\n`);

  const raw = await searchProspects({ niche, city, limit, source });
  console.log(`Raw candidates: ${raw.length}\n`);

  const ranked: RankedDirectoryProspect[] = [];

  for (const p of raw) {
    const normalizedName = normalizeBusinessName(p.business_name) || p.business_name;

    const saved = upsertProspect({
      business_name: normalizedName,
      city: p.city,
      address: p.address || undefined,
      phone: p.phone || undefined,
      website: p.website || undefined,
      google_rating: p.google_rating || undefined,
      review_count: p.review_count || undefined,
    });

    if (isDirectoryLikeWebsite(saved.website)) {
      continue;
    }

    let painScore = 0;
    let fitScore = 5;
    let fitStatus = "needs_review";
    let disqualifiedReason: string | null = null;
    const notes: string[] = [];

    if (saved.website) {
      console.log(`━━━ ${saved.business_name} (${saved.website})`);
      try {
        const audit = await auditWebsite(saved.website);
        const pain = calculatePainScore(audit);
        const fit = calculateSiteforgeFit(audit);

        painScore = pain.score;
        fitScore = fit.score;
        fitStatus = fit.fitStatus;
        disqualifiedReason = fit.disqualifiedReason;

        updateProspectAudit(saved.id, {
          screenshot_desktop: audit.screenshots.desktop ?? undefined,
          screenshot_mobile: audit.screenshots.mobile ?? undefined,
          lighthouse_score: null,
          pain_score: pain.score,
          siteforge_fit_score: fit.score,
          fit_status: fit.fitStatus,
          disqualified_reason: fit.disqualifiedReason,
          pain_points: pain.painPoints,
        });

        notes.push(...fit.notes);
      } catch (err) {
        notes.push(`Audit failed: ${(err as Error).message}`);
      }
    } else {
      painScore = 7;
      fitScore = 9;
      fitStatus = "good_fit";
      notes.push("Ei omaa verkkosivua — korkea mahdollinen upside.");
    }

    const visibility = visibilityGapScore(saved, painScore);
    const commercial = commercialUpsideScore(saved.business_name, painScore, fitScore);
    const opportunity = Math.round((visibility.score * 0.45 + fitScore * 0.3 + commercial.score * 0.25) * 10) / 10;

    if (fitStatus === "disqualified") {
      updateProspectStatus(saved.id, "disqualified");
    } else if (opportunity >= 7 && painScore >= 4 && fitScore >= 7) {
      updateProspectStatus(saved.id, "qualified");
    }

    ranked.push({
      id: saved.id,
      business_name: saved.business_name,
      website: saved.website,
      phone: saved.phone,
      address: saved.address,
      review_count: saved.review_count,
      google_rating: saved.google_rating,
      source_type: source,
      visibility_gap_score: visibility.score,
      commercial_upside_score: commercial.score,
      opportunity_score: opportunity,
      pain_score: painScore,
      siteforge_fit_score: fitScore,
      fit_status: fitStatus,
      disqualified_reason: disqualifiedReason,
      notes: [...visibility.notes, ...commercial.notes, ...notes],
    });

    console.log(`  opp=${opportunity} pain=${painScore} fit=${fitScore} visibility=${visibility.score} commercial=${commercial.score}`);
    if (disqualifiedReason) console.log(`  disqualified: ${disqualifiedReason}`);
  }

  ranked.sort((a, b) => b.opportunity_score - a.opportunity_score || b.pain_score - a.pain_score);

  console.log("\n🏆 Top directory-first suggestions:\n");
  for (const r of ranked.slice(0, 10)) {
    console.log(`${r.opportunity_score}/10  ${r.business_name}`);
    console.log(`  fit=${r.siteforge_fit_score} pain=${r.pain_score} visibility=${r.visibility_gap_score} commercial=${r.commercial_upside_score}`);
    console.log(`  reviews=${r.review_count ?? 0} rating=${r.google_rating ?? "—"}`);
    console.log(`  status=${r.fit_status}${r.disqualified_reason ? ` (${r.disqualified_reason})` : ""}`);
    console.log(`  website=${r.website ?? "—"}`);
    console.log(`  phone=${r.phone ?? "—"}`);
    console.log();
  }

  closeDb();
}

main().catch((err) => {
  console.error(err);
  closeDb();
  process.exit(1);
});
