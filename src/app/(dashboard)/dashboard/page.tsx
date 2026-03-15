import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  FileEdit,
} from "lucide-react";

const PLATFORM_COLORS: Record<string, string> = {
  EBAY: "bg-yellow-100 text-yellow-800",
  ETSY: "bg-orange-100 text-orange-800",
  FACEBOOK: "bg-blue-100 text-blue-800",
  CRAIGSLIST: "bg-purple-100 text-purple-800",
  OFFERUP: "bg-green-100 text-green-800",
};

const STATUS_ICONS = {
  SUCCESS: <CheckCircle className="h-4 w-4 text-green-500" />,
  PENDING: <Clock className="h-4 w-4 text-yellow-500" />,
  POSTING: <Clock className="h-4 w-4 text-blue-500 animate-spin" />,
  FAILED: <XCircle className="h-4 w-4 text-red-500" />,
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  const [listings, connections] = await Promise.all([
    prisma.listing.findMany({
      where: { userId: session!.user!.id },
      include: { platformListings: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.platformConnection.findMany({
      where: { userId: session!.user!.id },
    }),
  ]);

  const totalActive = listings.filter((l) =>
    l.platformListings.some((pl) => pl.status === "SUCCESS")
  ).length;

  const totalPlatforms = connections.length;

  const totalPending = listings.flatMap((l) => l.platformListings).filter(
    (pl) => pl.status === "PENDING" || pl.status === "POSTING"
  ).length;

  const totalDrafts = listings.filter((l) =>
    !l.platformListings.some((pl) => pl.status === "SUCCESS" || pl.status === "POSTING")
  ).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">
            Welcome back, {session?.user?.name ?? session?.user?.email}
          </p>
        </div>
        <Link href="/listings/new">
          <Button className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Listing
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Active Listings"
          value={totalActive}
          description="Posted successfully"
          icon={<Package className="h-5 w-5 text-blue-600" />}
          color="blue"
        />
        <StatCard
          title="Drafts"
          value={totalDrafts}
          description="Not yet posted"
          icon={<FileEdit className="h-5 w-5 text-slate-500" />}
          color="slate"
        />
        <StatCard
          title="Connected Platforms"
          value={totalPlatforms}
          description="Ready to post"
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          color="green"
        />
        <StatCard
          title="Pending Posts"
          value={totalPending}
          description="In queue or processing"
          icon={<Clock className="h-5 w-5 text-yellow-600" />}
          color="yellow"
        />
      </div>

      {/* Recent Listings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Listings</CardTitle>
              <CardDescription>
                Your latest listings and their posting status
              </CardDescription>
            </div>
            <Link href="/listings/new">
              <Button size="sm" variant="outline" className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Create New
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {listings.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">
                No listings yet
              </h3>
              <p className="text-slate-400 mb-6">
                Create your first AI-powered listing and post it everywhere
              </p>
              <Link href="/listings/new">
                <Button className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Create First Listing
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {listing.images[0] ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-12 h-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-slate-200 flex items-center justify-center">
                        <Package className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <Link
                        href={`/listings/${listing.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600"
                      >
                        {listing.title}
                      </Link>
                      <p className="text-sm text-slate-500">
                        ${Number(listing.price).toFixed(2)} •{" "}
                        {listing.condition.replace("_", " ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {!listing.platformListings.some((pl) => pl.status === "SUCCESS" || pl.status === "POSTING") && (
                      <Badge variant="secondary" className="gap-1 text-slate-500">
                        <FileEdit className="h-3 w-3" />
                        Draft
                      </Badge>
                    )}
                    {listing.platformListings.map((pl) => (
                      <div
                        key={pl.id}
                        className="flex items-center gap-1"
                        title={pl.status}
                      >
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[pl.platform] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {pl.platform}
                        </span>
                        {STATUS_ICONS[pl.status]}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions if no platforms connected */}
      {totalPlatforms === 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 rounded-full p-3">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">
                  Connect your marketplace accounts
                </h3>
                <p className="text-sm text-blue-700">
                  Connect eBay, Etsy, and more to start posting your listings
                  everywhere
                </p>
              </div>
              <Link href="/platforms">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Connect Platforms
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  color,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "yellow" | "slate";
}) {
  const colorClasses = {
    blue: "bg-blue-50",
    green: "bg-green-50",
    yellow: "bg-yellow-50",
    slate: "bg-slate-100",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
            <p className="text-xs text-slate-400 mt-1">{description}</p>
          </div>
          <div className={`${colorClasses[color]} rounded-full p-3`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
