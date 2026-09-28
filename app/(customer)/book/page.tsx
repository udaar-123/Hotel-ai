"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";

const searchSchema = z.object({
  checkInDate: z.string().min(1, "Check In Date is required"),
  checkOutDate: z.string().min(1, "Check Out Date is required"),
  guests: z.number().min(1, "At least 1 guest required"),
});

const bookSchema = z.object({
  guestName: z.string().min(1, "Name is required"),
  guestEmail: z.string().email("Invalid email"),
  guestPhone: z.string().min(1, "Phone is required"),
});

export default function BookPage() {
  const router = useRouter();
  const [availableRoomTypes, setAvailableRoomTypes] = useState<any[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  const searchForm = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      checkInDate: "",
      checkOutDate: "",
      guests: 1,
    },
  });

  const bookForm = useForm<z.infer<typeof bookSchema>>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      guestName: "",
      guestEmail: "",
      guestPhone: "",
    },
  });

  const onSearch = async (values: z.infer<typeof searchSchema>) => {
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/v1/rooms/availability?checkInDate=${values.checkInDate}&checkOutDate=${values.checkOutDate}&guests=${values.guests}`
      );
      if (!res.ok) throw new Error("Failed to fetch availability");
      const resData = await res.json();
      setAvailableRoomTypes(resData.data || []);
    } catch (error) {
      console.error(error);
      alert("Error fetching availability");
    } finally {
      setIsSearching(false);
    }
  };

  const onBook = async (values: z.infer<typeof bookSchema>) => {
    if (!selectedRoomType || !selectedRoomType.rooms || selectedRoomType.rooms.length === 0) {
      alert("No available rooms for this room type.");
      return;
    }
    
    setIsBooking(true);
    try {
      const roomId = selectedRoomType.rooms[0].id;
      const searchValues = searchForm.getValues();
      
      const payload = {
        roomId,
        checkInDate: searchValues.checkInDate,
        checkOutDate: searchValues.checkOutDate,
        guests: searchValues.guests,
        ...values,
      };

      const res = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create booking");
      const resData = await res.json();
      
      router.push(`/bookings/${resData.data.id}`);
    } catch (error) {
      console.error(error);
      alert("Error creating booking");
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto text-slate-100">
      <h1 className="text-3xl font-bold mb-6">Book a Room</h1>
      
      <form onSubmit={searchForm.handleSubmit(onSearch)} className="bg-white text-slate-900 p-6 rounded shadow mb-8 space-y-4">
        <h2 className="text-xl font-semibold mb-4">Search Availability</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Check In</label>
            <input type="date" {...searchForm.register("checkInDate")} className="w-full border rounded p-2" />
            {searchForm.formState.errors.checkInDate && <p className="text-red-500 text-sm mt-1">{searchForm.formState.errors.checkInDate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Check Out</label>
            <input type="date" {...searchForm.register("checkOutDate")} className="w-full border rounded p-2" />
            {searchForm.formState.errors.checkOutDate && <p className="text-red-500 text-sm mt-1">{searchForm.formState.errors.checkOutDate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Guests</label>
            <input type="number" min="1" {...searchForm.register("guests", { valueAsNumber: true })} className="w-full border rounded p-2" />
            {searchForm.formState.errors.guests && <p className="text-red-500 text-sm mt-1">{searchForm.formState.errors.guests.message}</p>}
          </div>
        </div>
        <button type="submit" disabled={isSearching} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>

      {availableRoomTypes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Available Room Types</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableRoomTypes.map((rt, idx) => (
              <div key={idx} className="border rounded p-4 shadow bg-white text-slate-900">
                <h3 className="text-xl font-bold">{rt.roomType.name}</h3>
                <p className="text-gray-600 mb-2">{rt.roomType.description}</p>
                <p className="font-semibold mb-4">Price: ${rt.roomType.basePrice} / night</p>
                <button 
                  onClick={() => setSelectedRoomType(rt)}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Book Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedRoomType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md text-slate-900">
            <h2 className="text-2xl font-bold mb-4">Complete Booking</h2>
            <p className="mb-4">Booking {selectedRoomType.roomType.name}</p>
            
            <form onSubmit={bookForm.handleSubmit(onBook)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" {...bookForm.register("guestName")} className="w-full border rounded p-2" />
                {bookForm.formState.errors.guestName && <p className="text-red-500 text-sm mt-1">{bookForm.formState.errors.guestName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" {...bookForm.register("guestEmail")} className="w-full border rounded p-2" />
                {bookForm.formState.errors.guestEmail && <p className="text-red-500 text-sm mt-1">{bookForm.formState.errors.guestEmail.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input type="tel" {...bookForm.register("guestPhone")} className="w-full border rounded p-2" />
                {bookForm.formState.errors.guestPhone && <p className="text-red-500 text-sm mt-1">{bookForm.formState.errors.guestPhone.message}</p>}
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setSelectedRoomType(null)} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
                <button type="submit" disabled={isBooking} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                  {isBooking ? "Confirming..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
