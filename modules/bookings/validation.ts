import { z } from "zod";
import { BookingStatus } from "./types";

export const SearchAvailabilitySchema = z.object({
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  guests: z.coerce.number().min(1)
}).refine((data) => data.checkInDate < data.checkOutDate, {
  message: "Check-out date must be after check-in date",
  path: ["checkOutDate"]
});

export const CreateBookingSchema = z.object({
  roomId: z.string().uuid(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  guests: z.coerce.number().min(1),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional().or(z.literal("")),
  guestPhone: z.string().optional().or(z.literal("")),
});

export const CreateOfflineBookingSchema = CreateBookingSchema.extend({
  amountPaid: z.coerce.number().min(0),
});
