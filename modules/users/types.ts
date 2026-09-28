import { UserRole } from "@/modules/auth/types";

export interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  role: UserRole;
  deactivatedAt: Date | null;
  createdAt: Date;
}
