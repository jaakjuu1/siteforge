#!/usr/bin/env tsx
import { listProspects, updateProspectAudit, updateProspectStatus } from "../crm/pipeline.js";
import { closeDb } from "../crm/db.js";
import { auditWebsite } from "./audit.js";
import { calculatePainScore, calculateSiteforgeFit } from "./score.js";
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.resolve("data");
const EXCEL_PATH = path.join(OUTPUT_DIR, "siteforge-prospects.xlsx");
const city = process.argv.includes("--city") ? process.argv[process.argv.indexOf("--city") + 1] : "Oulu";

interface ProspectRow {
  id: number;
  business_name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  pain_score: number;
  siteforge_fit_score: number;
  fit_status: string;
  disqualified_reason: string;
  pain_points: string;
  has_https: string;
  has_mobile_cta: string;
  has_contact_form: string;
  has_booking: string;
  has_schema: string;
  has_google_maps: string;
  has_click_to_call: string;
  has_ecommerce: string;
  has_portal: string;
  location_count: number;
  load_time_ms: number;
  page_title: string;
  business_description: string;
  status: string;
  notes: string;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const prospects = listProspects({ city, status: "found" });
  console.log(`\n🔍 Full Discovery Pipeline — ${prospects.length} prospects to audit in ${city}\n`);

  const rows: ProspectRow[] = [];

  for (const p of prospects) {
    if (!p.website) continue;
    console.log(`\n━━━ ${p.business_name} (${p.website}) ━━━`);

    try {
      const audit = await auditWebsite(p.website);
      const pain = calculatePainScore(audit);
      const fit = calculateSiteforgeFit(audit);
      const content = audit.checks.textContent ?? "";

      updateProspectAudit(p.id, {
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
        updateProspectStatus(p.id, "disqualified");
      } else if (pain.score >= 5 && fit.score >= 7) {
        updateProspectStatus(p.id, "qualified");
      }

      rows.push({
        id: p.id,
        business_name: p.business_name,
        city: p.city,
        address: p.address ?? "",
        phone: p.phone ?? "",
        email: p.email ?? "",
        website: p.website,
        pain_score: pain.score,
        siteforge_fit_score: fit.score,
        fit_status: fit.fitStatus,
        disqualified_reason: fit.disqualifiedReason ?? "",
        pain_points: pain.painPoints.join(" | "),
        has_https: audit.checks.hasHttps ? "✅" : "❌",
        has_mobile_cta: audit.checks.hasMobileCTA ? "✅" : "❌",
        has_contact_form: audit.checks.hasContactForm ? "✅" : "❌",
        has_booking: audit.checks.hasBookingWidget ? "✅" : "❌",
        has_schema: audit.checks.hasSchemaOrg ? "✅" : "❌",
        has_google_maps: audit.checks.hasGoogleMaps ? "✅" : "❌",
        has_click_to_call: audit.checks.hasClickToCall ? "✅" : "❌",
        has_ecommerce: audit.checks.hasEcommerce ? "✅" : "❌",
        has_portal: audit.checks.hasPortalOrMemberArea ? "✅" : "❌",
        location_count: audit.checks.locationCount,
        load_time_ms: audit.checks.mobileLoadTimeMs,
        page_title: audit.checks.pageTitle,
        business_description: content.slice(0, 300),
        status: fit.fitStatus === "disqualified" ? "disqualified" : pain.score >= 5 && fit.score >= 7 ? "qualified" : "found",
        notes: fit.notes.join(" | "),
      });

      console.log(`  📊 Pain: ${pain.score}/10`);
      console.log(`  🎯 SiteForge fit: ${fit.score}/10 (${fit.fitStatus})`);
      if (fit.disqualifiedReason) console.log(`  ⛔ Reason: ${fit.disqualifiedReason}`);
    } catch (err) {
      console.log(`  ❌ ${(err as Error).message}`);
    }
  }

  rows.sort((a, b) => b.siteforge_fit_score - a.siteforge_fit_score || b.pain_score - a.pain_score);

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Prospects");
  XLSX.writeFile(wb, EXCEL_PATH);

  console.log(`\n✅ Exported: ${EXCEL_PATH}`);
  console.log(`Qualified: ${rows.filter((r) => r.status === "qualified").length}`);
  console.log(`Disqualified: ${rows.filter((r) => r.status === "disqualified").length}`);

  closeDb();
}

main();
