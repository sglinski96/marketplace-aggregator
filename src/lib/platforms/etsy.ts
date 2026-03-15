/**
 * Etsy Integration
 * - Open API v3 for posting listings
 * - OAuth 2.0 with PKCE for authentication
 * - Search via public API
 */

const ETSY_BASE_URL = "https://openapi.etsy.com/v3";
const ETSY_AUTH_URL = "https://www.etsy.com/oauth/connect";

export interface EtsyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface EtsyListing {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  images: string[];
  tags: string[];
}

export interface EtsySearchResult {
  title: string;
  price: number;
  url: string;
  image?: string;
  location?: string;
  platform: "ETSY";
}

// OAuth: Generate PKCE code verifier and challenge
export function generatePKCE(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = Buffer.from(array).toString("base64url");

  // SHA-256 hash for code challenge (simplified - in production use proper crypto)
  const codeChallenge = codeVerifier; // Plain method for simplicity

  return { codeVerifier, codeChallenge };
}

// OAuth: Get authorization URL
export function getEtsyAuthUrl(
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ETSY_CLIENT_ID ?? "",
    redirect_uri: process.env.ETSY_REDIRECT_URI ?? "",
    scope:
      "listings_r listings_w listings_d shops_r shops_w",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "plain",
  });

  return `${ETSY_AUTH_URL}?${params.toString()}`;
}

// OAuth: Exchange code for tokens
export async function exchangeEtsyCode(
  code: string,
  codeVerifier: string
): Promise<EtsyTokenResponse> {
  const response = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ETSY_CLIENT_ID ?? "",
      redirect_uri: process.env.ETSY_REDIRECT_URI ?? "",
      code,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Etsy token exchange failed: ${error}`);
  }

  return response.json();
}

// OAuth: Refresh access token
export async function refreshEtsyToken(
  refreshToken: string
): Promise<EtsyTokenResponse> {
  const response = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ETSY_CLIENT_ID ?? "",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Etsy token");
  }

  return response.json();
}

// Get the connected shop ID
async function getEtsyShopId(accessToken: string): Promise<number> {
  const response = await fetch(`${ETSY_BASE_URL}/application/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-api-key": process.env.ETSY_CLIENT_ID ?? "",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get Etsy user info");
  }

  interface EtsyUser {
    user_id: number;
    primary_email: string;
  }

  const user = await response.json() as EtsyUser;

  // Get the user's shop
  const shopsResponse = await fetch(
    `${ETSY_BASE_URL}/application/users/${user.user_id}/shops`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-api-key": process.env.ETSY_CLIENT_ID ?? "",
      },
    }
  );

  if (!shopsResponse.ok) {
    throw new Error("Failed to get Etsy shops");
  }

  interface EtsyShop {
    shop_id: number;
  }

  const shops = await shopsResponse.json() as { results: EtsyShop[] };
  if (!shops.results || shops.results.length === 0) {
    throw new Error("No Etsy shop found for this account");
  }

  return shops.results[0].shop_id;
}

// Post a listing to Etsy
export async function postToEtsy(
  accessToken: string,
  listing: EtsyListing
): Promise<{ listingId: string; url: string }> {
  const shopId = await getEtsyShopId(accessToken);

  // Map condition
  const conditionMap: Record<string, string> = {
    NEW: "new",
    LIKE_NEW: "used_excellent",
    VERY_GOOD: "used_good",
    GOOD: "used_good",
    ACCEPTABLE: "used_fair",
    FOR_PARTS: "not_specified",
  };

  const response = await fetch(
    `${ETSY_BASE_URL}/application/shops/${shopId}/listings`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-api-key": process.env.ETSY_CLIENT_ID ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quantity: 1,
        title: listing.title.slice(0, 140),
        description: listing.description,
        price: listing.price,
        who_made: "i_did",
        when_made: "2020_2024",
        taxonomy_id: 69, // Default taxonomy
        state: "active",
        type: "physical",
        tags: listing.tags.slice(0, 13),
        item_weight: 0,
        item_length: 0,
        item_width: 0,
        item_height: 0,
        is_customizable: false,
        processing_min: 1,
        processing_max: 3,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Etsy listing: ${error}`);
  }

  interface EtsyListingResponse {
    listing_id: number;
    url: string;
  }

  const data = await response.json() as EtsyListingResponse;

  return {
    listingId: String(data.listing_id),
    url: data.url ?? `https://www.etsy.com/listing/${data.listing_id}`,
  };
}

// Search Etsy listings
export async function searchEtsy(
  query: string,
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
  }
): Promise<EtsySearchResult[]> {
  const params = new URLSearchParams({
    keywords: query,
    limit: String(filters?.limit ?? 20),
    sort_on: "score",
  });

  if (filters?.minPrice) params.append("min_price", String(filters.minPrice));
  if (filters?.maxPrice) params.append("max_price", String(filters.maxPrice));

  const response = await fetch(
    `${ETSY_BASE_URL}/application/listings/active?${params.toString()}`,
    {
      headers: {
        "x-api-key": process.env.ETSY_CLIENT_ID ?? "",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Etsy search failed: ${error}`);
  }

  interface EtsyItem {
    title: string;
    price?: { amount: number; divisor: number };
    url: string;
    main_image?: { url_570xN: string };
  }

  const data = await response.json() as { results: EtsyItem[] };

  return (data.results ?? []).map((item: EtsyItem) => ({
    title: item.title,
    price: item.price
      ? item.price.amount / item.price.divisor
      : 0,
    url: item.url,
    image: item.main_image?.url_570xN,
    platform: "ETSY" as const,
  }));
}
