import { NextResponse } from "next/server";
import { searchEbay } from "@/lib/platforms/ebay";
import { searchEtsy } from "@/lib/platforms/etsy";
import { searchFacebook } from "@/lib/platforms/facebook";
import { searchCraigslist } from "@/lib/platforms/craigslist";
import { searchOfferUp } from "@/lib/platforms/offerup";

export interface UnifiedSearchResult {
  id: string;
  title: string;
  price: number;
  url: string;
  image?: string;
  location?: string;
  platform: "EBAY" | "ETSY" | "FACEBOOK" | "CRAIGSLIST" | "OFFERUP";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const platformsParam = searchParams.get("platforms");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const area = searchParams.get("area") ?? "sfbay";

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const requestedPlatforms = platformsParam
    ? platformsParam.split(",")
    : ["EBAY", "ETSY", "FACEBOOK", "CRAIGSLIST", "OFFERUP"];

  const filters = {
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    limit: 20,
    area,
  };

  // Fire all search requests in parallel
  const searchPromises: Promise<UnifiedSearchResult[]>[] = [];

  if (requestedPlatforms.includes("EBAY")) {
    searchPromises.push(
      searchEbay(query, filters)
        .then((results) =>
          results.map((r, i) => ({ ...r, id: `ebay-${i}-${Date.now()}` }))
        )
        .catch((err) => {
          console.error("eBay search error:", err.message);
          return [];
        })
    );
  }

  if (requestedPlatforms.includes("ETSY")) {
    searchPromises.push(
      searchEtsy(query, filters)
        .then((results) =>
          results.map((r, i) => ({ ...r, id: `etsy-${i}-${Date.now()}` }))
        )
        .catch((err) => {
          console.error("Etsy search error:", err.message);
          return [];
        })
    );
  }

  if (requestedPlatforms.includes("FACEBOOK")) {
    searchPromises.push(
      searchFacebook(query, filters)
        .then((results) =>
          results.map((r, i) => ({ ...r, id: `fb-${i}-${Date.now()}` }))
        )
        .catch((err) => {
          console.error("Facebook search error:", err.message);
          return [];
        })
    );
  }

  if (requestedPlatforms.includes("CRAIGSLIST")) {
    searchPromises.push(
      searchCraigslist(query, filters)
        .then((results) =>
          results.map((r, i) => ({ ...r, id: `cl-${i}-${Date.now()}` }))
        )
        .catch((err) => {
          console.error("Craigslist search error:", err.message);
          return [];
        })
    );
  }

  if (requestedPlatforms.includes("OFFERUP")) {
    searchPromises.push(
      searchOfferUp(query, filters)
        .then((results) =>
          results.map((r, i) => ({ ...r, id: `ou-${i}-${Date.now()}` }))
        )
        .catch((err) => {
          console.error("OfferUp search error:", err.message);
          return [];
        })
    );
  }

  const allResults = await Promise.all(searchPromises);
  const flattened = allResults.flat();

  // Sort by relevance (title match score) then price
  const sortParam = searchParams.get("sort") ?? "relevance";
  const sorted = flattened.sort((a, b) => {
    if (sortParam === "price_asc") return a.price - b.price;
    if (sortParam === "price_desc") return b.price - a.price;
    // Default: basic relevance (title contains query words)
    const queryWords = query.toLowerCase().split(" ");
    const scoreA = queryWords.filter((w) => a.title.toLowerCase().includes(w)).length;
    const scoreB = queryWords.filter((w) => b.title.toLowerCase().includes(w)).length;
    return scoreB - scoreA;
  });

  return NextResponse.json({
    query,
    total: sorted.length,
    results: sorted,
  });
}
