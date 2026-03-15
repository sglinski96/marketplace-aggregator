import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getEbayAuthUrl } from "@/lib/platforms/ebay";
import { getEtsyAuthUrl, generatePKCE } from "@/lib/platforms/etsy";
import { encrypt } from "@/lib/encryption";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  area: z.string().optional(), // For Craigslist
});

export async function POST(
  request: Request,
  { params }: { params: { platform: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = params.platform.toUpperCase();

  // OAuth platforms - return redirect URL
  if (platform === "EBAY") {
    const state = crypto.randomUUID();
    const authUrl = getEbayAuthUrl(state);
    return NextResponse.json({ redirectUrl: authUrl });
  }

  if (platform === "ETSY") {
    const { codeVerifier, codeChallenge } = generatePKCE();
    const authUrl = getEtsyAuthUrl(codeVerifier, codeChallenge);
    // In a production app, store codeVerifier in session/Redis
    return NextResponse.json({ redirectUrl: authUrl });
  }

  // Credential-based platforms (Facebook, Craigslist, OfferUp)
  if (["FACEBOOK", "CRAIGSLIST", "OFFERUP"].includes(platform)) {
    try {
      const body = await request.json();
      const { email, password, area } = credentialsSchema.parse(body);

      await prisma.platformConnection.upsert({
        where: {
          userId_platform: {
            userId: session.user.id,
            platform: platform as "FACEBOOK" | "CRAIGSLIST" | "OFFERUP",
          },
        },
        create: {
          userId: session.user.id,
          platform: platform as "FACEBOOK" | "CRAIGSLIST" | "OFFERUP",
          credentials: {
            email: encrypt(email),
            password: encrypt(password),
            ...(area && { area }),
          },
        },
        update: {
          credentials: {
            email: encrypt(email),
            password: encrypt(password),
            ...(area && { area }),
          },
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to save credentials" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { platform: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = params.platform.toUpperCase();

  await prisma.platformConnection.deleteMany({
    where: {
      userId: session.user.id,
      platform: platform as "EBAY" | "ETSY" | "FACEBOOK" | "CRAIGSLIST" | "OFFERUP",
    },
  });

  return NextResponse.json({ success: true });
}
