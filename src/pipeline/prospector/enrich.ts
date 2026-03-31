#!/usr/bin/env tsx
/**
 * Enrich prospects with deep data via Firecrawl + Perplexity.
 * 
 * Layer 1: PinchTab (already done in audit)
 * Layer 2: Firecrawl — crawl full site, extract contacts from all pages
 * Layer 3: Perplexity — web search for missing email/phone/address
 * 
 * Usage:
 *   npx tsx src/pipeline/prospector/enrich.ts
 *   npx tsx src/pipeline/prospector/enrich.ts --prospect-id 3
 */

import { listProspects, getProspect, upsertProspect } from "../crm/pipeline.js";
import { getDb } from "../crm/db.js";
import { closeDb } from "../crm/db.js";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? "";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY ?? "";
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

// ─── Firecrawl ──────────────────────────────────────────

interface FirecrawlPage {
  url: string;
  markdown: string;
  metadata?: {
    title?: string;
    description?: string;
    ogTitle?: string;
  };
}

async function firecrawlScrape(url: string): Promise<FirecrawlPage | null> {
  if (!FIRECRAWL_API_KEY) {
    console.warn("  ⚠️ FIRECRAWL_API_KEY not set");
    return null;
  }

  try {
    const resp = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: false, // Get everything including footer
      }),
    });

    if (!resp.ok) {
      console.warn(`  ⚠️ Firecrawl scrape failed: ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    if (!data.success) return null;

    return {
      url: data.data?.url ?? url,
      markdown: data.data?.markdown ?? "",
      metadata: data.data?.metadata,
    };
  } catch (err) {
    console.warn(`  ⚠️ Firecrawl error: ${(err as Error).message}`);
    return null;
  }
}

async function firecrawlCrawl(baseUrl: string, limit = 10): Promise<FirecrawlPage[]> {
  if (!FIRECRAWL_API_KEY) return [];

  try {
    // Start crawl
    const resp = await fetch(`${FIRECRAWL_BASE}/crawl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url: baseUrl,
        limit,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: false,
        },
      }),
    });

    if (!resp.ok) {
      console.warn(`  ⚠️ Firecrawl crawl start failed: ${resp.status}`);
      return [];
    }

    const startData = await resp.json();
    if (!startData.success || !startData.id) return [];

    // Poll for results
    const crawlId = startData.id;
    console.log(`  🕷️ Crawl started (${crawlId}), polling...`);

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));

      const statusResp = await fetch(`${FIRECRAWL_BASE}/crawl/${crawlId}`, {
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
      });

      if (!statusResp.ok) continue;
      const statusData = await statusResp.json();

      if (statusData.status === "completed") {
        console.log(`  ✅ Crawl complete: ${statusData.data?.length ?? 0} pages`);
        return (statusData.data ?? []).map((d: any) => ({
          url: d.url ?? "",
          markdown: d.markdown ?? "",
          metadata: d.metadata,
        }));
      }

      if (statusData.status === "failed") {
        console.warn(`  ⚠️ Crawl failed`);
        return [];
      }
    }

    console.warn("  ⚠️ Crawl timed out");
    return [];
  } catch (err) {
    console.warn(`  ⚠️ Firecrawl crawl error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Data Extraction ──────────────────────────────────

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  // Filter out common false positives
  return [...new Set(matches)].filter(
    (e) => !e.includes("example.com") && !e.includes("sentry") && !e.includes("webpack"),
  );
}

function extractPhones(text: string): string[] {
  const matches = text.match(/(\+358\s?\d{1,3}\s?\d{3,4}\s?\d{2,4}|0\d{1,3}[\s-]?\d{3,4}[\s-]?\d{2,4})/g) ?? [];
  return [...new Set(matches.map((p) => p.replace(/[\s-]+/g, " ").trim()))];
}

function extractAddresses(text: string): string[] {
  const matches =
    text.match(
      /[A-ZÄÖÅ][a-zäöå]+(?:katu|tie|polku|väylä|kaari|kuja|tori|aukio)\s+\d+[a-zA-Z]?(?:\s*,?\s*\d{5}\s+[A-ZÄÖÅ][a-zäöåÄÖÅ]+)?/g,
    ) ?? [];
  return [...new Set(matches)];
}

function extractSocialLinks(text: string): Record<string, string> {
  const socials: Record<string, string> = {};
  const fbMatch = text.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9.]+/);
  if (fbMatch) socials.facebook = fbMatch[0];
  const igMatch = text.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/);
  if (igMatch) socials.instagram = igMatch[0];
  return socials;
}

function extractHours(text: string): string[] {
  const lines = text.split("\n");
  const hourLines: string[] = [];
  for (const line of lines) {
    if (
      line.match(
        /(ma|ti|ke|to|pe|la|su|maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai)/i,
      ) &&
      line.match(/\d{1,2}[:.]\d{2}/)
    ) {
      hourLines.push(line.trim());
    }
  }
  return hourLines;
}

// ─── Perplexity Enrichment ─────────────────────────────

async function perplexityEnrich(
  businessName: string,
  city: string,
): Promise<{ email?: string; phone?: string; address?: string }> {
  if (!PERPLEXITY_API_KEY) {
    console.warn("  ⚠️ PERPLEXITY_API_KEY not set");
    return {};
  }

  try {
    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "user",
            content: `Find the email address, phone number, and street address for "${businessName}" in ${city}, Finland. Return ONLY a JSON object with keys: email, phone, address. If not found, use null.`,
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!resp.ok) {
      console.warn(`  ⚠️ Perplexity failed: ${resp.status}`);
      return {};
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return {};
      }
    }
    return {};
  } catch (err) {
    console.warn(`  ⚠️ Perplexity error: ${(err as Error).message}`);
    return {};
  }
}

// ─── Main Enrichment Pipeline ──────────────────────────

async function enrichProspect(prospectId: number) {
  const db = getDb();
  const prospect = db
    .prepare("SELECT * FROM prospects WHERE id = ?")
    .get(prospectId) as any;

  if (!prospect) {
    console.error(`❌ Prospect ${prospectId} not found`);
    return;
  }

  console.log(`\n━━━ Enriching: ${prospect.business_name} (${prospect.website}) ━━━`);

  let allText = "";
  let emails: string[] = [];
  let phones: string[] = [];
  let addresses: string[] = [];
  let hours: string[] = [];
  let socials: Record<string, string> = {};

  // Layer 2: Firecrawl — crawl full site
  console.log("  🕷️ Firecrawl: crawling site...");
  const pages = await firecrawlCrawl(prospect.website, 8);

  if (pages.length > 0) {
    for (const page of pages) {
      allText += "\n" + page.markdown;
      emails.push(...extractEmails(page.markdown));
      phones.push(...extractPhones(page.markdown));
      addresses.push(...extractAddresses(page.markdown));
      hours.push(...extractHours(page.markdown));
      Object.assign(socials, extractSocialLinks(page.markdown));
    }
    console.log(`  📄 ${pages.length} pages crawled`);
  } else {
    // Fallback: scrape just homepage + yhteystiedot
    console.log("  📄 Crawl failed, trying single scrape...");
    const homePage = await firecrawlScrape(prospect.website);
    if (homePage) {
      allText += homePage.markdown;
      emails.push(...extractEmails(homePage.markdown));
      phones.push(...extractPhones(homePage.markdown));
      addresses.push(...extractAddresses(homePage.markdown));
      hours.push(...extractHours(homePage.markdown));
      Object.assign(socials, extractSocialLinks(homePage.markdown));
    }

    // Try yhteystiedot page
    const contactUrl = prospect.website.replace(/\/$/, "") + "/yhteystiedot";
    const contactPage = await firecrawlScrape(contactUrl);
    if (contactPage) {
      allText += contactPage.markdown;
      emails.push(...extractEmails(contactPage.markdown));
      phones.push(...extractPhones(contactPage.markdown));
      addresses.push(...extractAddresses(contactPage.markdown));
    }
  }

  // Deduplicate
  emails = [...new Set(emails)];
  phones = [...new Set(phones)];
  addresses = [...new Set(addresses)];
  hours = [...new Set(hours)];

  console.log(`  📧 Emails: ${emails.length > 0 ? emails.join(", ") : "none"}`);
  console.log(`  📞 Phones: ${phones.length > 0 ? phones.join(", ") : "none"}`);
  console.log(`  📍 Addresses: ${addresses.length > 0 ? addresses.join(", ") : "none"}`);

  // Layer 3: Perplexity if still missing key data
  if (emails.length === 0 || phones.length === 0) {
    console.log("  🔍 Perplexity: searching for missing data...");
    const pplx = await perplexityEnrich(prospect.business_name, prospect.city);
    if (pplx.email && !emails.includes(pplx.email)) emails.push(pplx.email);
    if (pplx.phone && !phones.includes(pplx.phone)) phones.push(pplx.phone);
    if (pplx.address && addresses.length === 0) addresses.push(pplx.address);
    console.log(`  🔍 Perplexity: email=${pplx.email ?? "—"}, phone=${pplx.phone ?? "—"}`);
  }

  // Update CRM
  const updateFields: Record<string, any> = {};
  if (emails.length > 0 && !prospect.email) updateFields.email = emails[0];
  if (phones.length > 0 && !prospect.phone) updateFields.phone = phones[0];
  if (addresses.length > 0 && !prospect.address) updateFields.address = addresses[0];

  if (Object.keys(updateFields).length > 0) {
    const sets = Object.entries(updateFields)
      .map(([k]) => `${k} = ?`)
      .join(", ");
    db.prepare(`UPDATE prospects SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(
      ...Object.values(updateFields),
      prospectId,
    );
    console.log(`  ✅ Updated CRM: ${Object.keys(updateFields).join(", ")}`);
  } else {
    console.log("  ℹ️ No new data to update");
  }

  return {
    emails,
    phones,
    addresses,
    hours,
    socials,
    pagesScraped: pages.length,
  };
}

// ─── CLI ───────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let prospectId: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prospect-id") prospectId = parseInt(args[++i], 10);
  }

  if (prospectId) {
    await enrichProspect(prospectId);
  } else {
    // Enrich all prospects with websites but missing email
    const prospects = listProspects({ city: "Oulu" });
    const needsEnrichment = prospects.filter(
      (p) => p.website && (!p.email || !p.phone),
    );
    console.log(`\n📧 Enriching ${needsEnrichment.length} prospects missing email/phone...\n`);

    for (const p of needsEnrichment) {
      await enrichProspect(p.id);
      // Rate limit
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  closeDb();
}

main().catch(console.error);
