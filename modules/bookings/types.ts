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

export interface SearchAvailabilityParams {
  checkInDate: Date;
  checkOutDate: Date;
  guests: number;
}
