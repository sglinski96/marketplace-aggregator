/**
 * Craigslist Integration
 * Uses Playwright browser automation for posting and scraping.
 * Search is done via public web scraping (no login required).
 * Posting requires email-based verification.
 */

import { Browser, BrowserContext, Page, chromium } from "playwright";

export interface CraigslistCredentials {
  email: string;
  password: string;
  area?: string; // e.g., "sfbay", "newyork", "chicago"
}

export interface CraigslistListing {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  images: string[];
  location?: string;
  area?: string; // Craigslist area code
}

export interface CraigslistSearchResult {
  title: string;
  price: number;
  url: string;
  image?: string;
  location?: string;
  platform: "CRAIGSLIST";
}

const CRAIGSLIST_BASE = "https://craigslist.org";

async function createBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  return { browser, context };
}

// Map category strings to Craigslist category codes
function mapCategoryToCraigslist(category: string): string {
  const categoryMap: Record<string, string> = {
    electronics: "ela",
    furniture: "fua",
    clothing: "cla",
    vehicles: "cta",
    "sporting goods": "sga",
    tools: "tla",
    appliances: "ppa",
    collectibles: "cla",
    books: "bka",
    toys: "tya",
    jewelry: "jwa",
    "baby items": "baa",
    "farm & garden": "gra",
    "free stuff": "zip",
    general: "foa",
  };

  return (
    categoryMap[category.toLowerCase()] ??
    categoryMap[
      Object.keys(categoryMap).find((k) =>
        category.toLowerCase().includes(k)
      ) ?? "general"
    ] ??
    "foa"
  );
}

// Post a listing to Craigslist
export async function postToCraigslist(
  credentials: CraigslistCredentials,
  listing: CraigslistListing
): Promise<{ listingId: string; url: string }> {
  const { browser, context } = await createBrowser();
  const page = await context.newPage();
  const area = credentials.area ?? listing.area ?? "sfbay";

  try {
    // Login to Craigslist
    await page.goto("https://accounts.craigslist.org/login");
    await page.fill("#inputEmailHandle", credentials.email);
    await page.fill("#inputPassword", credentials.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 15000 });

    // Navigate to post
    await page.goto(`https://${area}.craigslist.org/post`);
    await page.waitForLoadState("networkidle");

    // Select "For sale by owner"
    const forSaleOption = page.locator('input[value="fso"]');
    if (await forSaleOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forSaleOption.click();
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForNavigation();
    }

    // Select category
    const categoryCode = mapCategoryToCraigslist(listing.category);
    const categoryLink = page.locator(`a[href*="${categoryCode}"]`).first();
    if (await categoryLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await categoryLink.click();
      await page.waitForNavigation();
    }

    // Fill posting form
    await page.fill('[name="PostingTitle"]', listing.title);
    await page.fill('[name="price"]', String(listing.price));
    await page.fill('[name="PostingBody"]', listing.description);

    if (listing.location) {
      const cityField = page.locator('[name="city"]');
      if (await cityField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cityField.fill(listing.location);
      }
    }

    // Continue
    await page.click('button[id="go"]');
    await page.waitForNavigation({ timeout: 15000 });

    // Upload images
    if (listing.images.length > 0) {
      for (const imageUrl of listing.images.slice(0, 8)) {
        try {
          const imageResponse = await fetch(imageUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          const fileInput = page.locator('input[type="file"]').first();
          if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await fileInput.setInputFiles({
              name: "image.jpg",
              mimeType: "image/jpeg",
              buffer: Buffer.from(imageBuffer),
            });
            await page.waitForTimeout(2000);
          }
        } catch {
          // Continue even if image upload fails
        }
      }
      await page.click('button[id="go"]');
      await page.waitForNavigation({ timeout: 15000 });
    }

    // Review and submit
    const submitButton = page.locator('button[id="go"]');
    if (await submitButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitButton.click();
      await page.waitForNavigation({ timeout: 20000 });
    }

    const currentUrl = page.url();
    const listingIdMatch = currentUrl.match(/\/(\d+)\.html/);
    const listingId = listingIdMatch ? listingIdMatch[1] : Date.now().toString();

    return {
      listingId,
      url: currentUrl.includes(".html") ? currentUrl : `https://${area}.craigslist.org/foa/${listingId}.html`,
    };
  } finally {
    await browser.close();
  }
}

// Search Craigslist (no login required)
export async function searchCraigslist(
  query: string,
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    area?: string;
    limit?: number;
  }
): Promise<CraigslistSearchResult[]> {
  const { browser, context } = await createBrowser();
  const page = await context.newPage();
  const area = filters?.area ?? "sfbay";

  try {
    const params = new URLSearchParams({
      query,
      ...(filters?.minPrice && { min_price: String(filters.minPrice) }),
      ...(filters?.maxPrice && { max_price: String(filters.maxPrice) }),
    });

    await page.goto(
      `https://${area}.craigslist.org/search/sss?${params.toString()}`,
      { timeout: 30000 }
    );
    await page.waitForSelector(".result-row", { timeout: 10000 });

    const results = await page.evaluate(() => {
      const items: CraigslistSearchResult[] = [];
      const rows = document.querySelectorAll(".result-row");

      rows.forEach((row) => {
        const titleEl = row.querySelector(".result-title");
        const priceEl = row.querySelector(".result-price");
        const imgEl = row.querySelector(".result-image img");
        const hoodEl = row.querySelector(".result-hood");

        if (titleEl) {
          items.push({
            title: titleEl.textContent?.trim() ?? "",
            price: parseFloat(
              (priceEl?.textContent ?? "0").replace(/[^0-9.]/g, "")
            ),
            url: (titleEl as HTMLAnchorElement).href,
            image: (imgEl as HTMLImageElement)?.src,
            location: hoodEl?.textContent?.trim().replace(/[()]/g, ""),
            platform: "CRAIGSLIST",
          });
        }
      });

      return items;
    });

    return results.slice(0, filters?.limit ?? 20);
  } catch (error) {
    console.error("Craigslist search error:", error);
    return [];
  } finally {
    await browser.close();
  }
}
