"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BookingsPage() {
  const { data: resData, error, isLoading } = useSWR("/api/v1/bookings", fetcher);

  if (isLoading) return <div className="p-6 text-center text-gray-900">Loading bookings...</div>;
  if (error) return <div className="p-6 text-center text-red-500">Failed to load bookings</div>;

  const bookings = resData?.data || [];

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
            <Link key={idx} href={`/bookings/${booking.id}`} className="block border border-gray-200 rounded p-4 shadow bg-white hover:bg-gray-100 transition text-gray-900">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-lg">Booking #{booking.id.slice(0, 8)}...</p>
                  <p className="text-gray-400">Status: <span className="font-medium text-gray-900">{booking.status}</span></p>
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
    <div className="p-6 max-w-4xl mx-auto text-gray-900">
      <h1 className="text-3xl font-bold mb-8">My Bookings</h1>
      {renderList(upcoming, "Upcoming Bookings")}
      {renderList(past, "Past Bookings")}
    </div>
  );
}
