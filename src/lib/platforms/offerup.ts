/**
 * OfferUp Integration
 * Uses Playwright browser automation for posting and search scraping.
 * No public API available.
 */

import { Browser, BrowserContext, Page, chromium } from "playwright";

export interface OfferUpCredentials {
  email: string;
  password: string;
}

export interface OfferUpListing {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  images: string[];
}

export interface OfferUpSearchResult {
  title: string;
  price: number;
  url: string;
  image?: string;
  location?: string;
  platform: "OFFERUP";
}

const OFFERUP_URL = "https://offerup.com";

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

async function loginToOfferUp(
  page: Page,
  credentials: OfferUpCredentials
): Promise<void> {
  await page.goto(`${OFFERUP_URL}/login`);
  await page.waitForLoadState("networkidle");

  await page.fill('[type="email"]', credentials.email);
  await page.fill('[type="password"]', credentials.password);
  await page.click('[type="submit"]');
  await page.waitForNavigation({ timeout: 15000 });

  const currentUrl = page.url();
  if (currentUrl.includes("login")) {
    throw new Error("OfferUp login failed. Please check your credentials.");
  }
}

// Map condition to OfferUp condition
function mapCondition(condition: string): string {
  const conditionMap: Record<string, string> = {
    NEW: "5",
    LIKE_NEW: "4",
    VERY_GOOD: "3",
    GOOD: "2",
    ACCEPTABLE: "1",
    FOR_PARTS: "1",
  };
  return conditionMap[condition.toUpperCase()] ?? "2";
}

// Post a listing to OfferUp
export async function postToOfferUp(
  credentials: OfferUpCredentials,
  listing: OfferUpListing
): Promise<{ listingId: string; url: string }> {
  const { browser, context } = await createBrowser();
  const page = await context.newPage();

  try {
    await loginToOfferUp(page, credentials);

    // Navigate to post an item
    await page.goto(`${OFFERUP_URL}/post`);
    await page.waitForLoadState("networkidle");

    // Upload photos
    if (listing.images.length > 0) {
      for (const imageUrl of listing.images.slice(0, 10)) {
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
            await page.waitForTimeout(1500);
          }
        } catch {
          // Continue if image upload fails
        }
      }
    }

    // Fill in the form
    const titleInput = page.locator('[placeholder*="title" i], [aria-label*="title" i], input[name="title"]').first();
    await titleInput.fill(listing.title);

    const priceInput = page.locator('[placeholder*="price" i], [aria-label*="price" i], input[name="price"]').first();
    await priceInput.fill(String(listing.price));

    const descriptionInput = page.locator(
      'textarea[placeholder*="description" i], textarea[aria-label*="description" i], textarea[name="description"]'
    ).first();
    await descriptionInput.fill(listing.description);

    // Select condition
    const conditionValue = mapCondition(listing.condition);
    const conditionSelect = page.locator('[name="condition"], [aria-label*="condition" i]').first();
    if (await conditionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await conditionSelect.selectOption(conditionValue);
    }

    // Submit
    const submitButton = page.locator('button[type="submit"], [data-testid="post-item-submit"]').first();
    await submitButton.click();
    await page.waitForNavigation({ timeout: 30000 });

    const currentUrl = page.url();
    const listingIdMatch = currentUrl.match(/\/item\/(\d+)/);
    const listingId = listingIdMatch ? listingIdMatch[1] : Date.now().toString();

    return {
      listingId,
      url: currentUrl.includes("/item/") ? currentUrl : `${OFFERUP_URL}/item/${listingId}`,
    };
  } finally {
    await browser.close();
  }
}

// Search OfferUp
export async function searchOfferUp(
  query: string,
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
  }
): Promise<OfferUpSearchResult[]> {
  const { browser, context } = await createBrowser();
  const page = await context.newPage();

  try {
    const params = new URLSearchParams({ q: query });
    if (filters?.minPrice) params.append("price_min", String(filters.minPrice));
    if (filters?.maxPrice) params.append("price_max", String(filters.maxPrice));

    await page.goto(`${OFFERUP_URL}/search?${params.toString()}`, {
      timeout: 30000,
    });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const results = await page.evaluate(() => {
      const items: OfferUpSearchResult[] = [];
      // OfferUp uses React, so we look for common patterns
      const itemCards = document.querySelectorAll(
        '[data-testid="item-card"], .item-card, article'
      );

      itemCards.forEach((card) => {
        const titleEl = card.querySelector('h3, [data-testid="item-title"]');
        const priceEl = card.querySelector('[data-testid="item-price"], .price');
        const linkEl = card.querySelector("a");
        const imgEl = card.querySelector("img");
        const locationEl = card.querySelector('[data-testid="item-location"], .location');

        if (titleEl && linkEl) {
          const href = (linkEl as HTMLAnchorElement).href;
          items.push({
            title: titleEl.textContent?.trim() ?? "",
            price: parseFloat(
              (priceEl?.textContent ?? "0").replace(/[^0-9.]/g, "")
            ),
            url: href.startsWith("http") ? href : `https://offerup.com${href}`,
            image: (imgEl as HTMLImageElement)?.src,
            location: locationEl?.textContent?.trim(),
            platform: "OFFERUP",
          });
        }
      });

      return items;
    });

    return results.slice(0, filters?.limit ?? 20);
  } catch (error) {
    console.error("OfferUp search error:", error);
    return [];
  } finally {
    await browser.close();
  }
}
