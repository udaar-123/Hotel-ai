"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BookingsPage() {
  const { data: resData, error, isLoading: loading } = useSWR("/api/v1/bookings", fetcher);
  const bookings = resData?.data || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <Link href="/manager/bookings/new" className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800">
          New Walk-in Booking
        </Link>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-100 text-slate-900">
              <tr>
                <th className="px-4 py-3 border-b">ID</th>
                <th className="px-4 py-3 border-b">Guest Name</th>
                <th className="px-4 py-3 border-b">Check In</th>
                <th className="px-4 py-3 border-b">Check Out</th>
                <th className="px-4 py-3 border-b">Amount</th>
                <th className="px-4 py-3 border-b">Status</th>
                <th className="px-4 py-3 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 border-b">
                  <td className="px-4 py-3 text-slate-900 font-mono">{b.id.substring(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-900">{b.booking_guests?.[0]?.name || "N/A"}</td>
                  <td className="px-4 py-3 text-slate-900">{new Date(b.checkInDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-900">{new Date(b.checkOutDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-900">${b.totalAmount}</td>
                  <td className="px-4 py-3 text-slate-900">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200">
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/manager/bookings/${b.id}`} className="text-blue-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-center text-gray-500">
                    No bookings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
