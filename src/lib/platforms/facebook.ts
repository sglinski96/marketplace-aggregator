/**
 * Facebook Marketplace Integration
 * Uses Playwright browser automation since Facebook has no public Marketplace API.
 * Users provide their Facebook credentials (stored encrypted).
 */

import { Browser, BrowserContext, Page, chromium } from "playwright";

export interface FacebookCredentials {
  email: string;
  password: string;
}

export interface FacebookListing {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  images: string[];
  location?: string;
}

export interface FacebookSearchResult {
  title: string;
  price: number;
  url: string;
  image?: string;
  location?: string;
  platform: "FACEBOOK";
}

const FACEBOOK_URL = "https://www.facebook.com";

async function createBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  return { browser, context };
}

async function loginToFacebook(
  page: Page,
  credentials: FacebookCredentials
): Promise<void> {
  await page.goto(`${FACEBOOK_URL}/login`);
  await page.waitForLoadState("networkidle");

  // Dismiss cookie consent if present
  const cookieButton = page.locator('[data-testid="cookie-policy-manage-dialog-accept-button"]');
  if (await cookieButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cookieButton.click();
  }

  await page.fill("#email", credentials.email);
  await page.fill("#pass", credentials.password);
  await page.click('[name="login"]');
  await page.waitForNavigation({ timeout: 15000 });

  // Check for 2FA or captcha
  const currentUrl = page.url();
  if (currentUrl.includes("checkpoint") || currentUrl.includes("two_step")) {
    throw new Error(
      "Facebook requires two-factor authentication. Please log in manually first."
    );
  }

  if (!currentUrl.includes("facebook.com") || currentUrl.includes("login")) {
    throw new Error("Facebook login failed. Please check your credentials.");
  }
}

// Post a listing to Facebook Marketplace
export async function postToFacebook(
  credentials: FacebookCredentials,
  listing: FacebookListing
): Promise<{ listingId: string; url: string }> {
  const { browser, context } = await createBrowser();
  const page = await context.newPage();

  try {
    await loginToFacebook(page, credentials);

    // Navigate to Marketplace create listing
    await page.goto(`${FACEBOOK_URL}/marketplace/create/item`);
    await page.waitForLoadState("networkidle");

    // Upload photos first
    if (listing.images.length > 0) {
      // Download images and upload them
      for (const imageUrl of listing.images.slice(0, 10)) {
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();

        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await fileInput.setInputFiles({
            name: "image.jpg",
            mimeType: "image/jpeg",
            buffer: Buffer.from(imageBuffer),
          });
          await page.waitForTimeout(1000);
        }
      }
    }

    // Fill in listing details
    await page.fill('[placeholder="What are you selling?"]', listing.title);
    await page.fill('[placeholder="Price"]', String(listing.price));

    // Set condition
    const conditionSelect = page.locator('[aria-label="Condition"]');
    if (await conditionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await conditionSelect.click();
      const conditionOption = page.locator(`[role="option"]`).filter({
        hasText: listing.condition === "NEW" ? "New" : "Used",
      });
      await conditionOption.first().click();
    }

    // Fill description
    await page.fill(
      '[placeholder="Describe your item (optional)"]',
      listing.description
    );

    // Set location if provided
    if (listing.location) {
      const locationInput = page.locator('[placeholder="Location"]');
      if (await locationInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await locationInput.fill(listing.location);
        await page.waitForTimeout(1000);
        const locationSuggestion = page.locator('[role="option"]').first();
        if (await locationSuggestion.isVisible({ timeout: 3000 }).catch(() => false)) {
          await locationSuggestion.click();
        }
      }
    }

    // Click Next
    await page.click('[data-testid="marketplace-listing-next-button"]');
    await page.waitForTimeout(2000);

    // Publish
    await page.click('[data-testid="marketplace-listing-publish-button"]');
    await page.waitForNavigation({ timeout: 30000 });

    const currentUrl = page.url();
    const listingIdMatch = currentUrl.match(/\/item\/(\d+)/);
    const listingId = listingIdMatch ? listingIdMatch[1] : Date.now().toString();

    return {
      listingId,
      url: currentUrl.includes("/item/")
        ? currentUrl
        : `${FACEBOOK_URL}/marketplace/item/${listingId}`,
    };
  } finally {
    await browser.close();
  }
}

// Search Facebook Marketplace via scraping
export async function searchFacebook(
  query: string,
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    location?: string;
    limit?: number;
  }
): Promise<FacebookSearchResult[]> {
  const { browser, context } = await createBrowser();
  const page = await context.newPage();

  try {
    const params = new URLSearchParams({
      query,
      ...(filters?.minPrice && { minPrice: String(filters.minPrice) }),
      ...(filters?.maxPrice && { maxPrice: String(filters.maxPrice) }),
    });

    await page.goto(
      `${FACEBOOK_URL}/marketplace/search?${params.toString()}`,
      { timeout: 30000 }
    );
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Extract listing data
    const results = await page.evaluate(() => {
      const items: FacebookSearchResult[] = [];
      const listingElements = document.querySelectorAll('[data-testid="marketplace_feed_item"]');

      listingElements.forEach((el) => {
        const titleEl = el.querySelector('[data-testid="marketplace_listing_title"]');
        const priceEl = el.querySelector('[data-testid="marketplace_listing_price"]');
        const linkEl = el.querySelector("a");
        const imgEl = el.querySelector("img");
        const locationEl = el.querySelector('[data-testid="marketplace_listing_location"]');

        if (titleEl && linkEl) {
          items.push({
            title: titleEl.textContent ?? "",
            price: parseFloat((priceEl?.textContent ?? "0").replace(/[^0-9.]/g, "")),
            url: (linkEl as HTMLAnchorElement).href,
            image: (imgEl as HTMLImageElement)?.src,
            location: locationEl?.textContent ?? undefined,
            platform: "FACEBOOK",
          });
        }
      });

      return items;
    });

    return results.slice(0, filters?.limit ?? 20);
  } catch (error) {
    // Facebook requires login for Marketplace search in many regions
    console.error("Facebook search error:", error);
    return [];
  } finally {
    await browser.close();
  }
}
