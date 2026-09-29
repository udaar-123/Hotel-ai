import { BookingsRepository } from "./repository";
import { RoomsRepository } from "@/modules/rooms/repository";
import { BookingEvents } from "./events";
import { EventBus } from "@/shared/events";
import { BookingStatus, BookingSource, SearchAvailabilityParams } from "./types";
import { ValidationError, NotFoundError, ForbiddenError } from "@/shared/errors";
import { z } from "zod";

export const BookingsService = {
  async getAvailableRooms(hotelId: string, params: SearchAvailabilityParams) {
    const checkIn = new Date(params.checkInDate);
    const checkOut = new Date(params.checkOutDate);

    // Group available rooms by RoomType so frontend can display types, not individual rooms
    const availableRooms = await BookingsRepository.getAvailableRooms(hotelId, checkIn, checkOut, params.guests);
    
    const grouped = availableRooms.reduce((acc, room) => {
      const typeId = room.room_types.id;
      if (!acc[typeId]) {
        acc[typeId] = {
          roomType: room.room_types,
          rooms: []
        };
      }
      acc[typeId].rooms.push(room);
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped);
  },

  async createBooking(
    userContext: { id: string, role: string },
    hotelId: string,
    data: any // Validated by CreateBookingSchema
  ) {
    // Need to calculate total price
    const room = await RoomsRepository.getRoomById(data.roomId);
    if (!room) throw new NotFoundError("Room not found");
    
    if (room.room_types.capacity < data.guests) {
      throw new ValidationError("Room capacity is too small for the number of guests");
    }

    const checkIn = new Date(data.checkInDate);
    const checkOut = new Date(data.checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 3600 * 24));
    
    if (nights <= 0) throw new ValidationError("Check-out must be after check-in");

    const pricePerNight = (room.priceOverride !== null && room.priceOverride > 0) 
      ? room.priceOverride 
      : room.room_types.basePrice;
    const totalAmount = pricePerNight * nights;

    const booking = await BookingsRepository.createBooking({
      hotelId,
      userId: userContext.id, // The customer making the booking online
      roomId: data.roomId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guests: data.guests,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone,
      totalAmount,
      source: BookingSource.ONLINE,
      createdByStaffId: undefined
    });

    EventBus.emit(BookingEvents.BOOKING_CREATED, { booking });
    return booking;
  },

  async createOfflineBooking(
    userContext: { id: string, role: string },
    hotelId: string,
    data: any // Validated by CreateOfflineBookingSchema
  ) {
    // Need to calculate total price
    const room = await RoomsRepository.getRoomById(data.roomId);
    if (!room) throw new NotFoundError("Room not found");
    
    if (room.room_types.capacity < data.guests) {
      throw new ValidationError("Room capacity is too small for the number of guests");
    }

    const checkIn = new Date(data.checkInDate);
    const checkOut = new Date(data.checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 3600 * 24));
    
    if (nights <= 0) throw new ValidationError("Check-out must be after check-in");

    const pricePerNight = (room.priceOverride !== null && room.priceOverride > 0) 
      ? room.priceOverride 
      : room.room_types.basePrice;
    const totalAmount = pricePerNight * nights;

    const booking = await BookingsRepository.createOfflineBooking({
      hotelId,
      userId: userContext.id, // For offline, we use the staff id as the creating user for tracking, or link it properly
      roomId: data.roomId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guests: data.guests,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone,
      totalAmount,
      amountPaid: data.amountPaid,
      createdByStaffId: userContext.id
    });

    EventBus.emit(BookingEvents.BOOKING_CREATED, { booking });
    // If fully paid, it's confirmed
    if (data.amountPaid >= totalAmount) {
      EventBus.emit(BookingEvents.BOOKING_CONFIRMED, { booking });
    }
    return booking;
  },

  async getCustomerBookings(userId: string) {
    return BookingsRepository.getBookingsByUser(userId);
  },

  async getAllBookings(userContext: { id: string, role: string }, hotelId: string) {
    if (userContext.role === "CUSTOMER") throw new ForbiddenError("Cannot access this resource");
    return BookingsRepository.getAllBookings(hotelId);
  },

  async getBookingById(userContext: { id: string, role: string }, bookingId: string) {
    const booking = await BookingsRepository.getBookingById(bookingId);
    if (!booking) throw new NotFoundError("Booking not found");

    // Only the customer who made it, or staff, can view it
    if (userContext.role === "CUSTOMER" && booking.userId !== userContext.id) {
      throw new ForbiddenError("Cannot access this booking");
    }

    return booking;
  },

  async checkIn(userContext: { id: string, role: string }, bookingId: string) {
    if (userContext.role === "CUSTOMER") throw new ForbiddenError("Only staff can check in guests");
    const booking = await BookingsRepository.getBookingById(bookingId);
    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new ValidationError("Booking is not ready for check-in");
    }

    const updated = await BookingsRepository.checkIn(bookingId, booking.roomId);
    EventBus.emit(BookingEvents.BOOKING_CHECKED_IN, { booking: updated });
    return updated;
  },

  async checkOut(userContext: { id: string, role: string }, bookingId: string) {
    if (userContext.role === "CUSTOMER") throw new ForbiddenError("Only staff can check out guests");
    const booking = await BookingsRepository.getBookingById(bookingId);
    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new ValidationError("Booking is not currently checked in");
    }

    const updated = await BookingsRepository.checkOut(bookingId, booking.roomId);
    EventBus.emit(BookingEvents.BOOKING_CHECKED_OUT, { booking: updated });
    return updated;
  },

  async cancelBooking(userContext: { id: string, role: string }, bookingId: string) {
    const booking = await BookingsRepository.getBookingById(bookingId);
    if (!booking) throw new NotFoundError("Booking not found");

    if (userContext.role === "CUSTOMER" && booking.userId !== userContext.id) {
      throw new ForbiddenError("Cannot cancel this booking");
    }

    if (![BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED].includes(booking.status as BookingStatus)) {
      throw new ValidationError("Booking cannot be cancelled in its current state");
    }

    // In a real system with payments, canceling a CONFIRMED booking initiates a refund.
    // For Phase 7, we just mark it cancelled.
    const updated = await BookingsRepository.updateBookingStatus(bookingId, BookingStatus.CANCELLED);
    
    EventBus.emit(BookingEvents.BOOKING_CANCELLED, { booking: updated });
    return updated;
  },

  async addIdentityDocument(userContext: { id: string, role: string }, bookingId: string, url: string, publicId: string, type: string) {
    const booking = await BookingsRepository.getBookingById(bookingId);
    if (!booking) throw new NotFoundError("Booking not found");

    if (userContext.role === "CUSTOMER" && booking.userId !== userContext.id) {
      throw new ForbiddenError("Cannot modify this booking");
    }

    return BookingsRepository.addIdentityDocument(bookingId, url, publicId, type);
  }
};
