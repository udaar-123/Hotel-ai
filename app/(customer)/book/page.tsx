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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#F9F8F4] via-[#F4F1EA] to-[#EAE5D9] p-8 lg:p-12 text-gray-900 font-sans">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-serif font-bold mb-8 tracking-tight">Reserve Your Stay</h1>
        
        <form onSubmit={searchForm.handleSubmit(onSearch)} className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-white mb-12 space-y-6">
          <h2 className="text-2xl font-serif font-semibold mb-2">Check Availability</h2>
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
        <button type="submit" disabled={isSearching} className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50">
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>

      {availableRoomTypes.length > 0 && (
        <div className="mb-12">
          <h2 className="text-3xl font-serif font-bold mb-6">Available Suites</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableRoomTypes.map((rt, idx) => (
              <div key={idx} className="group border border-gray-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-white flex flex-col">
                {(() => {
                  const roomImage = rt.rooms[0]?.room_images?.find((img: any) => img.isPrimary)?.url || rt.rooms[0]?.room_images?.[0]?.url;
                  return roomImage ? (
                    <div className="w-full h-56 overflow-hidden relative border-b border-gray-100">
                      <img src={roomImage} alt={rt.roomType.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    </div>
                  ) : (
                    <div className="w-full h-56 bg-gray-50 flex items-center justify-center border-b border-gray-100">
                      <span className="text-gray-400 font-serif italic text-sm">No Image Available</span>
                    </div>
                  );
                })()}
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-2xl font-serif font-bold text-gray-900 mb-2">{rt.roomType.name}</h3>
                  <p className="text-gray-500 mb-6 flex-1 text-sm leading-relaxed">{rt.roomType.description}</p>
                  <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-100">
                    <p className="font-serif font-bold text-2xl text-gray-900">
                      ${rt.roomType.basePrice} 
                      <span className="text-xs text-gray-400 font-sans font-medium uppercase tracking-widest ml-1">/ night</span>
                    </p>
                    <button 
                      onClick={() => setSelectedRoomType(rt)}
                      className="bg-black text-white px-6 py-2.5 rounded-full hover:bg-gray-800 transition-colors font-medium text-sm shadow-md hover:shadow-lg"
                    >
                      Reserve
                    </button>
                  </div>
                </div>
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
                <button type="submit" disabled={isBooking} className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50">
                  {isBooking ? "Confirming..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
