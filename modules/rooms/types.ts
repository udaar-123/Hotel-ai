export enum RoomStatus {
  AVAILABLE = "AVAILABLE",
  BOOKED = "BOOKED",
  OCCUPIED = "OCCUPIED",
  CHECKED_OUT = "CHECKED_OUT",
  CLEANING = "CLEANING",
  MAINTENANCE = "MAINTENANCE"
}

export interface RoomTypeData {
  id: string;
  hotelId: string;
  name: string;
  description: string | null;
  basePrice: number;
  capacity: number;
}

export interface RoomData {
  id: string;
  hotelId: string;
  roomNumber: string;
  roomTypeId: string;
  priceOverride: number | null;
  isActive: boolean;
  status: RoomStatus | string;
  room_types?: RoomTypeData;
}
