import { z } from "zod";
import { RoomStatus } from "./types";

export const CreateRoomTypeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0, "Price must be positive"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
});

export const UpdateRoomTypeSchema = CreateRoomTypeSchema.partial();

export const CreateRoomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  roomTypeId: z.string().uuid("Invalid room type ID"),
  priceOverride: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const UpdateRoomSchema = CreateRoomSchema.partial();

export const UpdateRoomStatusSchema = z.object({
  status: z.nativeEnum(RoomStatus),
});
