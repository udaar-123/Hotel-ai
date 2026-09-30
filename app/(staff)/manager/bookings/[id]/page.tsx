"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchBooking = async () => {
    try {
      const res = await fetch(`/api/v1/bookings/${params.id}`);
      const json = await res.json();
      if (json.success) {
        setBooking(json.data);
      } else {
        setError("Failed to load booking.");
      }
    } catch (err) {
      console.error(err);
      setError("Error loading booking.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setInvoiceLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/invoices/${params.id}/generate`, { method: "POST" });
      const json = await res.json();
      if (res.ok && (json.success || json.data)) {
        await fetchBooking();
        window.open(`/shared/invoice/${params.id}`, "_blank");
      } else {
        setError(json.error?.message || "Failed to generate invoice");
      }
    } catch (err) {
      console.error(err);
      setError("Error generating invoice");
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchBooking();
    }
  }, [params.id]);

  const handleAction = async (action: "check-in" | "check-out") => {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/bookings/${params.id}/${action}`, {
        method: "POST"
      });
      const json = await res.json();
      if (json.success) {
        await fetchBooking();
      } else {
        setError(json.error?.message || `Failed to ${action}`);
      }
    } catch (err) {
      console.error(err);
      setError(`Error performing ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!booking) return <div className="p-6 text-red-500">{error || "Booking not found"}</div>;

  const guest = booking.booking_guests?.[0];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="mb-4 text-blue-600 hover:underline">
        &larr; Back to Bookings
      </button>

      <div className="bg-white shadow rounded-lg p-6 text-slate-900">
        <div className="flex justify-between items-start mb-6 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold">Booking #{booking.id}</h1>
            <p className="text-gray-500 mt-1">Status: <span className="font-semibold text-slate-800">{booking.status}</span></p>
          </div>
          <div>
            {(booking.status === "CONFIRMED" || booking.status === "PENDING_PAYMENT") && (
              <button 
                onClick={() => handleAction("check-in")}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 mr-2"
              >
                {actionLoading ? "Processing..." : "Check In"}
              </button>
            )}
            {booking.status === "CHECKED_IN" && (
              <button 
                onClick={() => handleAction("check-out")}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Check Out"}
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Guest Details</h2>
            {guest ? (
              <ul className="space-y-1 text-sm text-slate-700">
                <li><strong className="text-slate-900">Name:</strong> {guest.name}</li>
                <li><strong className="text-slate-900">Email:</strong> {guest.email || "N/A"}</li>
                <li><strong className="text-slate-900">Phone:</strong> {guest.phone || "N/A"}</li>
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No guest info found.</p>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Stay Details</h2>
            <ul className="space-y-1 text-sm text-slate-700">
              <li><strong className="text-slate-900">Check-in:</strong> {new Date(booking.checkInDate).toLocaleDateString()}</li>
              <li><strong className="text-slate-900">Check-out:</strong> {new Date(booking.checkOutDate).toLocaleDateString()}</li>
              <li><strong className="text-slate-900">Room:</strong> {booking.rooms?.roomNumber || "N/A"}</li>
              <li><strong className="text-slate-900">Guests Count:</strong> {booking.guestCount}</li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-2">Payment Details</h2>
            <ul className="space-y-1 text-sm text-slate-700">
              <li><strong className="text-slate-900">Total Price:</strong> ${booking.totalAmount}</li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-2">Invoice</h2>
            {booking.status !== "PENDING_PAYMENT" && booking.status !== "CANCELLED" ? (
              <div className="mt-2">
                {booking.invoices && booking.invoices.length > 0 ? (
                  <button 
                    onClick={() => window.open(`/shared/invoice/${booking.id}`, "_blank")}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View Invoice
                  </button>
                ) : (
                  <button 
                    onClick={handleGenerateInvoice}
                    disabled={invoiceLoading}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {invoiceLoading ? "Generating..." : "Generate Invoice"}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Invoice not available for this booking status.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
