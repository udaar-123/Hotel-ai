"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  checkInDate: z.string().min(1, "Check-in date is required"),
  checkOutDate: z.string().min(1, "Check-out date is required"),
  guests: z.coerce.number().min(1, "At least 1 guest required"),
  guestName: z.string().min(1, "Guest name is required"),
  guestEmail: z.string().email("Invalid email").or(z.literal("")),
  guestPhone: z.string().min(1, "Phone number is required"),
  amountPaid: z.coerce.number().min(0, "Amount must be positive"),
  roomId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewWalkInBooking() {
  const router = useRouter();
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      guests: 1,
      amountPaid: 0,
    }
  });

  const checkInDate = watch("checkInDate");
  const checkOutDate = watch("checkOutDate");
  const guests = watch("guests");

  const searchAvailability = async () => {
    if (!checkInDate || !checkOutDate || !guests) {
      setError("Please fill check-in, check-out, and guests first.");
      return;
    }
    setError("");
    setSearching(true);
    setHasSearched(false);
    try {
      const qs = new URLSearchParams({
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
        guests: guests.toString()
      });
      const res = await fetch(`/api/v1/rooms/availability?${qs.toString()}`);
      const json = await res.json();
      if (json.success) {
        setAvailableRooms(json.data);
        setHasSearched(true);
      } else {
        setError(json.error || "Failed to find availability.");
      }
    } catch (err) {
      console.error(err);
      setError("Error checking availability.");
    } finally {
      setSearching(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!data.roomId) {
      setError("Please select a room.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/v1/bookings/offline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        router.push("/manager/bookings");
      } else {
        setError(json.error?.message || "Failed to create booking.");
      }
    } catch (err) {
      console.error(err);
      setError("Error creating booking.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white shadow rounded-lg my-6">
      <h1 className="text-2xl font-bold mb-6">New Walk-in Booking</h1>
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Check-in Date</label>
            <input type="date" {...register("checkInDate")} className="w-full border rounded p-2" />
            {errors.checkInDate && <p className="text-red-500 text-sm mt-1">{errors.checkInDate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Check-out Date</label>
            <input type="date" {...register("checkOutDate")} className="w-full border rounded p-2" />
            {errors.checkOutDate && <p className="text-red-500 text-sm mt-1">{errors.checkOutDate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Guests</label>
            <input type="number" min="1" {...register("guests")} className="w-full border rounded p-2" />
            {errors.guests && <p className="text-red-500 text-sm mt-1">{errors.guests.message}</p>}
          </div>
        </div>

        <button 
          type="button" 
          onClick={searchAvailability}
          disabled={searching}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium"
        >
          {searching ? "Searching..." : "Search Availability"}
        </button>

        {hasSearched && availableRooms.length === 0 && (
          <div className="p-4 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg">
            No rooms found for the selected dates and guest count. Please try adjusting your search.
          </div>
        )}

        {hasSearched && availableRooms.length > 0 && (
          <div className="p-4 bg-gray-50 border rounded-lg">
            <label className="block text-sm font-medium mb-2">Select Available Room</label>
            <select {...register("roomId")} className="w-full border rounded p-2 bg-white">
              <option value="">-- Choose a room --</option>
              {availableRooms.map((rt: any) => 
                rt.rooms?.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber} - {rt.name || rt.roomType?.name}
                  </option>
                ))
              )}
            </select>
            {errors.roomId && <p className="text-red-500 text-sm mt-1">{errors.roomId.message}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <label className="block text-sm font-medium mb-1">Guest Name</label>
            <input type="text" {...register("guestName")} className="w-full border rounded p-2" />
            {errors.guestName && <p className="text-red-500 text-sm mt-1">{errors.guestName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Guest Email</label>
            <input type="email" {...register("guestEmail")} className="w-full border rounded p-2" />
            {errors.guestEmail && <p className="text-red-500 text-sm mt-1">{errors.guestEmail.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Guest Phone</label>
            <input type="text" {...register("guestPhone")} className="w-full border rounded p-2" />
            {errors.guestPhone && <p className="text-red-500 text-sm mt-1">{errors.guestPhone.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount Paid (Cash)</label>
            <input type="number" min="0" step="0.01" {...register("amountPaid")} className="w-full border rounded p-2" />
            {errors.amountPaid && <p className="text-red-500 text-sm mt-1">{errors.amountPaid.message}</p>}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={submitting}
          className="w-full py-2 bg-black text-white rounded hover:bg-gray-800 font-medium"
        >
          {submitting ? "Submitting..." : "Create Booking"}
        </button>
      </form>
    </div>
  );
}
