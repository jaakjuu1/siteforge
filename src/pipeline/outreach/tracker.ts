import { addInteraction, updateProspectStatus } from "../crm/pipeline.js";
import { getDb } from "../crm/db.js";
import type { Prospect, Interaction } from "../crm/schema.js";

/**
 * Track email opens and replies.
 * For MVP: manual tracking via CLI commands.
 * Later: webhook integration with email provider.
 */

export function markReplied(prospectId: number, notes?: string): void {
  updateProspectStatus(prospectId, "warm");
  addInteraction({
    prospect_id: prospectId,
    type: "reply",
    content: notes ?? "Prospect replied to audit email",
  });
  console.log(`🔥 Prospect ${prospectId} marked as WARM (replied)`);
}

export function markNoReply(prospectId: number): void {
  addInteraction({
    prospect_id: prospectId,
    type: "note",
    content: "No reply after follow-up window",
  });
  console.log(`😐 Prospect ${prospectId} marked as no-reply`);
}

export function markUnsubscribed(prospectId: number): void {
  updateProspectStatus(prospectId, "found"); // Reset to prevent further contact
  addInteraction({
    prospect_id: prospectId,
    type: "note",
    content: "UNSUBSCRIBED — do not contact again",
  });
  console.log(`🚫 Prospect ${prospectId} unsubscribed`);
}

/**
 * Get prospects that were contacted but haven't replied within N days.
 * Candidates for follow-up.
 */
export function getFollowUpCandidates(daysAfterSend = 3): Prospect[] {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysAfterSend);

  const contacted = db
    .prepare(
      `SELECT p.* FROM prospects p
       WHERE p.status = 'contacted'
       AND p.updated_at <= ?
       AND p.id NOT IN (
         SELECT DISTINCT prospect_id FROM interactions
         WHERE type IN ('reply', 'note')
         AND content LIKE '%UNSUBSCRIBED%'
       )`,
    )
    .all(cutoff.toISOString()) as Prospect[];

  return contacted;
}

/**
 * Get outreach stats.
 */
export function getOutreachStats(): {
  total_contacted: number;
  total_warm: number;
  total_demo: number;
  total_closed: number;
  reply_rate: string;
  conversion_rate: string;
} {
  const db = getDb();

  const stats = {
    total_contacted: (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM prospects WHERE status IN ('contacted', 'warm', 'demo', 'closed', 'active')",
        )
        .get() as { c: number }
    ).c,
    total_warm: (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM prospects WHERE status IN ('warm', 'demo', 'closed', 'active')",
        )
        .get() as { c: number }
    ).c,
    total_demo: (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM prospects WHERE status IN ('demo', 'closed', 'active')",
        )
        .get() as { c: number }
    ).c,
    total_closed: (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM prospects WHERE status IN ('closed', 'active')",
        )
        .get() as { c: number }
    ).c,
    reply_rate: "0%",
    conversion_rate: "0%",
  };

  if (stats.total_contacted > 0) {
    stats.reply_rate =
      ((stats.total_warm / stats.total_contacted) * 100).toFixed(1) + "%";
    stats.conversion_rate =
      ((stats.total_closed / stats.total_contacted) * 100).toFixed(1) + "%";
  }

  return stats;
}
