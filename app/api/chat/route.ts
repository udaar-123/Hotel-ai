// @ts-nocheck
import { streamText, tool, convertToModelMessages } from 'ai';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';
import { decryptSession } from '@/modules/auth/utils';
import { UserRole } from '@/modules/auth/types';
import { RoomsService } from '@/modules/rooms/service';
import { RoomStatus } from '@/modules/rooms/types';
import { BookingsService } from '@/modules/bookings/service';
import { ReportsService } from '@/modules/reports/service';
import { UsersService } from '@/modules/users/service';
import { PaymentsService } from '@/modules/payments/service';
import { ReviewsService } from '@/modules/reviews/service';
import { ReviewsRepository } from '@/modules/reviews/repository';
import { InvoicesService } from '@/modules/invoices/service';
import { AuditService } from '@/modules/audit/service';
import { DashboardService } from '@/modules/dashboard/service';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { checkRateLimit, getClientIdentifier, rateLimitExceededResponse } from '@/lib/rate-limit';

function parseDateSafe(dateStr?: string, fallback: Date = new Date()): Date {
  if (!dateStr) return fallback;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function POST(req: Request) {
  try {
    const bodyData = await req.json();
    const { messages } = bodyData;
    const headerLang = req.headers.get("x-voice-language");
    const rawLang = bodyData.language || headerLang || "en-IN";
    const selectedLang = rawLang === "hi-IN" ? "hi-IN" : "en-IN";

    // Cookie parsing
    const cookieHeader = req.headers.get("cookie") || "";
    const sessionCookieMatch = cookieHeader.match(/session=([^;]+)/);
    const sessionToken = sessionCookieMatch ? sessionCookieMatch[1] : "";
    const session = await decryptSession(sessionToken);

    const role = (session?.role || "GUEST") as UserRole | "GUEST";
    const userId = session?.userId || null;

    // Enforce API rate limiting (35 AI turns / minute per user or IP)
    const rateLimit = checkRateLimit(getClientIdentifier(req, userId), {
      namespace: "ai-chat",
      limit: 35,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, selectedLang);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const hotel = await prisma.hotels.findFirst();
    const hotelId = hotel?.id || "";

    let systemPrompt = `You are a helpful and polite hotel AI assistant. Answer concisely. Current date: ${todayStr}.`;
    const tools: Record<string, any> = {};

    // ─────────────────────────────────────────────────────────────────────────
    // 1. GUEST & CUSTOMER TOOLS
    // ─────────────────────────────────────────────────────────────────────────
    if (role === "GUEST" || role === "CUSTOMER") {
      systemPrompt =
        `You are a polite hotel concierge for ${hotel?.name || 'Grand Elegance'}. ` +
        `Help the user search available rooms, manage their reservations, cancel bookings or request refunds, submit stay reviews, and view invoices. ` +
        `The current date is ${todayStr}. ` +
        `CRITICAL INSTRUCTION: When using a tool, always extract required parameters from the user's message. ` +
        `After calling a tool, ALWAYS generate a friendly, clear natural-language response summarizing the result.`;

      tools.checkAvailability = tool({
        description: 'Search for available rooms based on check-in/out dates and guest count. If checkout date is not provided, assume the next day. If guests is not provided, assume 1.',
        inputSchema: z.object({
          checkInDate: z.string().describe("YYYY-MM-DD format"),
          checkOutDate: z.string().optional().describe("YYYY-MM-DD format. Default to 1 day after checkInDate if not specified."),
          guests: z.number().optional().describe("Number of guests. Default to 1.")
        }),
        execute: async ({ checkInDate, checkOutDate, guests }) => {
          try {
            const parsedCheckIn = parseDateSafe(checkInDate);
            const cleanCheckIn = parsedCheckIn.toISOString().split('T')[0];

            let cleanCheckOut = checkOutDate;
            if (!cleanCheckOut) {
              const nextDay = new Date(parsedCheckIn);
              nextDay.setDate(nextDay.getDate() + 1);
              cleanCheckOut = nextDay.toISOString().split('T')[0];
            } else {
              cleanCheckOut = parseDateSafe(cleanCheckOut, new Date(parsedCheckIn.getTime() + 86400000)).toISOString().split('T')[0];
            }

            const numGuests = guests || 1;
            const data = await BookingsService.getAvailableRooms(hotelId, {
              checkInDate: cleanCheckIn,
              checkOutDate: cleanCheckOut,
              guests: numGuests
            });

            if (!data || data.length === 0) return { message: "No rooms available for these dates." };
            return data.map((rt: any) => ({
              type: rt.roomType.name,
              price: rt.roomType.basePrice,
              capacity: rt.roomType.capacity,
              availableCount: rt.rooms.length
            }));
          } catch (e: any) {
            return { error: `Database error: ${e.message}` };
          }
        },
      });

      if (role === "CUSTOMER" && userId) {
        tools.getCustomerDashboard = tool({
          description: 'Fetch the customer dashboard summary (upcoming bookings and past booking count).',
          inputSchema: z.object({}),
          execute: async () => {
            try {
              return await DashboardService.getCustomerDashboard(userId);
            } catch (e: any) {
              return { error: e.message };
            }
          }
        });

        tools.getMyBookings = tool({
          description: "Fetch the customer's past and upcoming bookings.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const bookings = await BookingsService.getCustomerBookings(userId);
              return bookings.map((b: any) => ({
                id: b.id,
                roomNumber: b.rooms?.roomNumber,
                roomType: b.rooms?.room_types?.name,
                status: b.status,
                checkIn: b.checkInDate,
                checkOut: b.checkOutDate,
                amount: b.totalAmount
              }));
            } catch (e: any) {
              return { error: e.message };
            }
          }
        });

        tools.bookRoom = tool({
          description: 'Book a specific room type for the customer for the given dates.',
          inputSchema: z.object({
            roomTypeName: z.string().optional().describe("The exact name of the room type to book (e.g. 'double seater')"),
            checkInDate: z.string().optional().describe("YYYY-MM-DD format"),
            checkOutDate: z.string().optional().describe("YYYY-MM-DD format"),
            guests: z.number().optional().describe("Number of guests")
          }),
          execute: async (args) => {
            const { roomTypeName, checkInDate, checkOutDate, guests } = args || {};
            try {
              const parsedCheckIn = parseDateSafe(checkInDate);
              const checkIn = parsedCheckIn.toISOString().split('T')[0];

              const defaultCheckOut = new Date(parsedCheckIn);
              defaultCheckOut.setDate(defaultCheckOut.getDate() + 1);
              const parsedCheckOut = parseDateSafe(checkOutDate, defaultCheckOut);
              const checkOut = parsedCheckOut.toISOString().split('T')[0];

              const numGuests = guests || 1;
              const availableRoomsData = await BookingsService.getAvailableRooms(hotelId, {
                checkInDate: checkIn,
                checkOutDate: checkOut,
                guests: numGuests
              });

              let matchedType;
              if (!roomTypeName || roomTypeName.trim() === '') {
                matchedType = availableRoomsData[0];
              } else {
                matchedType = availableRoomsData.find((rt: any) =>
                  rt?.roomType?.name?.toLowerCase().includes(roomTypeName.toLowerCase())
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
                  guests: numGuests,
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

        tools.cancelMyBooking = tool({
          description: 'Cancel an existing customer booking by bookingId. Requires human confirmation if confirmed is not true.',
          inputSchema: z.object({
            bookingId: z.string().describe("The UUID or short ID prefix of the booking to cancel"),
            confirmed: z.boolean().optional().describe("Set to true ONLY after the user explicitly confirms cancellation.")
          }),
          execute: async ({ bookingId, confirmed }) => {
            try {
              let targetId = bookingId;
              if (bookingId.length < 36) {
                const found = await prisma.bookings.findFirst({
                  where: { userId, id: { startsWith: bookingId } }
                });
                if (found) targetId = found.id;
              }
              const existing = await BookingsService.getBookingById({ id: userId, role: "CUSTOMER" }, targetId);
              if (!confirmed) {
                return {
                  requiresConfirmation: true,
                  actionType: "CANCEL_BOOKING",
                  titleEn: "Confirm Booking Cancellation",
                  titleHi: "बुकिंग रद्दीकरण की पुष्टि करें",
                  summaryEn: `Cancel Booking #${existing.id.slice(0, 8)} (Room ${existing.rooms?.roomNumber || "N/A"}, ₹${existing.totalAmount})?`,
                  summaryHi: `क्या आप बुकिंग #${existing.id.slice(0, 8)} (कमरा ${existing.rooms?.roomNumber || "N/A"}, ₹${existing.totalAmount}) रद्द करना चाहते हैं?`,
                  confirmPromptEn: `Yes, confirm cancelling booking ${existing.id} with confirmed=true`,
                  confirmPromptHi: `हाँ, बुकिंग ${existing.id} को रद्द करने की पुष्टि करें (confirmed=true)`
                };
              }
              const cancelled = await BookingsService.cancelBooking({ id: userId, role: "CUSTOMER" }, targetId);
              return { success: true, bookingId: cancelled.id, status: cancelled.status };
            } catch (e: any) {
              return { error: e.message };
            }
          }
        });

        tools.requestBookingRefund = tool({
          description: "Request a refund for a completed payment on one of the customer's bookings. Requires human confirmation if confirmed is not true.",
          inputSchema: z.object({
            bookingId: z.string().describe("The booking ID to request a refund for"),
            reason: z.string().optional().describe("Reason for requesting the refund"),
            confirmed: z.boolean().optional().describe("Set to true ONLY after the user explicitly confirms the refund request.")
          }),
          execute: async ({ bookingId, reason, confirmed }) => {
            try {
              const booking = await BookingsService.getBookingById({ id: userId, role: "CUSTOMER" }, bookingId);
              if (!confirmed) {
                return {
                  requiresConfirmation: true,
                  actionType: "REQUEST_REFUND",
                  titleEn: "Confirm Refund Request",
                  titleHi: "रिफंड अनुरोध की पुष्टि करें",
                  summaryEn: `Submit refund request of ₹${booking.totalAmount} for Booking #${booking.id.slice(0, 8)}?`,
                  summaryHi: `क्या आप बुकिंग #${booking.id.slice(0, 8)} के लिए ₹${booking.totalAmount} का रिफंड अनुरोध भेजना चाहते हैं?`,
                  confirmPromptEn: `Yes, confirm refund request for booking ${booking.id} with reason "${reason || 'Requested via AI'}" and confirmed=true`,
                  confirmPromptHi: `हाँ, बुकिंग ${booking.id} के लिए रिफंड अनुरोध की पुष्टि करें (confirmed=true)`
                };
              }
              const refund = await PaymentsService.requestRefund(userId, booking.id, reason || "Customer requested refund via AI assistant");
              return { success: true, refundId: refund.id, amount: refund.amount, status: refund.status };
            } catch (e: any) {
              return { error: e.message };
            }
          }
        });

        tools.submitStayReview = tool({
          description: 'Submit a rating (1-5) and comment review for a completed (CHECKED_OUT) booking.',
          inputSchema: z.object({
            bookingId: z.string().describe("The booking ID of the completed stay"),
            rating: z.number().min(1).max(5).describe("Star rating between 1 and 5"),
            comment: z.string().optional().describe("Written review comment")
          }),
          execute: async ({ bookingId, rating, comment }) => {
            try {
              const review = await ReviewsService.submitReview(userId, { bookingId, rating, comment });
              return { success: true, reviewId: review.id, rating: review.rating, status: review.status };
            } catch (e: any) {
              return { error: e.message };
            }
          }
        });

        tools.getMyBookingInvoice = tool({
          description: "Generate or retrieve the invoice details for one of the customer's bookings.",
          inputSchema: z.object({
            bookingId: z.string().describe("The booking ID")
          }),
          execute: async ({ bookingId }) => {
            try {
              const booking = await BookingsService.getBookingById({ id: userId, role: "CUSTOMER" }, bookingId);
              const invoice = await InvoicesService.generateInvoice(booking.id);
              return {
                invoiceNum: invoice.invoiceNum,
                totalAmount: invoice.totalAmount,
                status: invoice.status,
                issuedAt: invoice.issuedAt,
                bookingId: invoice.bookingId
              };
            } catch (e: any) {
              return { error: e.message };
            }
          }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. HOUSEKEEPER TOOLS (also accessible to MANAGER & ADMIN)
    // ─────────────────────────────────────────────────────────────────────────
    if (role === "HOUSEKEEPER" || role === "MANAGER" || role === "ADMIN") {
      if (role === "HOUSEKEEPER") {
        systemPrompt =
          `You are a Housekeeping Operations AI Assistant for ${hotel?.name || 'Grand Elegance'}. ` +
          `Help the housekeeper check the room cleaning/maintenance queue, view room statuses on the board, and update room statuses (` +
          `CHECKED_OUT -> CLEANING -> AVAILABLE or MAINTENANCE -> AVAILABLE). ` +
          `Current date: ${todayStr}. Always summarize tool outputs clearly.`;
      }

      tools.getHousekeepingQueue = tool({
        description: 'Get the list of rooms currently in the housekeeping queue (statuses: CHECKED_OUT, CLEANING, MAINTENANCE).',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const queue = await prisma.rooms.findMany({
              where: {
                hotelId,
                status: { in: ["CHECKED_OUT", "CLEANING", "MAINTENANCE"] }
              },
              include: { room_types: true },
              orderBy: { updatedAt: "asc" }
            });
            return queue.map((r: any) => ({
              roomId: r.id,
              roomNumber: r.roomNumber,
              status: r.status,
              roomType: r.room_types?.name || "Standard"
            }));
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.updateRoomStatus = tool({
        description:
          'Update a room status by roomNumber or roomId. Valid transitions: CHECKED_OUT -> CLEANING, CLEANING -> AVAILABLE or MAINTENANCE, MAINTENANCE -> AVAILABLE, AVAILABLE -> MAINTENANCE.',
        inputSchema: z.object({
          roomIdentifier: z.string().optional().describe("Room number (e.g. '101') or room UUID"),
          roomNumber: z.string().optional().describe("Alias for roomIdentifier"),
          newStatus: z.string().optional().describe("Target room status: AVAILABLE, CLEANING, MAINTENANCE, CHECKED_OUT, BOOKED, OCCUPIED"),
          status: z.string().optional().describe("Alias for newStatus")
        }),
        execute: async (args) => {
          try {
            const identifier = args?.roomIdentifier || args?.roomNumber;
            const targetStatus = (args?.newStatus || args?.status || "").toUpperCase();
            if (!identifier) return { error: "Please provide a room number or room ID." };
            if (!targetStatus) return { error: "Please provide the new status (e.g. CLEANING, AVAILABLE, MAINTENANCE)." };

            const room = await prisma.rooms.findFirst({
              where: {
                hotelId,
                OR: [{ id: identifier }, { roomNumber: identifier }]
              }
            });
            if (!room) return { error: `Room '${identifier}' not found.` };

            const updated = await RoomsService.changeRoomStatus(
              { id: userId!, role: role as UserRole },
              room.id,
              targetStatus as RoomStatus
            );
            return {
              success: true,
              roomNumber: updated.roomNumber,
              oldStatus: room.status,
              newStatus: updated.status
            };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.getRoomStatusBoard = tool({
        description: 'View all rooms in the hotel and their current live status (AVAILABLE, OCCUPIED, CHECKED_OUT, CLEANING, MAINTENANCE).',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const rooms = await RoomsService.getRooms(hotelId);
            return rooms.map((r: any) => ({
              roomId: r.id,
              roomNumber: r.roomNumber,
              status: r.status,
              type: r.room_types?.name,
              price: r.priceOverride ?? r.room_types?.basePrice
            }));
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. RECEPTIONIST TOOLS (also accessible to MANAGER & ADMIN)
    // ─────────────────────────────────────────────────────────────────────────
    if (role === "RECEPTIONIST" || role === "MANAGER" || role === "ADMIN") {
      if (role === "RECEPTIONIST") {
        systemPrompt =
          `You are a Front-Desk Receptionist AI Assistant for ${hotel?.name || 'Grand Elegance'}. ` +
          `Help the receptionist view today's arrivals/departures, search and view bookings, create walk-in/offline bookings, ` +
          `check guests in and out, verify/record identity documents, generate invoices, and update room statuses. ` +
          `Current date: ${todayStr}. Always summarize tool outputs clearly.`;
      }

      tools.getFrontDeskOverview = tool({
        description: "Get today's front-desk receptionist metrics: arrivals count, departures count, available rooms, and occupied rooms.",
        inputSchema: z.object({}),
        execute: async () => {
          try {
            return await DashboardService.getReceptionistDashboard(hotelId);
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.getAllBookings = tool({
        description: 'List hotel bookings, optionally filtered by status or guest name.',
        inputSchema: z.object({
          status: z.string().optional().describe("Optional filter: PENDING_PAYMENT, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED"),
          guestName: z.string().optional().describe("Optional guest name search")
        }),
        execute: async ({ status, guestName }) => {
          try {
            let bookings = await BookingsService.getAllBookings({ id: userId!, role }, hotelId);
            if (status) {
              bookings = bookings.filter((b: any) => b.status.toUpperCase() === status.toUpperCase());
            }
            if (guestName) {
              const q = guestName.toLowerCase();
              bookings = bookings.filter((b: any) =>
                b.booking_guests?.some((g: any) => g.name?.toLowerCase().includes(q))
              );
            }
            return bookings.slice(0, 25).map((b: any) => ({
              id: b.id,
              guestName: b.booking_guests?.[0]?.name || "N/A",
              guestPhone: b.booking_guests?.[0]?.phone || null,
              roomNumber: b.rooms?.roomNumber,
              roomType: b.rooms?.room_types?.name,
              checkIn: b.checkInDate,
              checkOut: b.checkOutDate,
              status: b.status,
              totalAmount: b.totalAmount
            }));
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.checkInGuest = tool({
        description: 'Check in a guest for a CONFIRMED or PENDING_PAYMENT booking by booking ID.',
        inputSchema: z.object({
          bookingId: z.string().describe("Full UUID or short prefix of the booking ID")
        }),
        execute: async ({ bookingId }) => {
          try {
            let targetId = bookingId;
            if (bookingId.length < 36) {
              const found = await prisma.bookings.findFirst({ where: { hotelId, id: { startsWith: bookingId } } });
              if (found) targetId = found.id;
            }
            const updated = await BookingsService.checkIn({ id: userId!, role }, targetId);
            return {
              success: true,
              bookingId: updated.id,
              status: updated.status,
              roomNumber: updated.rooms?.roomNumber
            };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.checkOutGuest = tool({
        description: 'Check out a guest from a CHECKED_IN booking by booking ID. Requires confirmation if confirmed is not true.',
        inputSchema: z.object({
          bookingId: z.string().describe("Full UUID or short prefix of the booking ID"),
          confirmed: z.boolean().optional().describe("Set to true ONLY after the user explicitly confirms check-out.")
        }),
        execute: async ({ bookingId, confirmed }) => {
          try {
            let targetId = bookingId;
            if (bookingId.length < 36) {
              const found = await prisma.bookings.findFirst({ where: { hotelId, id: { startsWith: bookingId } } });
              if (found) targetId = found.id;
            }
            const existing = await BookingsService.getBookingById({ id: userId!, role }, targetId);
            if (!confirmed) {
              return {
                requiresConfirmation: true,
                actionType: "CHECK_OUT_GUEST",
                titleEn: "Confirm Guest Check-Out",
                titleHi: "गेस्ट चेक-आउट की पुष्टि करें",
                summaryEn: `Check out Guest (${existing.booking_guests?.[0]?.name || "Guest"}) from Room ${existing.rooms?.roomNumber || "N/A"}?`,
                summaryHi: `क्या आप कमरा ${existing.rooms?.roomNumber || "N/A"} से गेस्ट (${existing.booking_guests?.[0]?.name || "Guest"}) को चेक-आउट करना चाहते हैं?`,
                confirmPromptEn: `Yes, confirm checking out booking ${existing.id} with confirmed=true`,
                confirmPromptHi: `हाँ, बुकिंग ${existing.id} को चेक-आउट करने की पुष्टि करें (confirmed=true)`
              };
            }
            const updated = await BookingsService.checkOut({ id: userId!, role }, targetId);
            return {
              success: true,
              bookingId: updated.id,
              status: updated.status,
              roomNumber: updated.rooms?.roomNumber
            };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.releaseExpiredUnpaidBookings = tool({
        description: 'Automatically release and cancel stale PENDING_PAYMENT bookings that have remained unpaid past the expiry window (default 15 minutes).',
        inputSchema: z.object({
          expiryMinutes: z.number().optional().describe("Optional expiry threshold in minutes (default 15)")
        }),
        execute: async ({ expiryMinutes }) => {
          try {
            const res = await BookingsService.expireStalePendingBookings(hotelId, expiryMinutes || 15);
            return {
              success: true,
              expiredCount: res.expiredCount,
              bookingIds: res.bookingIds,
              message: `Released ${res.expiredCount} expired unpaid booking(s).`
            };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.createWalkInBooking = tool({
        description: 'Create an offline / walk-in booking for a guest at the front desk.',
        inputSchema: z.object({
          roomNumberOrId: z.string().describe("Room number (e.g. '101') or Room ID"),
          guestName: z.string().describe("Full name of the walk-in guest"),
          guestEmail: z.string().optional().describe("Guest email address"),
          guestPhone: z.string().optional().describe("Guest phone number"),
          checkInDate: z.string().describe("YYYY-MM-DD check-in date"),
          checkOutDate: z.string().describe("YYYY-MM-DD check-out date"),
          guests: z.number().optional().describe("Number of guests (default 1)"),
          amountPaid: z.number().optional().describe("Cash amount paid upfront (defaults to full total amount)")
        }),
        execute: async ({ roomNumberOrId, guestName, guestEmail, guestPhone, checkInDate, checkOutDate, guests, amountPaid }) => {
          try {
            const room = await prisma.rooms.findFirst({
              where: {
                hotelId,
                OR: [{ id: roomNumberOrId }, { roomNumber: roomNumberOrId }]
              },
              include: { room_types: true }
            });
            if (!room) return { error: `Room '${roomNumberOrId}' not found.` };

            const checkIn = parseDateSafe(checkInDate);
            const defaultOut = new Date(checkIn);
            defaultOut.setDate(defaultOut.getDate() + 1);
            const checkOut = parseDateSafe(checkOutDate, defaultOut);
            const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 3600 * 24)));
            const rate = room.priceOverride && room.priceOverride > 0 ? room.priceOverride : room.room_types.basePrice;
            const calculatedTotal = rate * nights;

            const booking = await BookingsService.createOfflineBooking(
              { id: userId!, role },
              hotelId,
              {
                roomId: room.id,
                checkInDate: checkIn.toISOString().split('T')[0],
                checkOutDate: checkOut.toISOString().split('T')[0],
                guests: guests || 1,
                guestName,
                guestEmail: guestEmail || "",
                guestPhone: guestPhone || "",
                amountPaid: amountPaid !== undefined ? amountPaid : calculatedTotal
              }
            );

            return {
              success: true,
              bookingId: booking.id,
              roomNumber: room.roomNumber,
              guestName,
              totalAmount: booking.totalAmount,
              status: booking.status
            };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.generateBookingInvoice = tool({
        description: 'Generate or fetch an invoice for any booking ID.',
        inputSchema: z.object({
          bookingId: z.string().describe("Booking ID")
        }),
        execute: async ({ bookingId }) => {
          try {
            let targetId = bookingId;
            if (bookingId.length < 36) {
              const found = await prisma.bookings.findFirst({ where: { hotelId, id: { startsWith: bookingId } } });
              if (found) targetId = found.id;
            }
            const invoice = await InvoicesService.generateInvoice(targetId);
            return {
              invoiceNum: invoice.invoiceNum,
              bookingId: invoice.bookingId,
              totalAmount: invoice.totalAmount,
              status: invoice.status,
              issuedAt: invoice.issuedAt
            };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      if (!tools.getRoomStatusBoard) {
        tools.getRoomStatusBoard = tool({
          description: 'View all rooms in the hotel and their current status.',
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const rooms = await RoomsService.getRooms(hotelId);
              return rooms.map((r: any) => ({
                roomId: r.id,
                roomNumber: r.roomNumber,
                status: r.status,
                type: r.room_types?.name,
                price: r.priceOverride ?? r.room_types?.basePrice
              }));
            } catch (e: any) {
              return { error: e.message };
            }
          }
        });
      }

      if (!tools.updateRoomStatus) {
        tools.updateRoomStatus = tool({
          description: 'Update a room status by roomNumber or roomId.',
          inputSchema: z.object({
            roomIdentifier: z.string().optional().describe("Room number (e.g. '101') or room UUID"),
            roomNumber: z.string().optional().describe("Alias for roomIdentifier"),
            newStatus: z.string().optional().describe("Target room status: AVAILABLE, CLEANING, MAINTENANCE, CHECKED_OUT, BOOKED, OCCUPIED"),
            status: z.string().optional().describe("Alias for newStatus")
          }),
          execute: async (args) => {
            try {
              const identifier = args?.roomIdentifier || args?.roomNumber;
              const targetStatus = (args?.newStatus || args?.status || "").toUpperCase();
              if (!identifier) return { error: "Please provide a room number or room ID." };
              if (!targetStatus) return { error: "Please provide the new status." };

              const room = await prisma.rooms.findFirst({
                where: {
                  hotelId,
                  OR: [{ id: identifier }, { roomNumber: identifier }]
                }
              });
              if (!room) return { error: `Room '${identifier}' not found.` };

              const updated = await RoomsService.changeRoomStatus(
                { id: userId!, role: role as UserRole },
                room.id,
                targetStatus as RoomStatus
              );
              return {
                success: true,
                roomNumber: updated.roomNumber,
                oldStatus: room.status,
                newStatus: updated.status
              };
            } catch (e: any) {
              return { error: e.message };
            }
          }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. MANAGER & ADMIN TOOLS
    // ─────────────────────────────────────────────────────────────────────────
    if (role === "MANAGER" || role === "ADMIN") {
      systemPrompt =
        `You are an Executive Hotel Operations & Management AI Assistant for ${hotel?.name || 'Grand Elegance'}. ` +
        `You have full access to analytics reports (occupancy, revenue, booking summaries), staff management (receptionists, housekeepers${role === "ADMIN" ? ", and managers" : ""}), ` +
        `room & room-type inventory, refund approvals, customer review moderation, audit logs, front-desk operations, and housekeeping queues. ` +
        `Current date: ${todayStr}. Always provide clear, actionable insights after executing any tool.`;

      tools.getManagerDashboard = tool({
        description: 'Get high-level manager dashboard metrics (occupancy rate, total revenue, pending refunds, active staff).',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            return await DashboardService.getManagerDashboard(hotelId);
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.getOccupancyReport = tool({
        description: 'Fetch the occupancy rate report for a specific date range.',
        inputSchema: z.object({
          startDate: z.string().optional().describe("YYYY-MM-DD format (defaults to 30 days ago)"),
          endDate: z.string().optional().describe("YYYY-MM-DD format (defaults to today)"),
        }),
        execute: async ({ startDate, endDate }) => {
          try {
            const start = startOfDay(parseDateSafe(startDate, subDays(new Date(), 30)));
            const end = endOfDay(parseDateSafe(endDate, new Date()));
            return await ReportsService.getOccupancy(hotelId, start, end);
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.getRevenueReport = tool({
        description: 'Fetch total revenue breakdown by payment method and room type for a date range.',
        inputSchema: z.object({
          startDate: z.string().optional().describe("YYYY-MM-DD format (defaults to 30 days ago)"),
          endDate: z.string().optional().describe("YYYY-MM-DD format (defaults to today)"),
        }),
        execute: async ({ startDate, endDate }) => {
          try {
            const start = startOfDay(parseDateSafe(startDate, subDays(new Date(), 30)));
            const end = endOfDay(parseDateSafe(endDate, new Date()));
            return await ReportsService.getRevenue(hotelId, start, end);
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.getBookingsSummaryReport = tool({
        description: 'Fetch bookings summary and processed refunds report for a date range.',
        inputSchema: z.object({
          startDate: z.string().optional().describe("YYYY-MM-DD format (defaults to 30 days ago)"),
          endDate: z.string().optional().describe("YYYY-MM-DD format (defaults to today)"),
        }),
        execute: async ({ startDate, endDate }) => {
          try {
            const start = startOfDay(parseDateSafe(startDate, subDays(new Date(), 30)));
            const end = endOfDay(parseDateSafe(endDate, new Date()));
            return await ReportsService.getBookingsSummary(hotelId, start, end);
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      // Staff Management (Receptionist & Housekeeper)
      tools.listStaffMembers = tool({
        description: 'List hotel staff members (Receptionists and Housekeepers) and their active/deactivated status.',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            return await UsersService.getStaff({ id: userId!, role: role as UserRole });
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.createStaffMember = tool({
        description: 'Create a new staff member. Allowed roles: RECEPTIONIST or HOUSEKEEPER (and MANAGER if logged in as ADMIN).',
        inputSchema: z.object({
          name: z.string().describe("Full name of the staff member"),
          email: z.string().describe("Email address of the staff member"),
          role: z.string().optional().describe("Role to assign: RECEPTIONIST, HOUSEKEEPER, or MANAGER"),
          staffRole: z.string().optional().describe("Alias for role: RECEPTIONIST, HOUSEKEEPER, or MANAGER")
        }),
        execute: async (args) => {
          try {
            const name = args?.name;
            const email = args?.email;
            const rawRole = (args?.role || args?.staffRole || "HOUSEKEEPER").toString().trim().toUpperCase();

            let normalizedRole: UserRole;
            if (rawRole.includes("HOUSE") || rawRole === "HK") {
              normalizedRole = UserRole.HOUSEKEEPER;
            } else if (rawRole.includes("RECEP") || rawRole.includes("FRONT")) {
              normalizedRole = UserRole.RECEPTIONIST;
            } else if (rawRole.includes("MANAG")) {
              normalizedRole = UserRole.MANAGER;
            } else {
              normalizedRole = rawRole as UserRole;
            }

            if (!name || !email) {
              return { error: "Both name and email are required to create a staff member." };
            }

            const created = await UsersService.createStaff(
              { id: userId!, role: role as UserRole },
              { name, email, role: normalizedRole }
            );
            return { success: true, staff: created };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.toggleStaffStatus = tool({
        description: 'Activate or deactivate a staff member by user ID or email. Deactivating requires confirmation if confirmed is not true.',
        inputSchema: z.object({
          staffIdentifier: z.string().optional().describe("Staff user UUID or email address"),
          email: z.string().optional().describe("Alias for staffIdentifier"),
          deactivated: z.boolean().describe("Set true to deactivate, false to activate"),
          confirmed: z.boolean().optional().describe("Set to true ONLY after the user explicitly confirms staff deactivation.")
        }),
        execute: async (args) => {
          try {
            const identifier = args?.staffIdentifier || args?.email;
            if (!identifier) return { error: "Please provide the staff member's email or ID." };
            let targetId = identifier;
            let staffDisplay = identifier;
            if (identifier.includes("@")) {
              const found = await prisma.users.findUnique({ where: { email: identifier } });
              if (!found) return { error: `No staff found with email ${identifier}` };
              targetId = found.id;
              staffDisplay = `${found.name || found.email} (${found.email})`;
            }
            if (Boolean(args?.deactivated) && !args?.confirmed) {
              return {
                requiresConfirmation: true,
                actionType: "DEACTIVATE_STAFF",
                titleEn: "Confirm Staff Deactivation",
                titleHi: "स्टाफ निष्क्रिय करने की पुष्टि करें",
                summaryEn: `Deactivate staff account for ${staffDisplay}? They will immediately lose system access.`,
                summaryHi: `क्या आप ${staffDisplay} का स्टाफ अकाउंट निष्क्रिय (Deactivate) करना चाहते हैं?`,
                confirmPromptEn: `Yes, confirm deactivating staff ${identifier} with confirmed=true`,
                confirmPromptHi: `हाँ, स्टाफ ${identifier} को निष्क्रिय करने की पुष्टि करें (confirmed=true)`
              };
            }
            const updated = await UsersService.updateStaff(
              { id: userId!, role: role as UserRole },
              targetId,
              { deactivated: Boolean(args?.deactivated) }
            );
            return { success: true, staff: updated };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      // Room Types & Inventory Management
      tools.listRoomTypes = tool({
        description: 'List all room types in the hotel with base price and guest capacity.',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            return await RoomsService.getRoomTypes(hotelId);
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.createRoomType = tool({
        description: 'Create a new room type category in the hotel.',
        inputSchema: z.object({
          name: z.string().describe("Room type name (e.g. 'Executive Suite')"),
          description: z.string().optional().describe("Description of the room type"),
          basePrice: z.number().describe("Nightly base price"),
          capacity: z.number().describe("Maximum guest capacity")
        }),
        execute: async ({ name, description, basePrice, capacity }) => {
          try {
            const rt = await RoomsService.createRoomType(
              { id: userId!, role: role as UserRole },
              hotelId,
              { name, description: description || null, basePrice, capacity }
            );
            return { success: true, roomType: rt };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.createRoom = tool({
        description: 'Add a new physical room to the hotel inventory.',
        inputSchema: z.object({
          roomNumber: z.string().describe("Room number (e.g. '305')"),
          roomTypeNameOrId: z.string().describe("Room type name or UUID"),
          priceOverride: z.number().optional().describe("Optional custom nightly price override")
        }),
        execute: async ({ roomNumber, roomTypeNameOrId, priceOverride }) => {
          try {
            const types = await RoomsService.getRoomTypes(hotelId);
            const matchedType = types.find(
              (t: any) => t.id === roomTypeNameOrId || t.name.toLowerCase() === roomTypeNameOrId.toLowerCase()
            );
            if (!matchedType) return { error: `Room type '${roomTypeNameOrId}' not found.` };

            const room = await RoomsService.createRoom(
              { id: userId!, role: role as UserRole },
              hotelId,
              {
                roomNumber,
                roomTypeId: matchedType.id,
                priceOverride: priceOverride ?? null,
                isActive: true
              }
            );
            return { success: true, room };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      // Refunds Queue & Processing
      tools.getRefundQueue = tool({
        description: 'List all customer refund requests in the queue.',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const queue = await PaymentsService.getRefundQueue();
            return queue.map((r: any) => ({
              refundId: r.id,
              bookingId: r.payments?.bookingId,
              amount: r.amount,
              status: r.status,
              reason: r.reason,
              createdAt: r.createdAt
            }));
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.processRefundRequest = tool({
        description: 'Approve or reject a pending refund request by refundId. Requires human confirmation if confirmed is not true.',
        inputSchema: z.object({
          refundId: z.string().describe("The UUID of the refund request"),
          action: z.enum(["APPROVE", "REJECT"]).describe("APPROVE or REJECT"),
          confirmed: z.boolean().optional().describe("Set to true ONLY after the user explicitly confirms approving or rejecting the refund.")
        }),
        execute: async ({ refundId, action, confirmed }) => {
          try {
            if (!confirmed) {
              return {
                requiresConfirmation: true,
                actionType: "PROCESS_REFUND",
                titleEn: `Confirm Refund ${action === "APPROVE" ? "Approval" : "Rejection"}`,
                titleHi: `रिफंड ${action === "APPROVE" ? "स्वीकृति" : "अस्वीकृति"} की पुष्टि करें`,
                summaryEn: `Are you sure you want to ${action} Refund #${refundId.slice(0, 8)}?`,
                summaryHi: `क्या आप वाकई रिफंड #${refundId.slice(0, 8)} को ${action === "APPROVE" ? "स्वीकृत (Approve)" : "अस्वीकृत (Reject)"} करना चाहते हैं?`,
                confirmPromptEn: `Yes, confirm ${action} for refund ${refundId} with confirmed=true`,
                confirmPromptHi: `हाँ, रिफंड ${refundId} को ${action} करने की पुष्टि करें (confirmed=true)`
              };
            }
            const res = await PaymentsService.processRefund(refundId, action, userId!);
            return { success: true, refundId: res.id, status: res.status, amount: res.amount };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      // Reviews Moderation Queue
      tools.getPendingReviews = tool({
        description: 'Get all customer reviews awaiting moderation (status: PENDING).',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const pending = await ReviewsRepository.getPendingReviews(hotelId);
            return pending.map((r: any) => ({
              reviewId: r.id,
              guestName: r.users?.name || "Guest",
              rating: r.rating,
              comment: r.comment,
              roomType: r.bookings?.rooms?.room_types?.name,
              createdAt: r.createdAt
            }));
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.moderateReview = tool({
        description: 'Publish or reject a pending customer review by reviewId.',
        inputSchema: z.object({
          reviewId: z.string().describe("Review UUID"),
          action: z.enum(["PUBLISHED", "REJECTED"]).describe("Moderation decision: PUBLISHED or REJECTED")
        }),
        execute: async ({ reviewId, action }) => {
          try {
            const updated = await ReviewsService.moderateReview(
              { id: userId!, role: role as UserRole },
              reviewId,
              action
            );
            return { success: true, reviewId: updated.id, status: updated.status };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      // Audit Logs
      tools.getAuditLogs = tool({
        description: 'Fetch recent system audit logs, optionally filtered by action name.',
        inputSchema: z.object({
          action: z.string().optional().describe("Optional action filter (e.g. BOOKING_CREATED, ROOM_STATUS_CHANGED, REFUND_APPROVED)")
        }),
        execute: async ({ action }) => {
          try {
            const logs = await AuditService.getAuditLogs(role, action ? { action } : undefined);
            return logs.slice(0, 25).map((l: any) => ({
              id: l.id,
              action: l.action,
              targetTable: l.targetTable,
              user: l.users?.name || l.users?.email || l.userId,
              createdAt: l.createdAt,
              details: l.newValue
            }));
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. ADMIN-EXCLUSIVE TOOLS
    // ─────────────────────────────────────────────────────────────────────────
    if (role === "ADMIN") {
      tools.getAdminDashboard = tool({
        description: 'Get platform-wide Super Admin metrics: total hotels, total active managers, and total platform revenue.',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            return await DashboardService.getAdminDashboard();
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.listManagers = tool({
        description: 'List all hotel Managers across the platform and their active/deactivated status.',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            return await UsersService.getStaff({ id: userId!, role: UserRole.ADMIN }, UserRole.MANAGER);
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });

      tools.createManager = tool({
        description: 'Create and onboard a new hotel Manager account.',
        inputSchema: z.object({
          name: z.string().describe("Full name of the Manager"),
          email: z.string().describe("Email address of the Manager")
        }),
        execute: async ({ name, email }) => {
          try {
            const manager = await UsersService.createStaff(
              { id: userId!, role: UserRole.ADMIN },
              { name, email, role: UserRole.MANAGER }
            );
            return { success: true, manager };
          } catch (e: any) {
            return { error: e.message };
          }
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. BILINGUAL VOICE AGENT POLICY (STRICTLY HINDI & ENGLISH FOR ALL ROLES)
    // ─────────────────────────────────────────────────────────────────────────
    const languageInstruction =
      selectedLang === "hi-IN"
        ? `\n\nVOICE & LANGUAGE POLICY (STRICTLY HINDI & ENGLISH ONLY — CURRENT MODE: HINDI hi-IN): ` +
          `1. You ONLY support Hindi and English. If the user speaks or writes in any language other than Hindi or English, politely decline in Hindi and English ("क्षमा करें, मैं केवल हिंदी और अंग्रेजी में सहायता कर सकता हूँ। / Sorry, I can only assist in Hindi and English."). ` +
          `2. MANDATORY: Because the user has selected HINDI mode (hi-IN), you MUST write your ENTIRE final response in natural, polite Hindi using Devanagari script (हिंदी, e.g. "जी हाँ, कमरा उपलब्ध है...") EVEN IF the user's message or the tool output is in English or Hinglish! NEVER reply in English when in Hindi mode. ` +
          `3. IMPORTANT: When calling any tool (such as createStaffMember, updateRoomStatus, checkInGuest, bookRoom, etc.), ALWAYS pass tool parameters in standard English/ISO format (e.g., role: "HOUSEKEEPER" or "RECEPTIONIST", newStatus: "CLEANING" or "AVAILABLE", dates in YYYY-MM-DD). ` +
          `4. Keep responses concise and voice-friendly (avoid reading out long raw UUIDs or complex markdown tables).`
        : `\n\nVOICE & LANGUAGE POLICY (STRICTLY HINDI & ENGLISH ONLY — CURRENT MODE: ENGLISH en-IN): ` +
          `1. You ONLY support English and Hindi. If the user speaks or writes in any language other than English or Hindi, politely decline ("Sorry, I can only assist in English and Hindi. / क्षमा करें, मैं केवल हिंदी और अंग्रेजी में सहायता कर सकता हूँ।"). ` +
          `2. Respond in clear, natural, conversational English. ` +
          `3. When calling any tool, ALWAYS pass tool parameters in standard English/ISO format. ` +
          `4. Keep responses concise and voice-friendly (avoid reading out long raw UUIDs or complex markdown tables).`;

    systemPrompt += languageInstruction;

    console.log("Starting chat with role:", role, "| Lang:", selectedLang, "| Registered tools:", Object.keys(tools).length);
    const coreMessages = await convertToModelMessages(messages);

    const result = await streamText({
      model: groq('qwen/qwen3.8-27b'),
      messages: coreMessages,
      system: systemPrompt,
      tools,
      maxSteps: 5,
      onStepFinish: (event) => {
        console.log(`[Step] Role: ${role} | Tools: ${event.toolCalls?.length} | Finish: ${event.finishReason}`);
      }
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("AI Chat Error Details:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat" }), { status: 500 });
  }
}
