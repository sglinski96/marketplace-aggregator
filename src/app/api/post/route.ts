import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { enqueuePostingJob } from "@/lib/queue/posting-queue";
import { z } from "zod";

const postSchema = z.object({
  listingId: z.string(),
  platforms: z.array(
    z.enum(["EBAY", "ETSY", "FACEBOOK", "CRAIGSLIST", "OFFERUP"])
  ),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { listingId, platforms } = postSchema.parse(body);

    // Get the listing
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, userId: session.user.id },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const results: Record<string, { jobId: string; platformListingId: string }> = {};

    for (const platform of platforms) {
      // Create or update platform listing record
      const platformListing = await prisma.platformListing.upsert({
        where: {
          id: `${listingId}-${platform}`,
        },
        create: {
          listingId,
          platform,
          status: "PENDING",
        },
        update: {
          status: "PENDING",
          error: null,
          url: null,
          platformListingId: null,
        },
      });

      // Enqueue posting job
      const jobId = await enqueuePostingJob({
        platformListingId: platformListing.id,
        listingId,
        userId: session.user.id,
        platform,
        listing: {
          title: listing.title,
          description: listing.description,
          price: Number(listing.price),
          category: listing.category,
          condition: listing.condition,
          images: listing.images,
          tags: listing.tags,
        },
      });

      // Save job ID
      await prisma.platformListing.update({
        where: { id: platformListing.id },
        data: { jobId },
      });

      results[platform] = {
        jobId,
        platformListingId: platformListing.id,
      };
    }

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Post listing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
