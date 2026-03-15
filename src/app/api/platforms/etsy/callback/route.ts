import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { exchangeEtsyCode } from "@/lib/platforms/etsy";
import { encrypt } from "@/lib/encryption";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/dashboard/platforms?error=etsy_${error ?? "no_code"}`, request.url)
    );
  }

  // Retrieve code verifier from state (stored in session/cookie in a real app)
  // For simplicity, we store the code verifier in the state param
  const codeVerifier = state ?? "";

  try {
    const tokens = await exchangeEtsyCode(code, codeVerifier);

    await prisma.platformConnection.upsert({
      where: {
        userId_platform: {
          userId: session.user.id,
          platform: "ETSY",
        },
      },
      create: {
        userId: session.user.id,
        platform: "ETSY",
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
      new URL("/dashboard/platforms?success=etsy", request.url)
    );
  } catch (error) {
    console.error("Etsy OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/platforms?error=etsy_exchange", request.url)
    );
  }
}
