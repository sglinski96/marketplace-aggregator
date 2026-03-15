import { Queue } from "bullmq";

// BullMQ bundles its own ioredis - use connection URL string to avoid type conflicts
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const urlParts = new URL(redisUrl);

export const redisConnection = {
  host: urlParts.hostname,
  port: parseInt(urlParts.port || "6379"),
  password: urlParts.password || undefined,
  maxRetriesPerRequest: null as null,
};

export const POSTING_QUEUE_NAME = "platform-posting";

export interface PostingJobData {
  platformListingId: string;
  listingId: string;
  userId: string;
  platform: string;
  listing: {
    title: string;
    description: string;
    price: number;
    category: string;
    condition: string;
    images: string[];
    tags: string[];
  };
}

export const postingQueue = new Queue<PostingJobData>(POSTING_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export async function enqueuePostingJob(data: PostingJobData): Promise<string> {
  const job = await postingQueue.add(
    "post-to-platform",
    data,
    {
      jobId: `${data.platformListingId}-${data.platform}`,
    }
  );
  return job.id ?? "";
}

export async function getJobStatus(jobId: string) {
  const job = await postingQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    id: job.id,
    state,
    progress: job.progress,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}
