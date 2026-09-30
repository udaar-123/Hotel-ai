import { z } from "zod";
import { UserRole } from "@/modules/auth/types";

export const CreateStaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(UserRole).refine((r) => r !== UserRole.CUSTOMER && r !== UserRole.ADMIN, {
    message: "Cannot create Customer or Admin roles via this endpoint",
  }),
});

export const UpdateStaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  deactivated: z.boolean().optional(),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export const ChangePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
