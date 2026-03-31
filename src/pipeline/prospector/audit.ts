/**
 * Website audit using PinchTab (primary) + Playwright (fallback).
 * No Lighthouse needed — we check business pain signals directly.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PINCHTAB = process.env.PINCHTAB_BIN ?? `${process.env.HOME}/.pinchtab/bin/0.7.6/pinchtab-linux-amd64`;
const SCREENSHOT_DIR = path.resolve("data/screenshots");
const TIMEOUT_MS = 15000;

export interface CustomChecks {
  hasMobileCTA: boolean;
  hasClickToCall: boolean;
  hasContactForm: boolean;
  hasBookingWidget: boolean;
  hasAdvancedBookingFlow: boolean;
  hasHttps: boolean;
  hasSchemaOrg: boolean;
  hasGoogleMaps: boolean;
  mobileLoadTimeMs: number;
  hasModernDesign: boolean;
  hasEcommerce: boolean;
  hasPortalOrMemberArea: boolean;
  locationCount: number;
  pageTitle: string;
  textContent: string;
}

export interface AuditResult {
  url: string;
  checks: CustomChecks;
  screenshots: {
    desktop: string | null;
    mobile: string | null;
  };
  errors: string[];
  lighthouse?: {
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
  } | null;
}

function runPinchtab(args: string): string | null {
  try {
    return execSync(`${PINCHTAB} ${args}`, {
      timeout: TIMEOUT_MS,
      encoding: "utf-8",
    }).trim();
  } catch {
    return null;
  }
}

function parsePinchtabJson(output: string | null): any {
  if (!output) return null;
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

async function takeScreenshots(url: string, domain: string): Promise<{ desktop: string | null; mobile: string | null }> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const desktopPath = path.join(SCREENSHOT_DIR, `${domain}__desktop.png`);
  const mobilePath = path.join(SCREENSHOT_DIR, `${domain}__mobile.png`);

  try {
    const { chromium, devices } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    const desktopPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await desktopPage.goto(url, { waitUntil: "load", timeout: 20000 }).catch(() => {});
    await desktopPage.waitForTimeout(2000);
    await desktopPage.screenshot({ path: desktopPath, fullPage: false });

    const mobilePage = await browser.newPage({ ...devices["iPhone 14 Pro"] });
    await mobilePage.goto(url, { waitUntil: "load", timeout: 20000 }).catch(() => {});
    await mobilePage.waitForTimeout(2000);
    await mobilePage.screenshot({ path: mobilePath, fullPage: false });

    await browser.close();
  } catch (err) {
    console.warn(`  ⚠️ Playwright screenshots failed: ${(err as Error).message}`);
  }

  return {
    desktop: fs.existsSync(desktopPath) ? desktopPath : null,
    mobile: fs.existsSync(mobilePath) ? mobilePath : null,
  };
}

function countLocations(text: string): number {
  const matches = text.match(/\b\d{5}\s+[A-ZÄÖÅ][a-zäöå]+/g) ?? [];
  return new Set(matches).size;
}

function analyzeContent(url: string): {
  text: string;
  title: string;
  checks: Partial<CustomChecks>;
} {
  runPinchtab(`nav "${url}"`);
  execSync("sleep 3");

  const textOutput = runPinchtab("text -c");
  const textData = parsePinchtabJson(textOutput);
  const text = textData?.text ?? "";
  const title = textData?.title ?? "";

  const snapOutput = runPinchtab("snap -i -c");
  const snapData = parsePinchtabJson(snapOutput);
  const nodes = snapData?.nodes ?? [];

  const textLower = text.toLowerCase();
  const allNodeText = nodes
    .map((n: any) => `${n.tag ?? ""} ${n.text ?? ""} ${n.href ?? ""} ${n.type ?? ""}`)
    .join(" ")
    .toLowerCase();

  const ecommerceSignals = [
    "ostoskori",
    "verkkokauppa",
    "shop",
    "store",
    "tuote",
    "product",
    "checkout",
    "cart",
    "add to cart",
    "lisää ostoskoriin",
    "woocommerce",
    "shopify",
    "herkkukauppa",
  ];

  const portalSignals = ["kirjaudu", "login", "sign in", "oma tili", "member", "dashboard", "asiakastili"];
  const advancedBookingSignals = ["timma", "vello", "book salon", "book now", "bookings", "resurssivaraus"];

  const hasEcommerce = ecommerceSignals.some((s) => textLower.includes(s) || allNodeText.includes(s));
  const hasPortalOrMemberArea = portalSignals.some((s) => textLower.includes(s) || allNodeText.includes(s));
  const hasAdvancedBookingFlow = advancedBookingSignals.some((s) => textLower.includes(s) || allNodeText.includes(s));

  const checks: Partial<CustomChecks> = {
    hasClickToCall: allNodeText.includes("tel:") || allNodeText.includes("soita"),
    hasMobileCTA:
      allNodeText.includes("varaa") ||
      allNodeText.includes("ajanvaraus") ||
      allNodeText.includes("ota yhteyttä") ||
      allNodeText.includes("soita") ||
      allNodeText.includes("book") ||
      allNodeText.includes("contact"),
    hasContactForm:
      allNodeText.includes("<form") ||
      allNodeText.includes("input") ||
      allNodeText.includes("textarea") ||
      allNodeText.includes("lomake") ||
      nodes.some((n: any) => n.tag === "form" || n.tag === "textarea"),
    hasBookingWidget:
      textLower.includes("timma") ||
      textLower.includes("vello") ||
      textLower.includes("calendly") ||
      textLower.includes("bookings") ||
      textLower.includes("ajanvaraus") ||
      allNodeText.includes("timma.fi") ||
      allNodeText.includes("vello.fi"),
    hasAdvancedBookingFlow,
    hasHttps: url.startsWith("https://"),
    hasSchemaOrg: false,
    hasGoogleMaps:
      textLower.includes("google.com/maps") ||
      textLower.includes("maps.google") ||
      allNodeText.includes("maps.google") ||
      allNodeText.includes("gmap"),
    hasModernDesign:
      allNodeText.includes("tailwind") ||
      allNodeText.includes("next") ||
      allNodeText.includes("react") ||
      allNodeText.includes("vue") ||
      allNodeText.includes("webflow"),
    hasEcommerce,
    hasPortalOrMemberArea,
    locationCount: Math.max(1, countLocations(text)),
    pageTitle: title,
    textContent: text.slice(0, 4000),
  };

  return { text, title, checks };
}

function checkSchemaOrg(url: string): boolean {
  try {
    const result = execSync(
      `curl -s -L --max-time 10 "${url}" | grep -c "schema.org\\|application/ld+json"`,
      { encoding: "utf-8", timeout: 15000 },
    );
    return parseInt(result.trim(), 10) > 0;
  } catch {
    return false;
  }
}

function checkLoadTime(url: string): number {
  try {
    const result = execSync(
      `curl -s -o /dev/null -w "%{time_total}" --max-time 15 -L "${url}"`,
      { encoding: "utf-8", timeout: 20000 },
    );
    return Math.round(parseFloat(result.trim()) * 1000);
  } catch {
    return 0;
  }
}

export async function auditWebsite(url: string): Promise<AuditResult> {
  const errors: string[] = [];

  let domain: string;
  try {
    domain = new URL(url).hostname.replace("www.", "");
  } catch {
    domain = url.replace(/https?:\/\//, "").replace(/\//g, "_");
  }

  console.log(`  🔍 Navigating to ${url}...`);

  let contentAnalysis: ReturnType<typeof analyzeContent>;
  try {
    contentAnalysis = analyzeContent(url);
  } catch (err) {
    errors.push(`Content analysis failed: ${(err as Error).message}`);
    contentAnalysis = {
      text: "",
      title: "",
      checks: {},
    };
  }

  console.log("  📸 Taking screenshots...");
  let screenshots = { desktop: null as string | null, mobile: null as string | null };
  try {
    screenshots = await takeScreenshots(url, domain);
  } catch (err) {
    errors.push(`Screenshots failed: ${(err as Error).message}`);
  }

  console.log("  🏗️ Checking Schema.org...");
  const hasSchemaOrg = checkSchemaOrg(url);

  console.log("  ⏱️ Checking load time...");
  const loadTime = checkLoadTime(url);

  const checks: CustomChecks = {
    hasMobileCTA: contentAnalysis.checks.hasMobileCTA ?? false,
    hasClickToCall: contentAnalysis.checks.hasClickToCall ?? false,
    hasContactForm: contentAnalysis.checks.hasContactForm ?? false,
    hasBookingWidget: contentAnalysis.checks.hasBookingWidget ?? false,
    hasAdvancedBookingFlow: contentAnalysis.checks.hasAdvancedBookingFlow ?? false,
    hasHttps: contentAnalysis.checks.hasHttps ?? url.startsWith("https://"),
    hasSchemaOrg,
    hasGoogleMaps: contentAnalysis.checks.hasGoogleMaps ?? false,
    mobileLoadTimeMs: loadTime,
    hasModernDesign: contentAnalysis.checks.hasModernDesign ?? false,
    hasEcommerce: contentAnalysis.checks.hasEcommerce ?? false,
    hasPortalOrMemberArea: contentAnalysis.checks.hasPortalOrMemberArea ?? false,
    locationCount: contentAnalysis.checks.locationCount ?? 1,
    pageTitle: contentAnalysis.checks.pageTitle ?? "",
    textContent: contentAnalysis.checks.textContent ?? "",
  };

  console.log("  ✅ Audit complete");

  return { url, checks, screenshots, errors, lighthouse: null };
}

export async function quickAudit(url: string): Promise<AuditResult> {
  const errors: string[] = [];

  let contentAnalysis: ReturnType<typeof analyzeContent>;
  try {
    contentAnalysis = analyzeContent(url);
  } catch (err) {
    errors.push(`Content analysis failed: ${(err as Error).message}`);
    contentAnalysis = { text: "", title: "", checks: {} };
  }

  const hasSchemaOrg = checkSchemaOrg(url);
  const loadTime = checkLoadTime(url);

  const checks: CustomChecks = {
    hasMobileCTA: contentAnalysis.checks.hasMobileCTA ?? false,
    hasClickToCall: contentAnalysis.checks.hasClickToCall ?? false,
    hasContactForm: contentAnalysis.checks.hasContactForm ?? false,
    hasBookingWidget: contentAnalysis.checks.hasBookingWidget ?? false,
    hasAdvancedBookingFlow: contentAnalysis.checks.hasAdvancedBookingFlow ?? false,
    hasHttps: url.startsWith("https://"),
    hasSchemaOrg,
    hasGoogleMaps: contentAnalysis.checks.hasGoogleMaps ?? false,
    mobileLoadTimeMs: loadTime,
    hasModernDesign: contentAnalysis.checks.hasModernDesign ?? false,
    hasEcommerce: contentAnalysis.checks.hasEcommerce ?? false,
    hasPortalOrMemberArea: contentAnalysis.checks.hasPortalOrMemberArea ?? false,
    locationCount: contentAnalysis.checks.locationCount ?? 1,
    pageTitle: contentAnalysis.checks.pageTitle ?? "",
    textContent: contentAnalysis.checks.textContent ?? "",
  };

  return { url, checks, screenshots: { desktop: null, mobile: null }, errors, lighthouse: null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  if (!url) {
    console.log("Usage: tsx src/pipeline/prospector/audit.ts <url>");
    process.exit(1);
  }
  auditWebsite(url).then((result) => {
    console.log("\n📊 Audit Results:");
    console.log(JSON.stringify(result, null, 2));
  });
}
