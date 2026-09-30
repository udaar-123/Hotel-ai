// @ts-nocheck
import { streamText, tool, convertToModelMessages } from 'ai';
import { groq } from '@ai-sdk/groq';
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
      systemPrompt = "You are a polite hotel concierge. Help the user find rooms, check their bookings, and book rooms for them. The current date is " + new Date().toISOString().split('T')[0] + ". CRITICAL INSTRUCTION: When using a tool, you MUST provide all required parameters like checkInDate (YYYY-MM-DD), checkOutDate, and roomTypeName. NEVER send an empty object `{}`. Always extract the dates and room type from the user's request. CRITICAL: When you use a tool, you MUST ALWAYS generate a friendly text response explaining the results to the user! Never leave the user hanging with a blank message.";
      
      tools.checkAvailability = tool({
        description: 'Search for available rooms based on check-in/out dates and guest count. If checkout date is not provided, assume the next day. If guests is not provided, assume 1.',
        parameters: z.object({
          checkInDate: z.string().describe("YYYY-MM-DD format"),
          checkOutDate: z.string().optional().describe("YYYY-MM-DD format. Default to 1 day after checkInDate if not specified."),
          guests: z.number().optional().describe("Number of guests. Default to 1.")
        }),
        execute: async ({ checkInDate, checkOutDate, guests }) => {
          try {
            // Attempt to parse checkInDate securely
            let parsedCheckIn = new Date(checkInDate);
            if (isNaN(parsedCheckIn.getTime())) {
              // Fallback to today if the LLM completely messes up the date format
              parsedCheckIn = new Date();
            }
            const cleanCheckIn = parsedCheckIn.toISOString().split('T')[0];
            
            let cleanCheckOut = checkOutDate;
            if (!cleanCheckOut) {
              const nextDay = new Date(parsedCheckIn);
              nextDay.setDate(nextDay.getDate() + 1);
              cleanCheckOut = nextDay.toISOString().split('T')[0];
            } else {
              // Validate checkout date too
              const parsedCheckOut = new Date(cleanCheckOut);
              if (!isNaN(parsedCheckOut.getTime())) {
                cleanCheckOut = parsedCheckOut.toISOString().split('T')[0];
              }
            }
            
            const numGuests = guests || 1;
            console.log("Searching dates:", { cleanCheckIn, cleanCheckOut, numGuests });
            
            const data = await BookingsService.getAvailableRooms(hotelId, { 
              checkInDate: cleanCheckIn, 
              checkOutDate: cleanCheckOut, 
              guests: numGuests 
            });
            
            if (!data || data.length === 0) return { message: "No rooms available for these dates." };
            return data.map((rt: any) => ({ type: rt.roomType.name, price: rt.roomType.basePrice, availableCount: rt.rooms.length }));
          } catch (e: any) {
            return { error: `Database error: ${e.message}` };
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

        tools.bookRoom = tool({
          description: 'Book a specific room type for the user for the given dates.',
          parameters: z.object({
            roomTypeName: z.string().optional().describe("The exact name of the room type to book (e.g. 'double seater')"),
            checkInDate: z.string().optional().describe("YYYY-MM-DD format"),
            checkOutDate: z.string().optional().describe("YYYY-MM-DD format"),
            guests: z.number().optional().describe("Number of guests")
          }),
          execute: async (args) => {
            const { roomTypeName, checkInDate, checkOutDate, guests } = args;
            console.log("bookRoom tool called with args:", args);
            try {
              // Parse dates securely
              let parsedCheckIn = new Date(checkInDate);
              if (isNaN(parsedCheckIn.getTime())) {
                parsedCheckIn = new Date();
              }
              const checkIn = parsedCheckIn.toISOString().split('T')[0];
              
              let parsedCheckOut = new Date(checkOutDate);
              if (isNaN(parsedCheckOut.getTime())) {
                parsedCheckOut = new Date(parsedCheckIn);
                parsedCheckOut.setDate(parsedCheckOut.getDate() + 1);
              }
              const checkOut = parsedCheckOut.toISOString().split('T')[0];

              const availableRoomsData = await BookingsService.getAvailableRooms(hotelId, { checkInDate: checkIn, checkOutDate: checkOut, guests });
              
              let matchedType;
              
              if (!roomTypeName || roomTypeName.trim() === '') {
                // FALLBACK: If the AI failed to provide a room type, just pick the first available room that fits the guests!
                console.log("AI failed to provide roomTypeName, falling back to first available room.");
                matchedType = availableRoomsData[0];
              } else {
                matchedType = availableRoomsData.find((rt: any) => 
                  rt?.roomType?.name?.toLowerCase() === roomTypeName.toLowerCase()
                );
              }
              
              if (!matchedType || matchedType.rooms.length === 0) {
                return { error: `Sorry, no available rooms found for those dates.` };
              }

              const roomIdToBook = matchedType.rooms[0].id;
              const actualRoomTypeName = matchedType.roomType.name;
              
              const user = await prisma.users.findUnique({ where: { id: userId } });
              
              const booking = await BookingsService.createBooking(
                { id: userId, role: "CUSTOMER" },
                hotelId,
                {
                  roomId: roomIdToBook,
                  checkInDate: checkIn,
                  checkOutDate: checkOut,
                  guests,
                  guestName: user?.name || "AI Guest",
                  guestEmail: user?.email || "",
                  guestPhone: user?.phone || ""
                }
              );

              return { 
                success: true, 
                message: `Successfully booked a ${actualRoomTypeName} from ${checkIn} to ${checkOut}!`, 
                bookingId: booking.id,
                totalAmount: booking.totalAmount
              };
            } catch (e: any) {
              return { error: `Failed to book room: ${e.message}` };
            }
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

    console.log("Starting chat with role:", role);
    const coreMessages = await convertToModelMessages(messages);
    console.log("Converted messages. Calling streamText...");

    const result = await streamText({
      model: groq('qwen/qwen3.8-27b'), // Using Groq's active 27B model (supports tool use)
      messages: coreMessages,
      system: systemPrompt,
      tools,
      maxSteps: 5,
      onStepFinish: (event) => {
        console.log(`[Step] Text: ${event.text?.substring(0,20)}... Tools: ${event.toolCalls?.length}, Reason: ${event.finishReason}`);
      }
    });

    console.log("Stream generated successfully.");
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("AI Chat Error Details:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat" }), { status: 500 });
  }
}
