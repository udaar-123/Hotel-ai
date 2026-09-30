"use client";

import { use } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function InvoicePage({ params }: { params: Promise<{ bookingId: string }> }) {
  const resolvedParams = use(params);
  const { bookingId } = resolvedParams;
  const { data: resData, error: swrError, isLoading: loading } = useSWR(`/api/v1/invoices/${bookingId}`, fetcher);
  
  const invoice = resData?.success ? resData.data : null;
  const error = swrError?.message || (!resData?.success && resData?.error ? resData.error : "");

  if (loading) return <div className="p-8 text-center text-gray-500">Loading invoice...</div>;
  if (error || !invoice) return <div className="p-8 text-center text-red-500">{error || "Invoice not found"}</div>;

  const booking = invoice.bookings;
  const hotel = booking?.hotels;
  const room = booking?.rooms;
  const guest = booking?.booking_guests?.[0];

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-slate-900 flex flex-col items-center">
      <div className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-lg p-10 relative">
        <button 
          onClick={() => window.print()} 
          className="no-print absolute top-4 right-4 bg-black text-white px-4 py-2 rounded hover:bg-gray-800 shadow"
        >
          Print to PDF
        </button>

        <div className="border-b-2 border-gray-200 pb-8 mb-8 mt-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 uppercase tracking-wider">INVOICE</h1>
              <p className="text-gray-500 mt-2">#{invoice.invoiceNum}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-gray-800">{hotel?.name || "Hotel"}</h2>
              <p className="text-gray-600 text-sm mt-1">{hotel?.address || "Hotel Address"}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between mb-12">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Billed To</h3>
            <p className="font-bold text-gray-800 text-lg">{guest?.name || "Guest"}</p>
            <p className="text-gray-600">{guest?.email}</p>
            <p className="text-gray-600">{guest?.phone}</p>
          </div>
          <div className="text-right">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Invoice Details</h3>
            <p><span className="text-gray-600">Date Issued:</span> {new Date(invoice.issuedAt).toLocaleDateString()}</p>
            <p><span className="text-gray-600">Booking ID:</span> {booking?.id}</p>
            <p><span className="text-gray-600">Status:</span> <span className="font-semibold">{invoice.status}</span></p>
          </div>
        </div>

        <table className="w-full text-left mb-12 border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="py-3 text-gray-800 font-semibold uppercase text-sm">Description</th>
              <th className="py-3 text-gray-800 font-semibold uppercase text-sm text-center">Dates</th>
              <th className="py-3 text-gray-800 font-semibold uppercase text-sm text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-4">
                <p className="font-medium text-gray-800">Room Stay ({room?.roomNumber || "N/A"})</p>
                <p className="text-sm text-gray-500">{booking?.guestCount} Guest(s)</p>
              </td>
              <td className="py-4 text-center text-gray-600">
                {new Date(booking?.checkInDate).toLocaleDateString()} - {new Date(booking?.checkOutDate).toLocaleDateString()}
              </td>
              <td className="py-4 text-right text-gray-800 font-medium">
                ${invoice.totalAmount}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-1/2">
            <div className="flex justify-between py-2 border-t-2 border-gray-800 font-bold text-lg">
              <span>Total Amount</span>
              <span>${invoice.totalAmount}</span>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center text-gray-500 text-sm">
          <p>Thank you for choosing {hotel?.name || "us"}!</p>
          <p>If you have any questions concerning this invoice, please contact our support.</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          .no-print {
            display: none !important;
          }
          .min-h-screen {
            min-height: auto;
            background: white;
            padding: 0;
          }
          .shadow-lg {
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}
