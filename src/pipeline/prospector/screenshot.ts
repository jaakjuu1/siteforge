import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const SCREENSHOTS_DIR = path.resolve(process.cwd(), "data/screenshots");

export interface ScreenshotResult {
  desktop: string;
  mobile: string;
}

function slugify(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

export async function takeScreenshots(
  websiteUrl: string,
): Promise<ScreenshotResult> {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const slug = slugify(websiteUrl);
  const desktopPath = path.join(SCREENSHOTS_DIR, `${slug}_desktop.png`);
  const mobilePath = path.join(SCREENSHOTS_DIR, `${slug}_mobile.png`);

  // Normalize URL
  let url = websiteUrl;
  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  const browser = await chromium.launch({ headless: true });

  try {
    // Desktop screenshot (1920x1080)
    const desktopContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await desktopPage.screenshot({
      path: desktopPath,
      fullPage: false,
    });
    await desktopContext.close();

    // Mobile screenshot (390x844 - iPhone 14 Pro)
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await mobilePage.screenshot({
      path: mobilePath,
      fullPage: false,
    });
    await mobileContext.close();
  } finally {
    await browser.close();
  }

  return {
    desktop: desktopPath,
    mobile: mobilePath,
  };
}

// --- CLI ---

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: tsx src/pipeline/prospector/screenshot.ts <url>");
    process.exit(1);
  }

  console.log(`📸 Taking screenshots of ${url}...`);
  const result = await takeScreenshots(url);
  console.log(`  Desktop: ${result.desktop}`);
  console.log(`  Mobile:  ${result.mobile}`);
  console.log("✅ Done");
}

const isMain =
  process.argv[1]?.endsWith("screenshot.ts") ||
  process.argv[1]?.endsWith("screenshot.js");
if (isMain) {
  main();
}
