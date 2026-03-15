import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  Package,
} from "lucide-react";

const PLATFORM_COLORS: Record<string, string> = {
  EBAY: "bg-yellow-100 text-yellow-800",
  ETSY: "bg-orange-100 text-orange-800",
  FACEBOOK: "bg-blue-100 text-blue-800",
  CRAIGSLIST: "bg-purple-100 text-purple-800",
  OFFERUP: "bg-green-100 text-green-800",
};

export default async function ListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  const listing = await prisma.listing.findFirst({
    where: { id: params.id, userId: session!.user!.id },
    include: { platformListings: true },
  });

  if (!listing) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{listing.title}</h1>
          <p className="text-slate-500">
            ${Number(listing.price).toFixed(2)} •{" "}
            {listing.condition.replace("_", " ")} • {listing.category}
          </p>
        </div>
        {listing.aiGenerated && (
          <Badge className="gap-1 bg-purple-100 text-purple-800">
            <Sparkles className="h-3 w-3" />
            AI Generated
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Images */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="pt-6">
              {listing.images.length > 0 ? (
                <div className="space-y-2">
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  {listing.images.length > 1 && (
                    <div className="grid grid-cols-4 gap-1">
                      {listing.images.slice(1, 5).map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`${listing.title} ${i + 2}`}
                          className="aspect-square object-cover rounded"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center">
                  <Package className="h-12 w-12 text-slate-300" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                {listing.description}
              </p>
              {listing.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {listing.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Platform Status */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Status</CardTitle>
            </CardHeader>
            <CardContent>
              {listing.platformListings.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <p>Not posted to any platforms yet</p>
                  <Link href={`/listings/new`} className="mt-2 inline-block">
                    <Button size="sm" variant="outline" className="mt-2">
                      Post to Platforms
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {listing.platformListings.map((pl) => (
                    <div
                      key={pl.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${PLATFORM_COLORS[pl.platform] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {pl.platform}
                        </span>
                        <div>
                          <StatusLine status={pl.status} />
                          {pl.error && (
                            <p className="text-xs text-red-500 mt-0.5">
                              {pl.error}
                            </p>
                          )}
                          {pl.postedAt && (
                            <p className="text-xs text-slate-400">
                              Posted {new Date(pl.postedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      {pl.url && (
                        <a
                          href={pl.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-blue-600"
                          >
                            <ExternalLink className="h-4 w-4" />
                            View
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatusLine({ status }: { status: string }) {
  const configs = {
    SUCCESS: {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      text: "Posted successfully",
      class: "text-green-700",
    },
    PENDING: {
      icon: <Clock className="h-4 w-4 text-yellow-500" />,
      text: "Queued for posting",
      class: "text-yellow-700",
    },
    POSTING: {
      icon: <Clock className="h-4 w-4 text-blue-500 animate-spin" />,
      text: "Posting now...",
      class: "text-blue-700",
    },
    FAILED: {
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      text: "Posting failed",
      class: "text-red-700",
    },
  };

  const config = configs[status as keyof typeof configs] ?? configs.PENDING;

  return (
    <div className={`flex items-center gap-1 text-sm font-medium ${config.class}`}>
      {config.icon}
      {config.text}
    </div>
  );
}
