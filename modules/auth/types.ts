export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  RECEPTIONIST = 'RECEPTIONIST',
  HOUSEKEEPER = 'HOUSEKEEPER',
  CUSTOMER = 'CUSTOMER'
}

export interface SessionPayload {
  userId: string
  role: UserRole
  mustChangePassword?: boolean
}

export type AuthResponse = {
  success: boolean
  message?: string
}
