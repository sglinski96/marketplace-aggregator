import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await prisma.platformConnection.findMany({
    where: { userId: session.user.id },
    select: {
      platform: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(connections);
}
