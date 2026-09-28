"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await fetch("/api/v1/bookings");
        if (!res.ok) throw new Error("Failed to fetch bookings");
        const resData = await res.json();
        setBookings(resData.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBookings();
  }, []);

  if (isLoading) return <div className="p-6">Loading bookings...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto text-slate-100">
      <h1 className="text-3xl font-bold mb-6">My Bookings</h1>
      
      {bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking, idx) => (
            <Link key={idx} href={`/bookings/${booking.id}`} className="block border rounded p-4 shadow bg-white hover:bg-gray-50 transition text-slate-900">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-lg">Booking #{booking.id.slice(0, 8)}...</p>
                  <p className="text-gray-600">Status: <span className="font-medium">{booking.status}</span></p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl">${booking.totalAmount}</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                <p>Check In: {new Date(booking.checkInDate).toLocaleDateString()}</p>
                <p>Check Out: {new Date(booking.checkOutDate).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
