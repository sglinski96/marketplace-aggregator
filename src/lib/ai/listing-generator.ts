import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export interface GeneratedListing {
  title: string;
  description: string;
  suggestedPrice: number;
  category: string;
  condition: string;
  tags: string[];
}

// Fetch an image URL and convert to base64 for the Anthropic API
async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp" }> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const mediaType = (
    contentType.includes("png")
      ? "image/png"
      : contentType.includes("gif")
      ? "image/gif"
      : contentType.includes("webp")
      ? "image/webp"
      : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  return { data: base64, media_type: mediaType };
}

export async function generateListing(
  imageUrls: string[],
  basicInfo: string
): Promise<GeneratedListing> {
  // Fetch and convert images to base64 (required by this SDK version)
  const imageDataList = await Promise.all(
    imageUrls.slice(0, 4).map(fetchImageAsBase64) // Limit to 4 images
  );

  const imageContent: Anthropic.ImageBlockParam[] = imageDataList.map(
    ({ data, media_type }) => ({
      type: "image",
      source: {
        type: "base64",
        media_type,
        data,
      },
    })
  );

  const prompt = `You are a marketplace listing expert with deep knowledge of what sells on eBay, Etsy, Facebook Marketplace, Craigslist, and OfferUp.

Given these product photos and the following information: "${basicInfo}"

Generate an optimized marketplace listing with this exact JSON structure:
{
  "title": "compelling title under 80 characters optimized for search",
  "description": "detailed 3-4 paragraph description highlighting key features, condition details, dimensions if visible, and why a buyer would want this item",
  "suggestedPrice": 0,
  "category": "one of exactly: Electronics, Clothing & Accessories, Furniture, Home & Garden, Collectibles, Sporting Goods, Toys & Games, Books & Media, Vehicles, Musical Instruments, Art, Jewelry, Baby Items, Tools, Other",
  "condition": "one of: New, Like New, Very Good, Good, Acceptable, For Parts",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Guidelines:
- Title: Include brand, model, key features, condition. Be specific and searchable.
- Description: Start with the most compelling aspect. Include dimensions, color, material, brand, model number if visible. Mention what's included. End with shipping/pickup info placeholder.
- Price: Research typical selling price for this item on the mentioned platforms. Be realistic and competitive.
- Tags: Choose 5 highly-searched keywords that buyers would use to find this item.

Return ONLY valid JSON, no other text.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          ...imageContent,
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude API");
  }

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    const parsed = JSON.parse(jsonMatch[0]) as GeneratedListing;
    return parsed;
  } catch {
    throw new Error(`Failed to parse Claude response: ${content.text}`);
  }
}

export async function improveListingDescription(
  title: string,
  description: string,
  targetPlatform?: string
): Promise<string> {
  const platformContext = targetPlatform
    ? ` optimized for ${targetPlatform}`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Improve this marketplace listing description${platformContext}. Make it more compelling and detailed while keeping it authentic.

Title: ${title}
Current Description: ${description}

Return only the improved description text, no other content.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude API");
  }

  return content.text;
}
