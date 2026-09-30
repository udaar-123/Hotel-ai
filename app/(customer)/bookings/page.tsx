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

  if (isLoading) return <div className="p-6 text-center text-slate-100">Loading bookings...</div>;

  const now = new Date();
  const upcoming = bookings.filter(b => new Date(b.checkInDate) >= now || ["CONFIRMED", "PENDING_PAYMENT", "CHECKED_IN"].includes(b.status));
  const past = bookings.filter(b => new Date(b.checkInDate) < now && !["CONFIRMED", "PENDING_PAYMENT", "CHECKED_IN"].includes(b.status));

  const renderList = (list: any[], title: string) => (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      {list.length === 0 ? (
        <p className="text-gray-400">No {title.toLowerCase()} found.</p>
      ) : (
        <div className="space-y-4">
          {list.map((booking, idx) => (
            <Link key={idx} href={`/bookings/${booking.id}`} className="block border border-slate-700 rounded p-4 shadow bg-slate-800 hover:bg-slate-700 transition text-slate-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-lg">Booking #{booking.id.slice(0, 8)}...</p>
                  <p className="text-gray-400">Status: <span className="font-medium text-white">{booking.status}</span></p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl text-green-400">${booking.totalAmount}</p>
                </div>
              </div>
              <div className="text-sm text-gray-400">
                <p>Check In: {new Date(booking.checkInDate).toLocaleDateString()}</p>
                <p>Check Out: {new Date(booking.checkOutDate).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto text-slate-100">
      <h1 className="text-3xl font-bold mb-8">My Bookings</h1>
      {renderList(upcoming, "Upcoming Bookings")}
      {renderList(past, "Past Bookings")}
    </div>
  );
}
