import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Search,
  Package,
  Zap,
  Globe,
  Star,
  TrendingUp,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-blue-400">MarketReach</div>
        <div className="flex gap-4">
          <Link href="/search">
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Search
            </Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Sign In
            </Button>
          </Link>
          <Link href="/auth/register">
            <Button className="bg-blue-600 hover:bg-blue-700">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-900/40 border border-blue-700/50 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-8">
          <Zap className="h-3.5 w-3.5" />
          AI-Powered Multi-Platform Selling
        </div>
        <h1 className="text-6xl font-bold mb-6 leading-tight">
          List Once.
          <br />
          <span className="text-blue-400">Sell Everywhere.</span>
        </h1>
        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
          AI generates your perfect listing from photos. One click posts to
          eBay, Etsy, Facebook Marketplace, Craigslist, and OfferUp
          simultaneously.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/register">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              Start Selling Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/search">
            <Button
              size="lg"
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700 px-8"
            >
              <Search className="mr-2 h-5 w-5" />
              Search All Marketplaces
            </Button>
          </Link>
        </div>
      </section>

      {/* Platform logos */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <p className="text-center text-slate-500 mb-8 text-sm uppercase tracking-wider">
          Post to all major platforms
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
          {["eBay", "Etsy", "Facebook Marketplace", "Craigslist", "OfferUp"].map(
            (platform) => (
              <div
                key={platform}
                className="bg-slate-700 rounded-lg px-6 py-3 text-slate-300 font-medium"
              >
                {platform}
              </div>
            )
          )}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything you need to sell smarter
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Zap className="h-6 w-6 text-yellow-400" />}
            title="AI Listing Generator"
            description="Upload photos and Claude AI instantly writes a compelling title, description, and suggests the optimal price based on market data."
          />
          <FeatureCard
            icon={<Globe className="h-6 w-6 text-blue-400" />}
            title="Cross-Platform Posting"
            description="Connect your accounts once. Post simultaneously to eBay, Etsy, Facebook Marketplace, Craigslist, and OfferUp with a single click."
          />
          <FeatureCard
            icon={<TrendingUp className="h-6 w-6 text-green-400" />}
            title="Real-Time Status"
            description="Track exactly where your listings are posted. Get notified instantly when each platform confirms your listing is live."
          />
          <FeatureCard
            icon={<Search className="h-6 w-6 text-purple-400" />}
            title="Unified Search"
            description="Search for items across all platforms simultaneously. Compare prices from eBay, Etsy, Craigslist, and more in one view."
          />
          <FeatureCard
            icon={<Package className="h-6 w-6 text-orange-400" />}
            title="Listing Management"
            description="Manage all your active listings across every platform from a single dashboard. Edit once, update everywhere."
          />
          <FeatureCard
            icon={<Star className="h-6 w-6 text-pink-400" />}
            title="Smart Optimization"
            description="AI analyzes successful listings in your category to optimize your title and description for maximum visibility."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-bold mb-4">
          Ready to reach more buyers?
        </h2>
        <p className="text-slate-400 mb-8">
          Join thousands of sellers saving hours every week with MarketReach.
        </p>
        <Link href="/auth/register">
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-10"
          >
            Create Free Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-12 py-8 text-center text-slate-500 text-sm">
        <p>© 2026 MarketReach. Built with Next.js + Claude AI.</p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
