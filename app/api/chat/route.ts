// @ts-nocheck
import { streamText, tool, convertToModelMessages } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { decryptSession } from '@/modules/auth/utils';
import { RoomsService } from '@/modules/rooms/service';
import { BookingsService } from '@/modules/bookings/service';
import { ReportsService } from '@/modules/reports/service';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, addDays } from 'date-fns';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    // Cookie parsing
    const cookieHeader = req.headers.get("cookie") || "";
    const sessionCookieMatch = cookieHeader.match(/session=([^;]+)/);
    const sessionToken = sessionCookieMatch ? sessionCookieMatch[1] : "";
    const session = await decryptSession(sessionToken);
    
    const role = session?.role || "GUEST";
    const userId = session?.userId || null;

    const hotel = await prisma.hotels.findFirst();
    const hotelId = hotel?.id || "";

    let systemPrompt = "You are a helpful and polite hotel AI assistant. Answer concisely.";
    let tools: any = {};

    // 1. GUEST / CUSTOMER TOOLS
    if (role === "GUEST" || role === "CUSTOMER") {
      systemPrompt = "You are a polite hotel concierge. Help the user find rooms and check their bookings. The current date is " + new Date().toISOString().split('T')[0] + ".";
      
      tools.checkAvailability = tool({
        description: 'Search for available rooms based on check-in/out dates and guest count.',
        parameters: z.object({
          checkInDate: z.string().describe("YYYY-MM-DD format"),
          checkOutDate: z.string().describe("YYYY-MM-DD format"),
          guests: z.number().describe("Number of guests")
        }),
        execute: async ({ checkInDate, checkOutDate, guests }) => {
          try {
            const data = await BookingsService.getAvailableRooms(hotelId, { checkInDate, checkOutDate, guests });
            return data.map((rt: any) => ({ type: rt.roomType.name, price: rt.roomType.basePrice, availableCount: rt.rooms.length }));
          } catch (e: any) {
            return { error: e.message };
          }
        },
      });

      if (role === "CUSTOMER" && userId) {
        tools.getMyBookings = tool({
          description: 'Fetch the user\'s past and upcoming bookings.',
          parameters: z.object({}),
          execute: async () => {
            const bookings = await BookingsService.getCustomerBookings(userId);
            return bookings.map(b => ({
              id: b.id,
              status: b.status,
              checkIn: b.checkInDate,
              checkOut: b.checkOutDate,
              amount: b.totalAmount
            }));
          }
        });
      }
    }

    // 2. MANAGER / ADMIN TOOLS
    if (role === "MANAGER" || role === "ADMIN") {
      systemPrompt = "You are a high-level hotel operations assistant. You provide data insights and management summaries. The current date is " + new Date().toISOString().split('T')[0] + ".";
      
      tools.getOccupancyReport = tool({
        description: 'Fetch the occupancy rate for a specific date range.',
        parameters: z.object({
          startDate: z.string().describe("YYYY-MM-DD format"),
          endDate: z.string().describe("YYYY-MM-DD format"),
        }),
        execute: async ({ startDate, endDate }) => {
          try {
            return await ReportsService.getOccupancy(hotelId, startDate, endDate);
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.getRevenueReport = tool({
        description: 'Fetch total revenue for a specific date range.',
        parameters: z.object({
          startDate: z.string().describe("YYYY-MM-DD format"),
          endDate: z.string().describe("YYYY-MM-DD format"),
        }),
        execute: async ({ startDate, endDate }) => {
          try {
            return await ReportsService.getRevenue(hotelId, startDate, endDate);
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });
    }

    const coreMessages = await convertToModelMessages(messages);

    const result = await streamText({
      model: google('gemini-3.8-flash'), // Using latest flash for fast chat responses
      messages: coreMessages,
      system: systemPrompt,
      tools,
      maxSteps: 3, // Allow the model to call tools and then answer
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("AI Chat Error:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat" }), { status: 500 });
  }
}
