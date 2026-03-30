import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";

const execFileAsync = promisify(execFile);

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
}

export interface CustomChecks {
  hasMobileCTA: boolean;
  hasContactForm: boolean;
  hasHttps: boolean;
  hasSchemaOrg: boolean;
  hasGoogleMaps: boolean;
  mobileLoadTimeMs: number;
  hasClickToCall: boolean;
  hasBookingWidget: boolean;
}

export interface AuditResult {
  url: string;
  lighthouse: LighthouseScores | null;
  checks: CustomChecks;
  errors: string[];
}

// --- Lighthouse via CLI ---

async function runLighthouse(url: string): Promise<LighthouseScores | null> {
  try {
    const { stdout } = await execFileAsync(
      "npx",
      [
        "lighthouse",
        url,
        "--output=json",
        "--quiet",
        "--chrome-flags=--headless --no-sandbox",
        "--only-categories=performance,accessibility,seo,best-practices",
      ],
      { maxBuffer: 10 * 1024 * 1024, timeout: 120000 },
    );

    const report = JSON.parse(stdout) as {
      categories: Record<string, { score: number | null }>;
    };

    return {
      performance: (report.categories.performance?.score ?? 0) * 100,
      accessibility: (report.categories.accessibility?.score ?? 0) * 100,
      seo: (report.categories.seo?.score ?? 0) * 100,
      bestPractices: (report.categories["best-practices"]?.score ?? 0) * 100,
    };
  } catch (err) {
    console.warn("Lighthouse failed:", (err as Error).message);
    return null;
  }
}

// --- Custom checks via Playwright ---

async function runCustomChecks(url: string): Promise<CustomChecks> {
  const checks: CustomChecks = {
    hasMobileCTA: false,
    hasContactForm: false,
    hasHttps: url.startsWith("https://"),
    hasSchemaOrg: false,
    hasGoogleMaps: false,
    mobileLoadTimeMs: 0,
    hasClickToCall: false,
    hasBookingWidget: false,
  };

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      isMobile: true,
    });
    const page = await context.newPage();

    const startTime = Date.now();
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    checks.mobileLoadTimeMs = Date.now() - startTime;

    const html = await page.content();
    const htmlLower = html.toLowerCase();

    // Check for click-to-call (tel: links)
    checks.hasClickToCall = htmlLower.includes('href="tel:');

    // Check for mobile CTA (prominent call/book buttons)
    checks.hasMobileCTA =
      checks.hasClickToCall ||
      (await page
        .locator(
          'a[href*="tel:"], button:has-text("Soita"), button:has-text("Varaa"), a:has-text("Soita"), a:has-text("Varaa"), a:has-text("Ota yhteyttä")',
        )
        .count()) > 0;

    // Check for contact/booking form
    checks.hasContactForm =
      (await page.locator("form").count()) > 0 ||
      htmlLower.includes("contact-form") ||
      htmlLower.includes("booking-form") ||
      htmlLower.includes("yhteydenottolomake");

    // Check for booking widget (common Finnish booking systems)
    checks.hasBookingWidget =
      htmlLower.includes("timma.fi") ||
      htmlLower.includes("vello.fi") ||
      htmlLower.includes("ajanvaraus") ||
      htmlLower.includes("slotti") ||
      htmlLower.includes("calendly") ||
      htmlLower.includes("bookeo");

    // Check for Schema.org LocalBusiness
    checks.hasSchemaOrg =
      htmlLower.includes("localbusiness") ||
      htmlLower.includes("schema.org") ||
      htmlLower.includes('"@type"');

    // Check for Google Maps embed
    checks.hasGoogleMaps =
      htmlLower.includes("maps.google") ||
      htmlLower.includes("google.com/maps") ||
      htmlLower.includes("maps.googleapis");

    await context.close();
  } catch (err) {
    console.warn("Custom checks partially failed:", (err as Error).message);
  } finally {
    await browser.close();
  }

  return checks;
}

// --- Main audit function ---

export async function auditWebsite(websiteUrl: string): Promise<AuditResult> {
  let url = websiteUrl;
  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  const errors: string[] = [];

  // Run Lighthouse and custom checks in parallel
  const [lighthouse, checks] = await Promise.all([
    runLighthouse(url).catch((err) => {
      errors.push(`Lighthouse: ${(err as Error).message}`);
      return null;
    }),
    runCustomChecks(url).catch((err) => {
      errors.push(`Custom checks: ${(err as Error).message}`);
      return {
        hasMobileCTA: false,
        hasContactForm: false,
        hasHttps: false,
        hasSchemaOrg: false,
        hasGoogleMaps: false,
        mobileLoadTimeMs: 0,
        hasClickToCall: false,
        hasBookingWidget: false,
      } satisfies CustomChecks;
    }),
  ]);

  return { url, lighthouse, checks, errors };
}

// --- CLI ---

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: tsx src/pipeline/prospector/audit.ts <url>");
    process.exit(1);
  }

  console.log(`🔍 Auditing ${url}...\n`);
  const result = await auditWebsite(url);

  if (result.lighthouse) {
    console.log("Lighthouse Scores:");
    console.log(`  Performance:    ${result.lighthouse.performance.toFixed(0)}`);
    console.log(
      `  Accessibility:  ${result.lighthouse.accessibility.toFixed(0)}`,
    );
    console.log(`  SEO:            ${result.lighthouse.seo.toFixed(0)}`);
    console.log(
      `  Best Practices: ${result.lighthouse.bestPractices.toFixed(0)}`,
    );
  } else {
    console.log("Lighthouse: ❌ Failed");
  }

  console.log("\nCustom Checks:");
  console.log(
    `  Mobile CTA:     ${result.checks.hasMobileCTA ? "✅" : "❌"}`,
  );
  console.log(
    `  Click-to-call:  ${result.checks.hasClickToCall ? "✅" : "❌"}`,
  );
  console.log(
    `  Contact form:   ${result.checks.hasContactForm ? "✅" : "❌"}`,
  );
  console.log(
    `  Booking widget: ${result.checks.hasBookingWidget ? "✅" : "❌"}`,
  );
  console.log(`  HTTPS:          ${result.checks.hasHttps ? "✅" : "❌"}`);
  console.log(
    `  Schema.org:     ${result.checks.hasSchemaOrg ? "✅" : "❌"}`,
  );
  console.log(
    `  Google Maps:    ${result.checks.hasGoogleMaps ? "✅" : "❌"}`,
  );
  console.log(
    `  Mobile load:    ${result.checks.mobileLoadTimeMs}ms`,
  );

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    for (const e of result.errors) {
      console.log(`  ⚠️  ${e}`);
    }
  }
}

const isMain =
  process.argv[1]?.endsWith("audit.ts") ||
  process.argv[1]?.endsWith("audit.js");
if (isMain) {
  main();
}
