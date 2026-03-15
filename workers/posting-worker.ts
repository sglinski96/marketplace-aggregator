/**
 * BullMQ Worker Process
 * Run separately with: npm run worker
 * Handles async platform posting jobs
 */

import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import {
  POSTING_QUEUE_NAME,
  PostingJobData,
  redisConnection,
} from "../src/lib/queue/posting-queue";
import { decrypt } from "../src/lib/encryption";

const prisma = new PrismaClient();

// Import platform modules
import { postToEbay, refreshEbayToken } from "../src/lib/platforms/ebay";
import { postToEtsy, refreshEtsyToken } from "../src/lib/platforms/etsy";
import { postToFacebook } from "../src/lib/platforms/facebook";
import { postToCraigslist } from "../src/lib/platforms/craigslist";
import { postToOfferUp } from "../src/lib/platforms/offerup";

async function processPostingJob(job: Job<PostingJobData>): Promise<void> {
  const { platformListingId, listingId, userId, platform, listing } = job.data;

  // Update status to POSTING
  await prisma.platformListing.update({
    where: { id: platformListingId },
    data: { status: "POSTING" },
  });

  try {
    // Get platform connection for this user
    const connection = await prisma.platformConnection.findUnique({
      where: {
        userId_platform: {
          userId,
          platform: platform as "EBAY" | "ETSY" | "FACEBOOK" | "CRAIGSLIST" | "OFFERUP",
        },
      },
    });

    if (!connection) {
      throw new Error(`No ${platform} connection found for user`);
    }

    let result: { listingId: string; url: string };

    await job.updateProgress(25);

    switch (platform) {
      case "EBAY": {
        let accessToken = connection.accessToken
          ? decrypt(connection.accessToken)
          : null;

        // Refresh token if expired
        if (connection.expiresAt && new Date() > connection.expiresAt) {
          if (!connection.refreshToken) {
            throw new Error("eBay refresh token not available");
          }
          const tokens = await refreshEbayToken(decrypt(connection.refreshToken));
          accessToken = tokens.access_token;

          // Update stored tokens
          const { encrypt } = await import("../src/lib/encryption");
          await prisma.platformConnection.update({
            where: { id: connection.id },
            data: {
              accessToken: encrypt(tokens.access_token),
              refreshToken: encrypt(tokens.refresh_token),
              expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            },
          });
        }

        if (!accessToken) throw new Error("No eBay access token");

        result = await postToEbay(accessToken, {
          title: listing.title,
          description: listing.description,
          price: listing.price,
          category: listing.category,
          condition: listing.condition,
          images: listing.images,
        });
        break;
      }

      case "ETSY": {
        let accessToken = connection.accessToken
          ? decrypt(connection.accessToken)
          : null;

        if (connection.expiresAt && new Date() > connection.expiresAt) {
          if (!connection.refreshToken) {
            throw new Error("Etsy refresh token not available");
          }
          const tokens = await refreshEtsyToken(decrypt(connection.refreshToken));
          accessToken = tokens.access_token;

          const { encrypt } = await import("../src/lib/encryption");
          await prisma.platformConnection.update({
            where: { id: connection.id },
            data: {
              accessToken: encrypt(tokens.access_token),
              refreshToken: encrypt(tokens.refresh_token),
              expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            },
          });
        }

        if (!accessToken) throw new Error("No Etsy access token");

        result = await postToEtsy(accessToken, {
          title: listing.title,
          description: listing.description,
          price: listing.price,
          category: listing.category,
          condition: listing.condition,
          images: listing.images,
          tags: listing.tags,
        });
        break;
      }

      case "FACEBOOK":
      case "CRAIGSLIST":
      case "OFFERUP": {
        if (!connection.credentials) {
          throw new Error(`No credentials stored for ${platform}`);
        }

        const credData = connection.credentials as Record<string, string>;
        const email = decrypt(credData.email);
        const password = decrypt(credData.password);

        if (platform === "FACEBOOK") {
          result = await postToFacebook(
            { email, password },
            {
              title: listing.title,
              description: listing.description,
              price: listing.price,
              category: listing.category,
              condition: listing.condition,
              images: listing.images,
            }
          );
        } else if (platform === "CRAIGSLIST") {
          result = await postToCraigslist(
            { email, password, area: credData.area },
            {
              title: listing.title,
              description: listing.description,
              price: listing.price,
              category: listing.category,
              condition: listing.condition,
              images: listing.images,
              area: credData.area,
            }
          );
        } else {
          result = await postToOfferUp(
            { email, password },
            {
              title: listing.title,
              description: listing.description,
              price: listing.price,
              category: listing.category,
              condition: listing.condition,
              images: listing.images,
            }
          );
        }
        break;
      }

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    await job.updateProgress(90);

    // Update platform listing with success
    await prisma.platformListing.update({
      where: { id: platformListingId },
      data: {
        status: "SUCCESS",
        platformListingId: result.listingId,
        url: result.url,
        postedAt: new Date(),
        error: null,
      },
    });

    await job.updateProgress(100);
    console.log(`✅ Posted to ${platform}: ${result.url}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Update platform listing with failure
    await prisma.platformListing.update({
      where: { id: platformListingId },
      data: {
        status: "FAILED",
        error: errorMessage,
      },
    });

    console.error(`❌ Failed to post to ${platform}:`, errorMessage);
    throw error; // Re-throw for BullMQ retry logic
  }
}

// Create and start the worker
const worker = new Worker<PostingJobData>(
  POSTING_QUEUE_NAME,
  processPostingJob,
  {
    connection: redisConnection,
    concurrency: 2, // Process 2 jobs at a time
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log("🚀 Posting worker started");
