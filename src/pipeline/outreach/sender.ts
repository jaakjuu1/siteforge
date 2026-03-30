import { addInteraction, updateProspectStatus, getProspect } from "../crm/pipeline.js";
import type { AuditEmail } from "./email-builder.js";

/**
 * Send audit email via Hostinger SMTP (teppo@jaakkola.xyz).
 * Uses nodemailer.
 * 
 * Required env vars:
 *   SMTP_HOST=smtp.hostinger.com
 *   SMTP_PORT=465
 *   SMTP_USER=teppo@jaakkola.xyz
 *   SMTP_PASS=<password>
 */

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendAuditEmail(
  prospectId: number,
  email: AuditEmail,
  dryRun = false,
): Promise<SendResult> {
  const prospect = getProspect(prospectId);
  if (!prospect) {
    return { success: false, error: `Prospect ${prospectId} not found` };
  }

  if (!email.to) {
    return { success: false, error: "No email address for prospect" };
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] Would send to: ${email.to}`);
    console.log(`Subject: ${email.subject}`);
    console.log(`---\n${email.body}\n---`);

    addInteraction({
      prospect_id: prospectId,
      type: "note",
      content: `[DRY RUN] Email prepared: "${email.subject}" → ${email.to}`,
    });

    return { success: true, messageId: "dry-run" };
  }

  try {
    // Dynamic import to avoid requiring nodemailer at build time
    const nodemailer = await import("nodemailer");

    const host = process.env.SMTP_HOST ?? "smtp.hostinger.com";
    const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
    const user = process.env.SMTP_USER ?? "teppo@jaakkola.xyz";
    const pass = process.env.SMTP_PASS;

    if (!pass) {
      return { success: false, error: "SMTP_PASS not set" };
    }

    const transporter = nodemailer.default.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: `"Teppo Jaakkola" <${user}>`,
      to: email.to,
      subject: email.subject,
      text: email.body,
      html: email.htmlBody,
      headers: {
        "List-Unsubscribe": `<mailto:${user}?subject=unsubscribe>`,
      },
    });

    // Record interaction
    addInteraction({
      prospect_id: prospectId,
      type: "email_sent",
      content: `Subject: "${email.subject}" | MessageId: ${info.messageId}`,
    });

    // Update status
    updateProspectStatus(prospectId, "contacted");

    console.log(`✅ Sent to ${email.to} (${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`❌ Failed to send to ${email.to}: ${error}`);

    addInteraction({
      prospect_id: prospectId,
      type: "note",
      content: `Email send failed: ${error}`,
    });

    return { success: false, error };
  }
}

/**
 * Rate-limited batch sender.
 * Sends max N emails per batch with delay between each.
 */
export async function sendBatch(
  emails: { prospectId: number; email: AuditEmail }[],
  options: {
    dryRun?: boolean;
    delayMs?: number;
    maxPerBatch?: number;
  } = {},
): Promise<SendResult[]> {
  const { dryRun = true, delayMs = 30000, maxPerBatch = 10 } = options;
  const batch = emails.slice(0, maxPerBatch);
  const results: SendResult[] = [];

  console.log(
    `\n📧 Sending ${batch.length} emails${dryRun ? " (DRY RUN)" : ""}...`,
  );

  for (const { prospectId, email } of batch) {
    const result = await sendAuditEmail(prospectId, email, dryRun);
    results.push(result);

    if (!dryRun && batch.indexOf({ prospectId, email }) < batch.length - 1) {
      console.log(`⏳ Waiting ${delayMs / 1000}s before next email...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`\n📊 Results: ${sent} sent, ${failed} failed`);

  return results;
}

function getProspect(id: number) {
  const { getDb } = require("../crm/db.js");
  const db = getDb();
  return db.prepare("SELECT * FROM prospects WHERE id = ?").get(id) as
    | import("../crm/schema.js").Prospect
    | undefined;
}
