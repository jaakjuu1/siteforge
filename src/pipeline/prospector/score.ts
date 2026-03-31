import type { AuditResult } from "./audit.js";

export interface ScoreResult {
  score: number;
  painPoints: string[];
}

export interface SiteforgeFitResult {
  score: number;
  fitStatus: "good_fit" | "needs_review" | "disqualified";
  disqualifiedReason: string | null;
  notes: string[];
}

export function calculatePainScore(audit: AuditResult): ScoreResult {
  let score = 0;
  const painPoints: string[] = [];

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

  if (!checks.hasMobileCTA && !checks.hasClickToCall) {
    score += 2;
    painPoints.push(
      "Ei mobiili-CTA:ta tai soittopainiketta — menetät ~30% puheluista mobiililta",
    );
  }

  if (!checks.hasContactForm && !checks.hasBookingWidget) {
    score += 2;
    painPoints.push(
      "Ei yhteydenottolomaketta tai ajanvarausta — potentiaaliset asiakkaat poistuvat",
    );
  }

  if (!checks.hasHttps) {
    score += 1;
    painPoints.push(
      'HTTPS puuttuu — Google Chrome näyttää "Ei turvallinen" -varoituksen',
    );
  }

  if (!checks.hasSchemaOrg) {
    score += 1;
    painPoints.push(
      "Ei Schema.org-merkintöjä — Google ei näytä rikastettuja hakutuloksia (tähdet, aukioloajat)",
    );
  }

  if (checks.mobileLoadTimeMs > 4000) {
    score += 1;
    const secs = (checks.mobileLoadTimeMs / 1000).toFixed(1);
    painPoints.push(
      `Mobiilisivun latausaika ${secs}s — 53% käyttäjistä poistuu yli 3s latausajalla`,
    );
  }

  if (!checks.hasGoogleMaps) {
    score += 1;
    painPoints.push(
      "Ei Google Maps -upotusta — vaikeuttaa asiakkaiden navigointia paikalle",
    );
  }

  if (audit.lighthouse && audit.lighthouse.performance < 50) {
    score += 1;
    painPoints.push(
      `Lighthouse-suorituskykypistemäärä ${audit.lighthouse.performance.toFixed(0)}/100 — hidas sivu karkottaa asiakkaita`,
    );
  }

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

export function calculateSiteforgeFit(audit: AuditResult): SiteforgeFitResult {
  const checks = audit.checks;
  const notes: string[] = [];

  let score = 10;
  let disqualifiedReason: string | null = null;

  if (checks.hasEcommerce) {
    score -= 7;
    disqualifiedReason = "advanced_functionality:ecommerce";
    notes.push("Sivulla on verkkokauppa / ostoskori / tuotekatalogi.");
  }

  if (checks.hasPortalOrMemberArea) {
    score -= 4;
    disqualifiedReason ??= "advanced_functionality:portal";
    notes.push("Sivulla on kirjautuminen / portaali / jäsenalue.");
  }

  if (checks.hasAdvancedBookingFlow) {
    score -= 3;
    disqualifiedReason ??= "advanced_functionality:booking";
    notes.push("Sivulla on varsinainen ajanvarausjärjestelmä, ei vain CTA-linkki.");
  }

  if (checks.locationCount > 1) {
    score -= 2;
    notes.push(`Yrityksellä on ${checks.locationCount} toimipistettä — monimutkaisempi rakenne.`);
  }

  if (checks.hasModernDesign) {
    score -= 1;
    notes.push("Nykyinen sivu näyttää jo teknisesti melko modernilta.");
  }

  if (!checks.hasEcommerce && !checks.hasPortalOrMemberArea && !checks.hasAdvancedBookingFlow) {
    score += 1;
    notes.push("Sopii hyvin kevyeen SiteForge-uudistukseen.");
  }

  score = Math.max(0, Math.min(10, score));

  if (disqualifiedReason || score <= 3) {
    return {
      score,
      fitStatus: "disqualified",
      disqualifiedReason: disqualifiedReason ?? "low_fit_score",
      notes,
    };
  }

  if (score <= 6) {
    return {
      score,
      fitStatus: "needs_review",
      disqualifiedReason: null,
      notes,
    };
  }

  return {
    score,
    fitStatus: "good_fit",
    disqualifiedReason: null,
    notes,
  };
}

function main() {
  console.log("Score module loaded.");
}

const isMain =
  process.argv[1]?.endsWith("score.ts") ||
  process.argv[1]?.endsWith("score.js");
if (isMain) {
  main();
}
