import { NextRequest, NextResponse } from "next/server";
import { decryptSession } from "@/modules/auth/utils";
import { prisma } from "@/lib/prisma";

const CHAT_MEMORY_KEY = "CHAT_HISTORY_V1";
const MAX_STORED_MESSAGES = 40;

async function getSessionUser(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const sessionCookieMatch = cookieHeader.match(/session=([^;]+)/);
  const sessionToken = sessionCookieMatch ? sessionCookieMatch[1] : "";
  if (!sessionToken) return null;
  const session = await decryptSession(sessionToken);
  return session?.userId ? { userId: session.userId, role: session.role } : null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getSessionUser(req);
    if (!auth) {
      return NextResponse.json({ messages: [], persisted: false });
    }

    const memory = await prisma.ai_memories.findFirst({
      where: {
        userId: auth.userId,
        key: CHAT_MEMORY_KEY,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!memory) {
      return NextResponse.json({ messages: [], persisted: true });
    }

    try {
      const parsed = JSON.parse(memory.value);
      return NextResponse.json({
        messages: Array.isArray(parsed) ? parsed : [],
        persisted: true,
        updatedAt: memory.createdAt,
      });
    } catch {
      return NextResponse.json({ messages: [], persisted: true });
    }
  } catch (error: any) {
    console.error("Failed to fetch chat history:", error);
    return NextResponse.json({ messages: [], persisted: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getSessionUser(req);
    if (!auth) {
      return NextResponse.json({ saved: false, reason: "guest" });
    }

    const body = await req.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const trimmedMessages = rawMessages.slice(-MAX_STORED_MESSAGES);

    const serialized = JSON.stringify(trimmedMessages);

    const existing = await prisma.ai_memories.findFirst({
      where: {
        userId: auth.userId,
        key: CHAT_MEMORY_KEY,
      },
    });

    if (existing) {
      await prisma.ai_memories.update({
        where: { id: existing.id },
        data: {
          value: serialized,
          createdAt: new Date(),
        },
      });
    } else {
      await prisma.ai_memories.create({
        data: {
          id: crypto.randomUUID(),
          userId: auth.userId,
          key: CHAT_MEMORY_KEY,
          value: serialized,
        },
      });
    }

    // Ensure an active chat_sessions record exists for audit/support tracking
    const hotel = await prisma.hotels.findFirst();
    if (hotel) {
      const existingSession = await prisma.chat_sessions.findFirst({
        where: { userId: auth.userId, hotelId: hotel.id, status: "ACTIVE" },
      });
      if (existingSession) {
        await prisma.chat_sessions.update({
          where: { id: existingSession.id },
          data: { updatedAt: new Date() },
        });
      } else {
        await prisma.chat_sessions.create({
          data: {
            id: crypto.randomUUID(),
            userId: auth.userId,
            hotelId: hotel.id,
            status: "ACTIVE",
            updatedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ saved: true, count: trimmedMessages.length });
  } catch (error: any) {
    console.error("Failed to persist chat history:", error);
    return NextResponse.json({ saved: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getSessionUser(req);
    if (!auth) {
      return NextResponse.json({ cleared: true });
    }

    await prisma.ai_memories.deleteMany({
      where: {
        userId: auth.userId,
        key: CHAT_MEMORY_KEY,
      },
    });

    return NextResponse.json({ cleared: true });
  } catch (error: any) {
    console.error("Failed to clear chat history:", error);
    return NextResponse.json({ cleared: false, error: error.message }, { status: 500 });
  }
}
