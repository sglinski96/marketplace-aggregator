import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { exchangeEbayCode } from "@/lib/platforms/ebay";
import { encrypt } from "@/lib/encryption";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/dashboard/platforms?error=ebay_${error ?? "no_code"}`, request.url)
    );
  }

  try {
    const tokens = await exchangeEbayCode(code);

    await prisma.platformConnection.upsert({
      where: {
        userId_platform: {
          userId: session.user.id,
          platform: "EBAY",
        },
      },
      create: {
        userId: session.user.id,
        platform: "EBAY",
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard/platforms?success=ebay", request.url)
    );
  } catch (error) {
    console.error("eBay OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/platforms?error=ebay_exchange", request.url)
    );
  }
}
