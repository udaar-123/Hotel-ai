export enum BookingStatus {
  PENDING_PAYMENT = "PENDING_PAYMENT",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  CHECKED_IN = "CHECKED_IN",
  CHECKED_OUT = "CHECKED_OUT",
  COMPLETED = "COMPLETED"
}

export enum BookingSource {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE"
}

export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  UPI = "UPI"
}

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED"
}

export interface SearchAvailabilityParams {
  checkInDate: Date;
  checkOutDate: Date;
  guests: number;
}
