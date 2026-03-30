#!/usr/bin/env tsx
/**
 * Outreach CLI — send audit emails to qualified prospects.
 * 
 * Usage:
 *   tsx src/pipeline/outreach/index.ts --city Oulu --min-score 6 --dry-run
 *   tsx src/pipeline/outreach/index.ts --prospect-id 5 --variant question --dry-run
 *   tsx src/pipeline/outreach/index.ts --follow-ups
 *   tsx src/pipeline/outreach/index.ts --stats
 */

import { Command } from "commander";
import { listProspects } from "../crm/pipeline.js";
import { closeDb } from "../crm/db.js";
import { buildAuditEmail, getEmailVariants } from "./email-builder.js";
import { sendAuditEmail, sendBatch } from "./sender.js";
import { getFollowUpCandidates, getOutreachStats } from "./tracker.js";
import type { Prospect } from "../crm/schema.js";

const program = new Command();

program
  .name("outreach")
  .description("Send audit emails to qualified prospects")
  .option("--city <city>", "Filter by city")
  .option("--min-score <score>", "Minimum pain score", "6")
  .option("--variant <variant>", "Email variant: direct|question|value", "direct")
  .option("--prospect-id <id>", "Send to specific prospect")
  .option("--max <n>", "Max emails to send", "10")
  .option("--dry-run", "Preview without sending", true)
  .option("--send", "Actually send (overrides dry-run)")
  .option("--follow-ups", "Show follow-up candidates")
  .option("--stats", "Show outreach statistics")
  .parse();

const opts = program.opts();

async function main() {
  try {
    if (opts.stats) {
      const stats = getOutreachStats();
      console.log("\n📊 Outreach Statistics");
      console.log("━".repeat(40));
      console.log(`Contacted:       ${stats.total_contacted}`);
      console.log(`Warm (replied):  ${stats.total_warm}`);
      console.log(`Demo sent:       ${stats.total_demo}`);
      console.log(`Closed:          ${stats.total_closed}`);
      console.log(`Reply rate:      ${stats.reply_rate}`);
      console.log(`Conversion rate: ${stats.conversion_rate}`);
      return;
    }

    if (opts.followUps) {
      const candidates = getFollowUpCandidates(3);
      if (candidates.length === 0) {
        console.log("✅ No follow-up candidates (all replied or too recent)");
        return;
      }
      console.log(`\n📬 Follow-up candidates (${candidates.length}):`);
      for (const p of candidates) {
        console.log(`  [${p.id}] ${p.business_name} (${p.city}) — contacted ${p.updated_at}`);
      }
      return;
    }

    // Get prospects to email
    let prospects: Prospect[];
    const variant = opts.variant as "direct" | "question" | "value";
    const dryRun = !opts.send;

    if (opts.prospectId) {
      const id = parseInt(opts.prospectId, 10);
      const all = listProspects({ status: "qualified" });
      const found = all.find((p) => p.id === id);
      if (!found) {
        // Also check 'found' status
        const allFound = listProspects({ status: "found" });
        const foundAlt = allFound.find((p) => p.id === id);
        if (!foundAlt) {
          console.error(`❌ Prospect ${id} not found or not qualified`);
          return;
        }
        prospects = [foundAlt];
      } else {
        prospects = [found];
      }
    } else {
      const minScore = parseInt(opts.minScore, 10);
      prospects = listProspects({
        city: opts.city,
        status: "qualified",
        minPainScore: minScore,
      });
    }

    if (prospects.length === 0) {
      console.log("📭 No qualified prospects found matching criteria.");
      console.log("Run prospector first: npm run prospect -- --niche kampaamo --city Oulu --audit");
      return;
    }

    // Filter out those without email
    const withEmail = prospects.filter((p) => p.email);
    const withoutEmail = prospects.filter((p) => !p.email);

    if (withoutEmail.length > 0) {
      console.log(`⚠️  ${withoutEmail.length} prospects without email address (skipped)`);
    }

    console.log(`\n📧 Preparing ${withEmail.length} audit emails (variant: ${variant})${dryRun ? " [DRY RUN]" : ""}...`);
    console.log("━".repeat(60));

    const emails = withEmail.map((p) => ({
      prospectId: p.id,
      email: buildAuditEmail(p, variant),
    }));

    const results = await sendBatch(emails, {
      dryRun,
      maxPerBatch: parseInt(opts.max, 10),
      delayMs: 30000,
    });

    // Summary
    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(`\n✅ Done: ${sent} sent, ${failed} failed`);

    if (dryRun) {
      console.log("\n💡 To actually send, add --send flag");
    }
  } finally {
    closeDb();
  }
}

main().catch(console.error);
