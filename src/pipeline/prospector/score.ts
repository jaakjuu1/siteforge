import type { AuditResult } from "./audit.js";

export interface ScoreResult {
  score: number;
  painPoints: string[];
}

export function calculatePainScore(audit: AuditResult): ScoreResult {
  let score = 0;
  const painPoints: string[] = [];

    // Graceful fallback if checks is null/undefined
  const checks = audit.checks ?? {
    hasMobileCTA: false,
    hasContactForm: false,
    hasHttps: false,
    hasSchemaOrg: false,
    hasGoogleMaps: false,
    mobileLoadTimeMs: 0,
    hasClickToCall: false,
    hasBookingWidget: false,
  };

// No mobile CTA / click-to-call (2 pts)
  if (!checks.hasMobileCTA && !checks.hasClickToCall) {
    score += 2;
    painPoints.push(
      "Ei mobiili-CTA:ta tai soittopainiketta — menetät ~30% puheluista mobiililta",
    );
  }

  // No booking/contact form (2 pts)
  if (!checks.hasContactForm && !checks.hasBookingWidget) {
    score += 2;
    painPoints.push(
      "Ei yhteydenottolomaketta tai ajanvarausta — potentiaaliset asiakkaat poistuvat",
    );
  }

  // No HTTPS (1 pt)
  if (!checks.hasHttps) {
    score += 1;
    painPoints.push(
      'HTTPS puuttuu — Google Chrome näyttää "Ei turvallinen" -varoituksen',
    );
  }

  // No Schema.org (1 pt)
  if (!checks.hasSchemaOrg) {
    score += 1;
    painPoints.push(
      "Ei Schema.org-merkintöjä — Google ei näytä rikastettuja hakutuloksia (tähdet, aukioloajat)",
    );
  }

  // Slow mobile load > 4s (1 pt)
  if (checks.mobileLoadTimeMs > 4000) {
    score += 1;
    const secs = (checks.mobileLoadTimeMs / 1000).toFixed(1);
    painPoints.push(
      `Mobiilisivun latausaika ${secs}s — 53% käyttäjistä poistuu yli 3s latausajalla`,
    );
  }

  // No Google Maps (1 pt — proxy for poor local SEO / no reviews integration)
  if (!checks.hasGoogleMaps) {
    score += 1;
    painPoints.push(
      "Ei Google Maps -upotusta — vaikeuttaa asiakkaiden navigointia paikalle",
    );
  }

  // Poor Lighthouse performance < 50 (1 pt)
  if (audit.lighthouse && audit.lighthouse.performance < 50) {
    score += 1;
    painPoints.push(
      `Lighthouse-suorituskykypistemäärä ${audit.lighthouse.performance.toFixed(0)}/100 — hidas sivu karkottaa asiakkaita`,
    );
  }

  // Poor Lighthouse SEO < 70 (bonus signal, not counted in score to avoid >10)
  // We keep total max at 10
  if (audit.lighthouse && audit.lighthouse.seo < 70 && score < 10) {
    score += 1;
    painPoints.push(
      `SEO-pistemäärä ${audit.lighthouse.seo.toFixed(0)}/100 — sivu ei sijoitu hauissa niin hyvin kuin voisi`,
    );
  }

  return {
    score: Math.min(score, 10),
    painPoints,
  };
}

// --- CLI ---

function main() {
  console.log("Score module loaded. Use with audit results.");
  console.log("Example pain scoring weights:");
  console.log("  No mobile CTA:     2 pts");
  console.log("  No contact form:   2 pts");
  console.log("  No HTTPS:          1 pt");
  console.log("  No Schema.org:     1 pt");
  console.log("  Slow mobile >4s:   1 pt");
  console.log("  No Google Maps:    1 pt");
  console.log("  Poor performance:  1 pt");
  console.log("  Poor SEO:          1 pt");
  console.log("  Max score:         10");
}

const isMain =
  process.argv[1]?.endsWith("score.ts") ||
  process.argv[1]?.endsWith("score.js");
if (isMain) {
  main();
}
