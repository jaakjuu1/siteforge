/**
 * SiteForge Prospector — Full pipeline CLI
 *
 * Usage:
 *   tsx src/pipeline/prospector/index.ts --niche kampaamo --city Oulu [--limit 20] [--audit] [--source google|finder|both]
 *
 * Steps:
 *   1. Search for businesses (Google Places / Finder.fi)
 *   2. Save to CRM
 *   3. Optionally: screenshot + audit + score each prospect
 */

import { searchProspects, saveProspectsToCrm } from "./search.js";
import { takeScreenshots } from "./screenshot.js";
import { auditWebsite } from "./audit.js";
import { calculatePainScore } from "./score.js";
import { generateMarkdownReport, saveReport } from "./report.js";
import {
  getProspect,
  updateProspectAudit,
  updateProspectStatus,
  listProspects,
  getPipelineStats,
} from "../crm/pipeline.js";
import { closeDb } from "../crm/db.js";

async function main() {
  const args = process.argv.slice(2);
  let niche = "kampaamo";
  let city = "Oulu";
  let limit = 20;
  let runAudit = false;
  let source: "google" | "finder" | "both" = "both";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--niche":
        niche = args[++i];
        break;
      case "--city":
        city = args[++i];
        break;
      case "--limit":
        limit = parseInt(args[++i], 10);
        break;
      case "--audit":
        runAudit = true;
        break;
      case "--source":
        source = args[++i] as "google" | "finder" | "both";
        break;
      case "--help":
        console.log("Usage: tsx src/pipeline/prospector/index.ts [options]");
        console.log("");
        console.log("Options:");
        console.log("  --niche <name>    Niche to search (kampaamo, ravintola, autokorjaamo, hammaslääkäri)");
        console.log("  --city <name>     City to search in (default: Oulu)");
        console.log("  --limit <n>       Max results (default: 20)");
        console.log("  --source <type>   google, finder, or both (default: both)");
        console.log("  --audit           Run screenshots + Lighthouse + scoring");
        console.log("  --help            Show this help");
        process.exit(0);
    }
  }

  try {
    // Step 1: Search
    console.log(`\n🔍 Searching: ${niche} in ${city} (limit: ${limit})...\n`);
    const prospects = await searchProspects({ niche, city, limit, source });
    console.log(`Found ${prospects.length} prospects\n`);

    // Step 2: Save to CRM
    saveProspectsToCrm(prospects);
    console.log(`💾 Saved to CRM\n`);

    // Step 3: Audit (if requested)
    if (runAudit) {
      const crmProspects = listProspects({ city });

      for (const prospect of crmProspects) {
        if (!prospect.website) {
          console.log(`⏭️  ${prospect.business_name} — no website, skipping audit`);
          continue;
        }

        console.log(`\n📊 Auditing: ${prospect.business_name} (${prospect.website})...`);

        try {
          // Screenshots
          console.log("  📸 Taking screenshots...");
          const screenshots = await takeScreenshots(prospect.website);

          // Lighthouse + custom checks
          console.log("  🔍 Running audit...");
          const audit = await auditWebsite(prospect.website);

          // Scoring
          const score = calculatePainScore(audit);

          // Update CRM
          updateProspectAudit(prospect.id, {
            screenshot_desktop: screenshots.desktop,
            screenshot_mobile: screenshots.mobile,
            lighthouse_score: audit.lighthouse?.performance ?? null ?? undefined,
            pain_score: score.score,
            pain_points: score.painPoints,
          });

          if (score.score >= 6) {
            updateProspectStatus(prospect.id, "qualified");
          }

          // Generate report
          const report = generateMarkdownReport({
            businessName: prospect.business_name,
            website: prospect.website,
            audit,
            score,
            screenshotDesktop: screenshots.desktop,
            screenshotMobile: screenshots.mobile,
          });
          const reportPath = saveReport(report, prospect.business_name);

          console.log(`  ✅ Score: ${score.score}/10 | Report: ${reportPath}`);
          if (score.painPoints.length > 0) {
            for (const pp of score.painPoints) {
              console.log(`     - ${pp}`);
            }
          }
        } catch (err) {
          console.error(`  ❌ Audit failed: ${(err as Error).message}`);
        }
      }
    }

    // Summary
    const stats = getPipelineStats();
    console.log("\n📊 Pipeline Stats:");
    for (const [status, count] of Object.entries(stats)) {
      if (count > 0) console.log(`  ${status}: ${count}`);
    }
  } catch (err) {
    console.error("Pipeline failed:", err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
