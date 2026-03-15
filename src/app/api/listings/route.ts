import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const createListingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  price: z.number().positive(),
  category: z.string().min(1),
  condition: z.enum(["NEW", "LIKE_NEW", "VERY_GOOD", "GOOD", "ACCEPTABLE", "FOR_PARTS"]),
  images: z.array(z.string().url()),
  tags: z.array(z.string()).default([]),
  aiGenerated: z.boolean().default(false),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listings = await prisma.listing.findMany({
    where: { userId: session.user.id },
    include: {
      platformListings: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(listings);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createListingSchema.parse(body);

    const listing = await prisma.listing.create({
      data: {
        ...data,
        userId: session.user.id,
      },
      include: { platformListings: true },
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Create listing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
