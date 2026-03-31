#!/usr/bin/env tsx

import { searchProspects } from "./search.js";
import { closeDb, getDb } from "../crm/db.js";
import { auditWebsite } from "./audit.js";
import { calculatePainScore, calculateSiteforgeFit } from "./score.js";
import { upsertProspect, updateProspectAudit, updateProspectStatus } from "../crm/pipeline.js";

interface RankedProspect {
  id: number;
  business_name: string;
  city: string;
  website: string | null;
  address: string | null;
  phone: string | null;
  google_rating: number | null;
  review_count: number | null;
  visibility_gap_score: number;
  commercial_upside_score: number;
  opportunity_score: number;
  pain_score: number;
  siteforge_fit_score: number;
  fit_status: string;
  disqualified_reason: string | null;
  notes: string[];
}

function normalizeName(name: string): string {
  return name
    .replace(/^etusivu\s*/i, "")
    .replace(/^keski\s*/i, "")
    .replace(/^sähköurakointi\s*/i, "")
    .replace(/^sähkömies,?\s*/i, "")
    .trim();
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
    notes.push("Yrityksellä on jo jonkin verran näkyvyyttä Mapsissa / arvosteluja.");
  }
  if (reviews >= 20) {
    score += 2;
    notes.push("Arvosteluja on runsaasti suhteessa heikkoon web-konversioon.");
  }
  if (rating >= 4.2 && reviews >= 5) {
    score += 1;
    notes.push("Hyvä maine, mutta verkkosivu ei välttämättä tue sitä tarpeeksi.");
  }
  if (p.website) {
    score += Math.min(4, Math.max(0, painScore - 2));
    notes.push("Yrityksellä on sivu, mutta siinä on näkyvä parannusvara.");
  } else {
    score += 6;
    notes.push("Yritykseltä puuttuu verkkosivu kokonaan.");
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
    notes.push("Toimiala sopii hyvin tarjouspyyntö- ja luottamuspohjaiseen verkkosivuun.");
  }

  if (painScore >= 5) {
    score += 3;
    notes.push("Nykyinen sivu jättää todennäköisesti liidejä pöydälle.");
  }

  if (fitScore >= 8) {
    score += 3;
    notes.push("SiteForge pystyy todennäköisesti parantamaan tätä tapausta selvästi.");
  }

  return { score: Math.min(score, 10), notes };
}

async function main() {
  const args = process.argv.slice(2);
  let niche = "sahko";
  let city = "Jyväskylä";
  let limit = 20;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--niche") niche = args[++i];
    if (args[i] === "--city") city = args[++i];
    if (args[i] === "--limit") limit = parseInt(args[++i], 10);
  }

  console.log(`🗺️ Maps-first discovery: ${niche} @ ${city}\n`);

  const raw = await searchProspects({ niche, city, limit, source: "both" });
  const db = getDb();

  const badWebsitePatterns = [
    "finder.fi",
    "fonecta.fi",
    "yritysrekisteri",
    "localnow.net",
    "walttia.fi",
    "klinik.fi",
    "hyvaks.fi",
    "puolustusvoimat.fi",
    "/alueet/",
  ];

  const filtered = raw.filter((p) => {
    const url = p.website ?? "";
    if (!url) return true;
    return !badWebsitePatterns.some((pat) => url.includes(pat));
  });

  const ranked: RankedProspect[] = [];

  for (const p of filtered) {
    const saved = upsertProspect({
      business_name: normalizeName(p.business_name),
      city: p.city,
      address: p.address || undefined,
      phone: p.phone || undefined,
      website: p.website || undefined,
      google_rating: p.google_rating || undefined,
      review_count: p.review_count || undefined,
    });

    if (!p.website) continue;

    console.log(`━━━ ${saved.business_name} (${p.website})`);
    try {
      const audit = await auditWebsite(p.website);
      const pain = calculatePainScore(audit);
      const fit = calculateSiteforgeFit(audit);

      const visibility = visibilityGapScore(saved, pain.score);
      const commercial = commercialUpsideScore(saved.business_name, pain.score, fit.score);
      const opportunity = Math.round((visibility.score * 0.4 + fit.score * 0.35 + commercial.score * 0.25) * 10) / 10;

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

      if (fit.fitStatus === "disqualified") {
        updateProspectStatus(saved.id, "disqualified");
      } else if (opportunity >= 7 && pain.score >= 4 && fit.score >= 7) {
        updateProspectStatus(saved.id, "qualified");
      }

      ranked.push({
        id: saved.id,
        business_name: saved.business_name,
        city: saved.city,
        website: saved.website,
        address: saved.address,
        phone: saved.phone,
        google_rating: saved.google_rating,
        review_count: saved.review_count,
        visibility_gap_score: visibility.score,
        commercial_upside_score: commercial.score,
        opportunity_score: opportunity,
        pain_score: pain.score,
        siteforge_fit_score: fit.score,
        fit_status: fit.fitStatus,
        disqualified_reason: fit.disqualifiedReason,
        notes: [...visibility.notes, ...commercial.notes, ...fit.notes],
      });

      console.log(`  pain=${pain.score} fit=${fit.score} visibility=${visibility.score} commercial=${commercial.score} opp=${opportunity}`);
      if (fit.disqualifiedReason) console.log(`  disqualified: ${fit.disqualifiedReason}`);
    } catch (err) {
      console.log(`  ❌ ${(err as Error).message}`);
    }
  }

  ranked.sort((a, b) => b.opportunity_score - a.opportunity_score || b.pain_score - a.pain_score);

  console.log("\n🏆 Top suggestions:\n");
  for (const r of ranked.slice(0, 8)) {
    console.log(`${r.opportunity_score}/10  ${r.business_name}`);
    console.log(`  fit=${r.siteforge_fit_score} pain=${r.pain_score} visibility=${r.visibility_gap_score} commercial=${r.commercial_upside_score}`);
    console.log(`  reviews=${r.review_count ?? 0} rating=${r.google_rating ?? "—"}`);
    console.log(`  status=${r.fit_status}${r.disqualified_reason ? ` (${r.disqualified_reason})` : ""}`);
    console.log(`  ${r.website ?? "—"}`);
    console.log();
  }

  closeDb();
}

main().catch((err) => {
  console.error(err);
  closeDb();
  process.exit(1);
});
