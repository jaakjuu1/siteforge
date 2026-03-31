#!/usr/bin/env tsx
/**
 * Full Discovery Pipeline
 * 
 * Audits all prospects, extracts siteforge-ready data, exports to Excel.
 * The Excel becomes the master list for:
 *   1. Discovery pipeline (adds new rows)
 *   2. SiteForge pipeline (marks demo_created)  
 *   3. Sales pipeline (marks outreach_sent, replied, closed)
 *
 * Usage:
 *   npx tsx src/pipeline/prospector/full-discovery.ts
 *   npx tsx src/pipeline/prospector/full-discovery.ts --city Oulu --niche kampaamo
 */

import { listProspects, updateProspectAudit, updateProspectStatus } from "../crm/pipeline.js";
import { closeDb } from "../crm/db.js";
import { auditWebsite } from "./audit.js";
import { calculatePainScore } from "./score.js";
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.resolve("data");
const EXCEL_PATH = path.join(OUTPUT_DIR, "siteforge-prospects.xlsx");

interface ProspectRow {
  // Identity
  id: number;
  business_name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  
  // Audit
  pain_score: number;
  pain_points: string;
  has_https: string;
  has_mobile_cta: string;
  has_contact_form: string;
  has_booking: string;
  has_schema: string;
  has_google_maps: string;
  has_click_to_call: string;
  load_time_ms: number;
  
  // Content extracted (for siteforge config)
  page_title: string;
  business_description: string;
  services_found: string;
  pricing_found: string;
  hours_found: string;
  staff_found: string;
  
  // Screenshots
  screenshot_desktop: string;
  screenshot_mobile: string;
  
  // Pipeline status
  status: string;
  demo_url: string;
  demo_created_at: string;
  outreach_sent_at: string;
  outreach_variant: string;
  replied: string;
  closed: string;
  
  // SiteForge config readiness
  config_ready: string;
  notes: string;
}

/**
 * Extract structured business data from page text content.
 */
function extractBusinessData(text: string): {
  description: string;
  services: string;
  pricing: string;
  hours: string;
  staff: string;
} {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  let description = "";
  let services: string[] = [];
  let pricing: string[] = [];
  let hours: string[] = [];
  let staff: string[] = [];

  // Extract description (first meaningful paragraph)
  for (const line of lines) {
    if (line.length > 40 && !line.includes("€") && !line.match(/^\d{1,2}[:.]/)) {
      description = line;
      break;
    }
  }

  // Extract pricing (lines with €)
  for (const line of lines) {
    if (line.includes("€")) {
      pricing.push(line);
    }
  }

  // Extract hours (lines with time patterns)
  for (const line of lines) {
    if (line.match(/(ma|ti|ke|to|pe|la|su|maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai)/i) &&
        line.match(/\d{1,2}[:.]\d{2}/)) {
      hours.push(line);
    }
  }

  // Extract service names (lines before € prices, or section headers)
  const serviceKeywords = ["leikkaus", "värjäys", "kampaus", "hoito", "parturi", "raidat", "permanentti", "meikki"];
  for (const line of lines) {
    if (serviceKeywords.some(kw => line.toLowerCase().includes(kw)) && line.length < 80 && !line.includes("€")) {
      services.push(line);
    }
  }

  // Extract staff names
  const staffPatterns = /(?:terveisin|kampaaja|parturi|stylist)[,:]?\s*([A-ZÄÖÅ][a-zäöå]+(?:\s+(?:ja|&)\s+[A-ZÄÖÅ][a-zäöå]+)*)/gi;
  let match;
  while ((match = staffPatterns.exec(text)) !== null) {
    staff.push(match[1]);
  }

  return {
    description: description.slice(0, 500),
    services: [...new Set(services)].slice(0, 10).join(" | "),
    pricing: pricing.slice(0, 15).join(" | "),
    hours: hours.join(" | "),
    staff: [...new Set(staff)].join(", "),
  };
}

/**
 * Extract email from page content.
 */
function extractEmail(text: string): string {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return emailMatch?.[0] ?? "";
}

/**
 * Extract phone from page content.
 */
function extractPhone(text: string): string {
  const phoneMatch = text.match(/(\+358\s?\d{1,3}\s?\d{3,4}\s?\d{2,4}|0\d{1,3}[\s-]?\d{3,4}[\s-]?\d{2,4})/);
  return phoneMatch?.[0]?.replace(/\s+/g, " ") ?? "";
}

/**
 * Extract address from page content.
 */
function extractAddress(text: string): string {
  // Finnish address: street name + number, postal code + city
  const addressMatch = text.match(/([A-ZÄÖÅ][a-zäöå]+(?:katu|tie|polku|väylä|kaari|kuja)\s+\d+[a-zA-Z]?(?:\s*,?\s*\d{5}\s+[A-ZÄÖÅ][a-zäöå]+)?)/);
  return addressMatch?.[0] ?? "";
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const prospects = listProspects({ city: "Oulu", status: "found" });
  console.log(`\n🔍 Full Discovery Pipeline — ${prospects.length} prospects to audit\n`);
  
  const rows: ProspectRow[] = [];
  
  for (const p of prospects) {
    if (!p.website) {
      console.log(`⏭️  Skipping ${p.business_name} (no website)`);
      continue;
    }
    
    console.log(`\n━━━ ${p.business_name} (${p.website}) ━━━`);
    
    try {
      // Full audit
      const audit = await auditWebsite(p.website);
      const { score, painPoints } = calculatePainScore(audit);
      
      // Extract business data from content
      const content = audit.checks.textContent ?? "";
      const bizData = extractBusinessData(content);
      const email = extractEmail(content) || p.email || "";
      const phone = extractPhone(content) || p.phone || "";
      const address = extractAddress(content) || p.address || "";
      
      // Update CRM
      updateProspectAudit(p.id, {
        screenshot_desktop: audit.screenshots.desktop,
        screenshot_mobile: audit.screenshots.mobile,
        lighthouse_score: null,
        pain_score: score,
        pain_points: JSON.stringify(painPoints.map(pp => {
          // Store short keys instead of long Finnish text
          if (pp.includes("CTA")) return "no_mobile_cta";
          if (pp.includes("lomake")) return "no_contact_form";
          if (pp.includes("HTTPS")) return "no_https";
          if (pp.includes("Schema")) return "no_schema";
          if (pp.includes("Maps")) return "no_google_maps";
          if (pp.includes("hitaasti")) return "slow_mobile";
          return pp;
        })),
      });
      
      if (score >= 5) {
        updateProspectStatus(p.id, "qualified");
      }
      
      const isConfigReady = !!(bizData.description && (bizData.services || bizData.pricing));
      
      rows.push({
        id: p.id,
        business_name: p.business_name,
        city: p.city,
        address,
        phone,
        email,
        website: p.website,
        pain_score: score,
        pain_points: painPoints.join(" | "),
        has_https: audit.checks.hasHttps ? "✅" : "❌",
        has_mobile_cta: audit.checks.hasMobileCTA ? "✅" : "❌",
        has_contact_form: audit.checks.hasContactForm ? "✅" : "❌",
        has_booking: audit.checks.hasBookingWidget ? "✅" : "❌",
        has_schema: audit.checks.hasSchemaOrg ? "✅" : "❌",
        has_google_maps: audit.checks.hasGoogleMaps ? "✅" : "❌",
        has_click_to_call: audit.checks.hasClickToCall ? "✅" : "❌",
        load_time_ms: audit.checks.mobileLoadTimeMs,
        page_title: audit.checks.pageTitle,
        business_description: bizData.description,
        services_found: bizData.services,
        pricing_found: bizData.pricing,
        hours_found: bizData.hours,
        staff_found: bizData.staff,
        screenshot_desktop: audit.screenshots.desktop ?? "",
        screenshot_mobile: audit.screenshots.mobile ?? "",
        status: score >= 5 ? "qualified" : "found",
        demo_url: "",
        demo_created_at: "",
        outreach_sent_at: "",
        outreach_variant: "",
        replied: "",
        closed: "",
        config_ready: isConfigReady ? "✅" : "❌",
        notes: audit.errors.length > 0 ? audit.errors.join("; ") : "",
      });
      
      console.log(`  📊 Pain Score: ${score}/10 ${score >= 5 ? "✅ QUALIFIED" : "⚪ Below threshold"}`);
      console.log(`  📧 Email: ${email || "not found"}`);
      console.log(`  📞 Phone: ${phone || "not found"}`);
      console.log(`  📍 Address: ${address || "not found"}`);
      console.log(`  🔧 Config ready: ${isConfigReady ? "YES" : "NO"}`);
      
    } catch (err) {
      console.error(`  ❌ Error: ${(err as Error).message}`);
      rows.push({
        id: p.id,
        business_name: p.business_name,
        city: p.city,
        address: p.address ?? "",
        phone: p.phone ?? "",
        email: p.email ?? "",
        website: p.website,
        pain_score: 0,
        pain_points: "",
        has_https: "",
        has_mobile_cta: "",
        has_contact_form: "",
        has_booking: "",
        has_schema: "",
        has_google_maps: "",
        has_click_to_call: "",
        load_time_ms: 0,
        page_title: "",
        business_description: "",
        services_found: "",
        pricing_found: "",
        hours_found: "",
        staff_found: "",
        screenshot_desktop: "",
        screenshot_mobile: "",
        status: "error",
        demo_url: "",
        demo_created_at: "",
        outreach_sent_at: "",
        outreach_variant: "",
        replied: "",
        closed: "",
        config_ready: "❌",
        notes: (err as Error).message,
      });
    }
    
    // Be nice to servers
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Sort by pain score descending
  rows.sort((a, b) => b.pain_score - a.pain_score);
  
  // Export to Excel
  console.log(`\n📊 Exporting ${rows.length} rows to Excel...`);
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  
  // Set column widths
  ws["!cols"] = [
    { wch: 5 },   // id
    { wch: 25 },  // business_name
    { wch: 10 },  // city
    { wch: 30 },  // address
    { wch: 18 },  // phone
    { wch: 25 },  // email
    { wch: 35 },  // website
    { wch: 8 },   // pain_score
    { wch: 50 },  // pain_points
    { wch: 6 },   // has_https
    { wch: 6 },   // has_mobile_cta
    { wch: 6 },   // has_contact_form
    { wch: 6 },   // has_booking
    { wch: 6 },   // has_schema
    { wch: 6 },   // has_google_maps
    { wch: 6 },   // has_click_to_call
    { wch: 10 },  // load_time_ms
    { wch: 40 },  // page_title
    { wch: 60 },  // business_description
    { wch: 50 },  // services_found
    { wch: 50 },  // pricing_found
    { wch: 30 },  // hours_found
    { wch: 20 },  // staff_found
    { wch: 50 },  // screenshot_desktop
    { wch: 50 },  // screenshot_mobile
    { wch: 12 },  // status
    { wch: 40 },  // demo_url
    { wch: 15 },  // demo_created_at
    { wch: 15 },  // outreach_sent_at
    { wch: 12 },  // outreach_variant
    { wch: 6 },   // replied
    { wch: 6 },   // closed
    { wch: 8 },   // config_ready
    { wch: 40 },  // notes
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, "Prospects");
  
  // Add summary sheet
  const qualified = rows.filter(r => r.status === "qualified");
  const summary = [
    { metric: "Total Prospects", value: rows.length },
    { metric: "Qualified (score >= 5)", value: qualified.length },
    { metric: "Config Ready", value: rows.filter(r => r.config_ready === "✅").length },
    { metric: "With Email", value: rows.filter(r => r.email).length },
    { metric: "With Phone", value: rows.filter(r => r.phone).length },
    { metric: "Avg Pain Score", value: rows.length > 0 ? (rows.reduce((s, r) => s + r.pain_score, 0) / rows.length).toFixed(1) : 0 },
    { metric: "No HTTPS", value: rows.filter(r => r.has_https === "❌").length },
    { metric: "No Mobile CTA", value: rows.filter(r => r.has_mobile_cta === "❌").length },
    { metric: "No Contact Form", value: rows.filter(r => r.has_contact_form === "❌").length },
  ];
  const summaryWs = XLSX.utils.json_to_sheet(summary);
  summaryWs["!cols"] = [{ wch: 25 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
  
  XLSX.writeFile(wb, EXCEL_PATH);
  console.log(`\n✅ Excel saved: ${EXCEL_PATH}`);
  
  // Print summary
  console.log(`\n📋 Summary:`);
  console.log(`   Total: ${rows.length}`);
  console.log(`   Qualified: ${qualified.length}`);
  console.log(`   Config Ready: ${rows.filter(r => r.config_ready === "✅").length}`);
  console.log(`   With email: ${rows.filter(r => r.email).length}`);
  
  closeDb();
}

main().catch(console.error);
