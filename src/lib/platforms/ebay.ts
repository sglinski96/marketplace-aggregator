/**
 * eBay Integration
 * - Inventory API for posting listings
 * - Browse API for searching
 * - OAuth 2.0 for authentication
 */

const EBAY_BASE_URL = process.env.EBAY_SANDBOX_MODE === "true"
  ? "https://api.sandbox.ebay.com"
  : "https://api.ebay.com";

const EBAY_AUTH_URL = process.env.EBAY_SANDBOX_MODE === "true"
  ? "https://auth.sandbox.ebay.com"
  : "https://auth.ebay.com";

export interface EbayTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in: number;
}

export interface EbayListing {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  images: string[];
}

export interface EbaySearchResult {
  title: string;
  price: number;
  url: string;
  image?: string;
  location?: string;
  platform: "EBAY";
}

// OAuth: Get authorization URL
export function getEbayAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.EBAY_CLIENT_ID ?? "",
    redirect_uri: process.env.EBAY_REDIRECT_URI ?? "",
    response_type: "code",
    scope:
      "https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory",
    state,
  });

  return `${EBAY_AUTH_URL}/oauth2/authorize?${params.toString()}`;
}

// OAuth: Exchange code for tokens
export async function exchangeEbayCode(
  code: string
): Promise<EbayTokenResponse> {
  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${EBAY_BASE_URL}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.EBAY_REDIRECT_URI ?? "",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`eBay token exchange failed: ${error}`);
  }

  return response.json();
}

// OAuth: Refresh access token
export async function refreshEbayToken(
  refreshToken: string
): Promise<EbayTokenResponse> {
  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${EBAY_BASE_URL}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope:
        "https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh eBay token");
  }

  return response.json();
}

// Map condition strings to eBay condition IDs
function mapConditionToEbay(condition: string): string {
  const conditionMap: Record<string, string> = {
    NEW: "1000",
    LIKE_NEW: "1500",
    VERY_GOOD: "2000",
    GOOD: "3000",
    ACCEPTABLE: "4000",
    FOR_PARTS: "7000",
  };
  return conditionMap[condition.toUpperCase()] ?? "3000";
}

// Post a listing to eBay using the Inventory API
export async function postToEbay(
  accessToken: string,
  listing: EbayListing
): Promise<{ listingId: string; url: string }> {
  const sku = `MARKETREACH-${Date.now()}`;

  // Step 1: Create inventory item
  const inventoryResponse = await fetch(
    `${EBAY_BASE_URL}/sell/inventory/v1/inventory_item/${sku}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Content-Language": "en-US",
      },
      body: JSON.stringify({
        product: {
          title: listing.title,
          description: listing.description,
          aspects: {},
          imageUrls: listing.images.slice(0, 12),
        },
        condition: mapConditionToEbay(listing.condition),
        availability: {
          shipToLocationAvailability: {
            quantity: 1,
          },
        },
      }),
    }
  );

  if (!inventoryResponse.ok && inventoryResponse.status !== 204) {
    const error = await inventoryResponse.text();
    throw new Error(`Failed to create eBay inventory item: ${error}`);
  }

  // Step 2: Create offer
  const offerResponse = await fetch(
    `${EBAY_BASE_URL}/sell/inventory/v1/offer`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Content-Language": "en-US",
      },
      body: JSON.stringify({
        sku,
        marketplaceId: "EBAY_US",
        format: "FIXED_PRICE",
        availableQuantity: 1,
        categoryId: "9355", // Default: Everything Else
        listingDescription: listing.description,
        listingPolicies: {
          fulfillmentPolicyId: "FULFILLMENT_POLICY_ID", // requires real policy ID
          paymentPolicyId: "PAYMENT_POLICY_ID",
          returnPolicyId: "RETURN_POLICY_ID",
        },
        pricingSummary: {
          price: {
            value: listing.price.toString(),
            currency: "USD",
          },
        },
      }),
    }
  );

  if (!offerResponse.ok) {
    const error = await offerResponse.text();
    throw new Error(`Failed to create eBay offer: ${error}`);
  }

  const offerData = await offerResponse.json() as { offerId: string };

  // Step 3: Publish offer
  const publishResponse = await fetch(
    `${EBAY_BASE_URL}/sell/inventory/v1/offer/${offerData.offerId}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!publishResponse.ok) {
    const error = await publishResponse.text();
    throw new Error(`Failed to publish eBay listing: ${error}`);
  }

  const publishData = await publishResponse.json() as { listingId: string };

  return {
    listingId: publishData.listingId,
    url: `https://www.ebay.com/itm/${publishData.listingId}`,
  };
}

// Search eBay using Browse API
export async function searchEbay(
  query: string,
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    condition?: string;
    limit?: number;
  }
): Promise<EbaySearchResult[]> {
  // Use app token (client credentials) for Browse API
  const appToken = await getEbayAppToken();

  const params = new URLSearchParams({
    q: query,
    limit: String(filters?.limit ?? 20),
    sort: "BEST_MATCH",
  });

  if (filters?.minPrice || filters?.maxPrice) {
    const priceFilter = [
      filters.minPrice ? `price:[${filters.minPrice}` : "price:[",
      "..",
      filters.maxPrice ? `${filters.maxPrice}]` : "]",
    ].join("");
    params.append("filter", priceFilter);
  }

  const response = await fetch(
    `${EBAY_BASE_URL}/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${appToken}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`eBay search failed: ${error}`);
  }

  interface EbayItem {
    title: string;
    price?: { value: string };
    itemWebUrl: string;
    image?: { imageUrl: string };
    itemLocation?: { city: string; stateOrProvince: string };
  }

  const data = await response.json() as { itemSummaries?: EbayItem[] };

  return (data.itemSummaries ?? []).map((item: EbayItem) => ({
    title: item.title,
    price: parseFloat(item.price?.value ?? "0"),
    url: item.itemWebUrl,
    image: item.image?.imageUrl,
    location: item.itemLocation
      ? `${item.itemLocation.city}, ${item.itemLocation.stateOrProvince}`
      : undefined,
    platform: "EBAY" as const,
  }));
}

// Get app-level OAuth token (for Browse API)
async function getEbayAppToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${EBAY_BASE_URL}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to get eBay app token");
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}
