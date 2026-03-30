import fs from "node:fs";
import path from "node:path";
import type { AuditResult } from "./audit.js";
import type { ScoreResult } from "./score.js";

export interface ReportData {
  businessName: string;
  website: string;
  audit: AuditResult;
  score: ScoreResult;
  screenshotDesktop?: string;
  screenshotMobile?: string;
}

export function generateMarkdownReport(data: ReportData): string {
  const { businessName, website, audit, score } = data;
  const lines: string[] = [];

  lines.push(`# Sivustoanalyysi: ${businessName}`);
  lines.push(`**Sivusto:** ${website}`);
  lines.push(`**Analyysin päivämäärä:** ${new Date().toLocaleDateString("fi-FI")}`);
  lines.push(`**Kokonaispistemäärä:** ${score.score}/10`);
  lines.push("");

  // Score visualization
  const filled = "█".repeat(score.score);
  const empty = "░".repeat(10 - score.score);
  lines.push(`## Kipupisteet: ${filled}${empty} ${score.score}/10`);
  lines.push("");

  if (score.score >= 6) {
    lines.push(
      "> **Tämä yritys menettää merkittävästi asiakkaita sivuston puutteiden takia.**",
    );
  } else if (score.score >= 3) {
    lines.push(
      "> Sivustolla on joitain parannusmahdollisuuksia.",
    );
  } else {
    lines.push("> Sivusto on kohtuullisessa kunnossa.");
  }
  lines.push("");

  // Pain points
  if (score.painPoints.length > 0) {
    lines.push("## Havaitut ongelmat");
    lines.push("");
    for (const point of score.painPoints) {
      lines.push(`- ❌ ${point}`);
    }
    lines.push("");
  }

  // Lighthouse scores
  if (audit.lighthouse) {
    lines.push("## Lighthouse-tulokset");
    lines.push("");
    lines.push("| Mittari | Pistemäärä |");
    lines.push("|---------|-----------|");
    lines.push(
      `| Suorituskyky | ${formatScore(audit.lighthouse.performance)} |`,
    );
    lines.push(
      `| Saavutettavuus | ${formatScore(audit.lighthouse.accessibility)} |`,
    );
    lines.push(`| SEO | ${formatScore(audit.lighthouse.seo)} |`);
    lines.push(
      `| Parhaat käytännöt | ${formatScore(audit.lighthouse.bestPractices)} |`,
    );
    lines.push("");
  }

  // Custom checks summary
  lines.push("## Tekniset tarkastukset");
  lines.push("");
  lines.push("| Tarkastus | Tila |");
  lines.push("|-----------|------|");
  lines.push(
    `| Mobiili-CTA | ${audit.checks.hasMobileCTA ? "✅ OK" : "❌ Puuttuu"} |`,
  );
  lines.push(
    `| Soittopainike | ${audit.checks.hasClickToCall ? "✅ OK" : "❌ Puuttuu"} |`,
  );
  lines.push(
    `| Yhteydenottolomake | ${audit.checks.hasContactForm ? "✅ OK" : "❌ Puuttuu"} |`,
  );
  lines.push(
    `| Ajanvaraus | ${audit.checks.hasBookingWidget ? "✅ OK" : "❌ Puuttuu"} |`,
  );
  lines.push(
    `| HTTPS | ${audit.checks.hasHttps ? "✅ OK" : "❌ Puuttuu"} |`,
  );
  lines.push(
    `| Schema.org | ${audit.checks.hasSchemaOrg ? "✅ OK" : "❌ Puuttuu"} |`,
  );
  lines.push(
    `| Google Maps | ${audit.checks.hasGoogleMaps ? "✅ OK" : "❌ Puuttuu"} |`,
  );
  lines.push(
    `| Mobiililatausaika | ${formatLoadTime(audit.checks.mobileLoadTimeMs)} |`,
  );
  lines.push("");

  // Screenshots
  if (data.screenshotDesktop || data.screenshotMobile) {
    lines.push("## Kuvakaappaukset");
    lines.push("");
    if (data.screenshotDesktop) {
      lines.push(`### Desktop`);
      lines.push(`![Desktop](${data.screenshotDesktop})`);
      lines.push("");
    }
    if (data.screenshotMobile) {
      lines.push(`### Mobiili`);
      lines.push(`![Mobiili](${data.screenshotMobile})`);
      lines.push("");
    }
  }

  // Impact estimate
  lines.push("## Arvioitu vaikutus");
  lines.push("");
  if (!audit.checks.hasMobileCTA) {
    lines.push(
      "- **Mobiili-CTA puuttuu:** Arviolta 30% mobiililiikenteestä ei johda yhteydenottoon",
    );
  }
  if (audit.checks.mobileLoadTimeMs > 4000) {
    lines.push(
      `- **Hidas latausaika (${(audit.checks.mobileLoadTimeMs / 1000).toFixed(1)}s):** 53% käyttäjistä poistuu yli 3 sekunnin latausajalla`,
    );
  }
  if (!audit.checks.hasContactForm) {
    lines.push(
      "- **Ei yhteydenottolomaketta:** Asiakkaat jotka eivät halua soittaa, eivät ota yhteyttä",
    );
  }
  if (!audit.checks.hasSchemaOrg) {
    lines.push(
      "- **Ei rikastettuja hakutuloksia:** Kilpailijat joilla on Schema.org-merkinnät näkyvät paremmin Googlessa",
    );
  }
  lines.push("");

  lines.push("---");
  lines.push("*Raportin on luonut SiteForge-analysointityökalu*");

  return lines.join("\n");
}

function formatScore(score: number): string {
  const rounded = Math.round(score);
  if (rounded >= 90) return `🟢 ${rounded}/100`;
  if (rounded >= 50) return `🟡 ${rounded}/100`;
  return `🔴 ${rounded}/100`;
}

function formatLoadTime(ms: number): string {
  if (ms === 0) return "—";
  const secs = (ms / 1000).toFixed(1);
  if (ms <= 3000) return `🟢 ${secs}s`;
  if (ms <= 5000) return `🟡 ${secs}s`;
  return `🔴 ${secs}s`;
}

export function saveReport(
  report: string,
  businessName: string,
  outputDir?: string,
): string {
  const dir = outputDir ?? path.resolve(process.cwd(), "data/reports");
  fs.mkdirSync(dir, { recursive: true });

  const slug = businessName
    .toLowerCase()
    .replace(/[^a-zäöå0-9]/g, "_")
    .replace(/_+/g, "_");
  const filePath = path.join(dir, `${slug}_audit.md`);

  fs.writeFileSync(filePath, report, "utf-8");
  return filePath;
}

// --- CLI ---

function main() {
  console.log("Report module loaded.");
  console.log("Usage: import and call generateMarkdownReport() with audit + score data.");
}

const isMain =
  process.argv[1]?.endsWith("report.ts") ||
  process.argv[1]?.endsWith("report.js");
if (isMain) {
  main();
}
