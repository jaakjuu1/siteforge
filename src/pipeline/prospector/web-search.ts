#!/usr/bin/env tsx
/**
 * Prospect search using Brave Search API (available via OpenClaw).
 * Falls back to manual entry.
 * 
 * Usage:
 *   tsx src/pipeline/prospector/web-search.ts --niche kampaamo --city Oulu --limit 20
 */

import { upsertProspect, type InsertProspect } from "../crm/pipeline.js";
import { closeDb } from "../crm/db.js";
import { getNiche } from "../config/niches.js";

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

/**
 * Search Brave for local businesses and extract basic info.
 * Since we have Brave API via OpenClaw, this is our primary search method.
 */
async function searchBrave(query: string, limit = 10): Promise<BraveResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    console.warn("⚠️  BRAVE_API_KEY not set, cannot search");
    return [];
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}&country=fi&search_lang=fi`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    console.error(`Brave search failed: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return (data.web?.results ?? []).map((r: any) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

/**
 * Extract business info from search results.
 * Tries to find name, location, phone, website from search snippets.
 */
function extractBusinessInfo(
  result: BraveResult,
  city: string,
): InsertProspect | null {
  // Skip aggregator sites, directories, social media
  const skipDomains = [
    "finder.fi",
    "fonecta.fi",
    "yelp.com",
    "facebook.com",
    "instagram.com",
    "google.com",
    "wikipedia.org",
    "youtube.com",
    "tiktok.com",
    "linkedin.com",
  ];

  try {
    const domain = new URL(result.url).hostname.replace("www.", "");
    if (skipDomains.some((skip) => domain.includes(skip))) return null;
  } catch {
    return null;
  }

  // Extract business name from title (usually "Business Name - tagline" or "Business Name | City")
  let name = result.title
    .split(/[-–|]/)[0]
    .trim()
    .replace(/\s+(Oulu|Helsinki|Tampere|Turku|Jyväskylä).*$/i, "")
    .trim();

  if (name.length < 3 || name.length > 80) return null;

  // Extract phone from description
  const phoneMatch = result.description.match(
    /(\+358\s?\d{1,3}\s?\d{3,4}\s?\d{2,4}|0\d{1,3}[\s-]?\d{3,4}[\s-]?\d{2,4})/,
  );

  return {
    business_name: name,
    city,
    website: result.url,
    phone: phoneMatch?.[0]?.replace(/\s/g, "") ?? undefined,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let niche = "kampaamo";
  let city = "Oulu";
  let limit = 20;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--niche") niche = args[++i];
    if (args[i] === "--city") city = args[++i];
    if (args[i] === "--limit") limit = parseInt(args[++i], 10);
  }

  const nicheConfig = getNiche(niche);
  if (!nicheConfig) {
    console.error(`❌ Unknown niche: ${niche}`);
    console.log("Available: kampaamo, ravintola, autokorjaamo, hammaslääkäri");
    process.exit(1);
  }

  console.log(`🔍 Searching ${niche} in ${city} via Brave...`);

  const allResults: BraveResult[] = [];

  for (const term of nicheConfig.searchTerms) {
    const query = `${term} ${city}`;
    console.log(`  Searching: "${query}"`);
    const results = await searchBrave(query, Math.ceil(limit / nicheConfig.searchTerms.length));
    allResults.push(...results);

    // Rate limit
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Deduplicate by domain
  const seen = new Set<string>();
  const prospects: InsertProspect[] = [];

  for (const result of allResults) {
    try {
      const domain = new URL(result.url).hostname.replace("www.", "");
      if (seen.has(domain)) continue;
      seen.add(domain);

      const info = extractBusinessInfo(result, city);
      if (info) {
        prospects.push(info);
      }
    } catch {
      continue;
    }
  }

  console.log(`\nFound ${prospects.length} unique businesses:\n`);

  for (const p of prospects) {
    console.log(`  📍 ${p.business_name}`);
    console.log(`     🌐 ${p.website}`);
    if (p.phone) console.log(`     📞 ${p.phone}`);
    console.log();

    upsertProspect(p);
  }

  console.log(`✅ Saved ${prospects.length} prospects to CRM`);
  closeDb();
}

main().catch(console.error);
