"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, ExternalLink, Loader2, Filter, X } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  price: number;
  url: string;
  image?: string;
  location?: string;
  platform: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  EBAY: "bg-yellow-100 text-yellow-800",
  ETSY: "bg-orange-100 text-orange-800",
  FACEBOOK: "bg-blue-100 text-blue-800",
  CRAIGSLIST: "bg-purple-100 text-purple-800",
  OFFERUP: "bg-green-100 text-green-800",
};

const ALL_PLATFORMS = ["EBAY", "ETSY", "FACEBOOK", "CRAIGSLIST", "OFFERUP"];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  // Filters
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(ALL_PLATFORMS);
  const [sortBy, setSortBy] = useState("relevance");
  const [showFilters, setShowFilters] = useState(false);

  // Active filter for platform toggle
  const [activePlatformFilter, setActivePlatformFilter] = useState<string | null>(null);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      q: query.trim(),
      platforms: selectedPlatforms.join(","),
      sort: sortBy,
    });

    if (minPrice) params.append("minPrice", minPrice);
    if (maxPrice) params.append("maxPrice", maxPrice);

    try {
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();
      setResults(data.results);
      setSearched(true);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  const filteredResults = activePlatformFilter
    ? results.filter((r) => r.platform === activePlatformFilter)
    : results;

  const platformCounts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.platform] = (acc[r.platform] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-blue-600 whitespace-nowrap">
              MarketReach
            </Link>
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search all marketplaces..."
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </form>
            <Link href="/auth/login">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </Link>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="mt-4 p-4 border rounded-lg bg-slate-50 flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Min Price ($)</Label>
                <Input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                  className="w-28 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Price ($)</Label>
                <Input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Any"
                  className="w-28 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sort</Label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-8 text-sm border rounded-md px-2 bg-white"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Platforms</Label>
                <div className="flex gap-1 flex-wrap">
                  {ALL_PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        selectedPlatforms.includes(p)
                          ? PLATFORM_COLORS[p]
                          : "bg-white text-slate-400 border-slate-200"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Platform filter pills */}
        {searched && results.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap items-center">
            <span className="text-sm text-slate-500">
              {filteredResults.length} results
            </span>
            <button
              onClick={() => setActivePlatformFilter(null)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                !activePlatformFilter
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              All ({results.length})
            </button>
            {Object.entries(platformCounts).map(([platform, count]) => (
              <button
                key={platform}
                onClick={() =>
                  setActivePlatformFilter(
                    activePlatformFilter === platform ? null : platform
                  )
                }
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  activePlatformFilter === platform
                    ? PLATFORM_COLORS[platform]
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {platform} ({count})
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
            <p className="text-slate-600">Searching across all platforms...</p>
            <p className="text-slate-400 text-sm mt-1">
              eBay, Etsy, Facebook Marketplace, Craigslist, OfferUp
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && searched && filteredResults.length === 0 && (
          <div className="text-center py-20">
            <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">
              No results found
            </h3>
            <p className="text-slate-400">
              Try different keywords or adjust your filters
            </p>
          </div>
        )}

        {/* Initial state */}
        {!loading && !searched && (
          <div className="text-center py-20">
            <Search className="h-16 w-16 text-slate-200 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-700 mb-3">
              Search all marketplaces at once
            </h2>
            <p className="text-slate-400 max-w-md mx-auto">
              Find the best deals from eBay, Etsy, Facebook Marketplace,
              Craigslist, and OfferUp in a single search.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-6">
              {["vintage lamp", "iPhone 15", "mid century chair", "guitar"].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setQuery(suggestion);
                    }}
                    className="text-sm bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* Results grid */}
        {!loading && filteredResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredResults.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <div className="aspect-square bg-slate-100 overflow-hidden">
        {result.image ? (
          <img
            src={result.image}
            alt={result.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Search className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PLATFORM_COLORS[result.platform] ?? "bg-slate-100 text-slate-600"}`}
          >
            {result.platform}
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-400 flex-shrink-0 mt-0.5 transition-colors" />
        </div>

        <h3 className="text-sm font-medium text-slate-800 line-clamp-2 mb-1 leading-snug">
          {result.title}
        </h3>

        <div className="flex items-center justify-between mt-2">
          <span className="text-lg font-bold text-slate-900">
            {result.price > 0 ? `$${result.price.toFixed(2)}` : "Free"}
          </span>
          {result.location && (
            <span className="text-xs text-slate-400 truncate ml-2">
              {result.location}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
