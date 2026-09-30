"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  const { data: resData, error: fetchError, isLoading, mutate: fetchBooking } = useSWR(`/api/v1/bookings/${id}`, fetcher);
  const booking = resData?.data || resData;

  const [isCancelling, setIsCancelling] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const handleGenerateInvoice = async () => {
    setInvoiceLoading(true);
    try {
      const res = await fetch(`/api/v1/invoices/${id}/generate`, { method: "POST" });
      const json = await res.json();
      if (res.ok && (json.success || json.data)) {
        await fetchBooking();
        window.open(`/shared/invoice/${id}`, "_blank");
      } else {
        alert(json.error || "Failed to generate invoice");
      }
    } catch (err) {
      console.error(err);
      alert("Error generating invoice");
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    }
  }, [id]);

  const handlePayment = async () => {
    try {
      const res = await fetch('/api/v1/payments/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id })
      });
      if (!res.ok) throw new Error("Failed to create order");
      const json = await res.json();
      const orderData = json.data;
      
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_T0LdkLmWCxUbuS",
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: "Hotel Booking",
        description: "Booking Payment",
        handler: async function (response: any) {
          try {
            await fetch('/api/v1/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            alert("Payment Successful!");
            fetchBooking();
          } catch (err) {
            console.error("Verification failed", err);
          }
        },
      };
      
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e) {
      console.error(e);
      alert("Error initiating payment");
    }
  };

  const requestRefund = async () => {
    const reason = window.prompt("Please enter a reason for the refund:");
    if (!reason) return;
    
    try {
      const res = await fetch("/api/v1/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id, reason }),
      });
      if (!res.ok) throw new Error("Failed to request refund");
      alert("Refund requested successfully");
      fetchBooking();
    } catch (error) {
      console.error(error);
      alert("Error requesting refund");
    }
  };

  const cancelBooking = async () => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/v1/bookings/${id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to cancel booking");
      alert("Booking cancelled successfully");
      fetchBooking(); // Refresh
    } catch (error) {
      console.error(error);
      alert("Error cancelling booking");
    } finally {
      setIsCancelling(false);
    }
  };

  const uploadIdentityDocument = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    
    try {
      // Get signature
      const sigRes = await fetch(`/api/v1/bookings/${id}/identity-document`);
      const sigResData = await sigRes.json();
      const { timestamp, signature, apiKey, cloudName, folder } = sigResData.data;
      
      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("api_key", apiKey);
      formData.append("timestamp", timestamp.toString());
      formData.append("signature", signature);
      formData.append("folder", folder);
      
      const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });
      
      const cloudinaryData = await cloudinaryRes.json();
      if (!cloudinaryRes.ok) {
        throw new Error(`Cloudinary Error: ${cloudinaryData.error?.message || "Failed to upload image"}`);
      }
      
      // Save to backend
      const saveRes = await fetch(`/api/v1/bookings/${id}/identity-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: cloudinaryData.secure_url,
          publicId: cloudinaryData.public_id,
          documentType: "ID_CARD"
        })
      });
      
      if (!saveRes.ok) throw new Error("Failed to save identity document url");
      
      alert("Identity document uploaded successfully");
      fetchBooking(); // Refresh
    } catch (error) {
      console.error(error);
      alert("Error uploading document");
    } finally {
      setIsUploading(false);
      setUploadFile(null);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReview(true);
    try {
      const res = await fetch("/api/v1/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id, rating: reviewRating, comment: reviewComment }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to submit review");
      setReviewSubmitted(true);
      fetchBooking(); // refresh
    } catch (error: any) {
      alert("Error submitting review: " + error.message);
      console.error(error);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) return <div className="p-6">Loading booking details...</div>;
  if (!booking) return <div className="p-6">Booking not found.</div>;

  const canCancel = booking.status === "PENDING_PAYMENT" || booking.status === "CONFIRMED";
  const canPay = booking.status === "PENDING_PAYMENT";
  const canRefund = booking.status === "CANCELLED" && (booking.payments?.status === "COMPLETED" || booking.totalAmount > 0) && !booking.payments?.refunds;

  return (
    <div className="p-6 max-w-3xl mx-auto text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Booking Details</h1>
        <button onClick={() => router.back()} className="text-blue-400 hover:underline">← Back</button>
      </div>

      <div className="bg-white shadow rounded p-6 mb-6 text-slate-900">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-sm">Booking ID</p>
            <p className="font-medium">{booking.id}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Status</p>
            <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${
              booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
              booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {booking.status}
            </span>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Check In</p>
            <p className="font-medium">{new Date(booking.checkInDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Check Out</p>
            <p className="font-medium">{new Date(booking.checkOutDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Total Amount</p>
            <p className="font-medium">${booking.totalAmount}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Guests</p>
            <p className="font-medium">{booking.guestCount}</p>
          </div>
        </div>

        <div className="mt-6 border-t pt-4">
          <h2 className="text-xl font-semibold mb-2">Guest Details</h2>
          <p><strong>Name:</strong> {booking.booking_guests?.[0]?.name}</p>
          <p><strong>Email:</strong> {booking.booking_guests?.[0]?.email}</p>
          <p><strong>Phone:</strong> {booking.booking_guests?.[0]?.phone}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-4 justify-end">
        {canPay && (
          <button 
            onClick={handlePayment}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Pay with Razorpay
          </button>
        )}
        {canRefund && (
          <button 
            onClick={requestRefund}
            className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
          >
            Request Refund
          </button>
        )}
        {canCancel && (
          <button 
            onClick={cancelBooking}
            disabled={isCancelling}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
          >
            {isCancelling ? "Cancelling..." : "Cancel Booking"}
          </button>
        )}
        {["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(booking.status) && (
          booking.invoices && booking.invoices.length > 0 ? (
            <button 
              onClick={() => window.open(`/shared/invoice/${booking.id}`, "_blank")}
              className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
            >
              View Invoice
            </button>
          ) : (
            <button 
              onClick={handleGenerateInvoice}
              disabled={invoiceLoading}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {invoiceLoading ? "Generating..." : "Generate Invoice"}
            </button>
          )
        )}
      </div>

      <div className="bg-white shadow rounded p-6 text-slate-900">
        <h2 className="text-xl font-semibold mb-4">Identity Document</h2>
        {booking.identity_docs && booking.identity_docs.length > 0 ? (
          <div>
            <p className="mb-2 text-green-600 font-medium">Document uploaded.</p>
            <img src={booking.identity_docs[0].url} alt="Identity Document" className="max-w-full h-auto rounded border" />
          </div>
        ) : (
          <div>
            <p className="mb-4 text-gray-600">Please upload a valid identity document (e.g. Passport, ID card) to complete your check-in process.</p>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="border p-2 rounded"
              />
              <button 
                onClick={uploadIdentityDocument}
                disabled={!uploadFile || isUploading}
                className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
              >
                {isUploading ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </div>
        )}
      </div>

      {booking.status === "CHECKED_OUT" && !booking.reviews && !reviewSubmitted && (
        <div className="bg-white shadow rounded p-6 text-slate-900 mt-6">
          <h2 className="text-xl font-semibold mb-4">Leave a Review</h2>
          <form onSubmit={submitReview}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Rating</label>
              <select 
                value={reviewRating} 
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="border p-2 rounded w-full md:w-auto"
              >
                {[5, 4, 3, 2, 1].map((num) => (
                  <option key={num} value={num}>{num} Stars</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Comment</label>
              <textarea 
                value={reviewComment} 
                onChange={(e) => setReviewComment(e.target.value)}
                className="border p-2 rounded w-full"
                rows={4}
                required
              ></textarea>
            </div>
            <button 
              type="submit" 
              disabled={isSubmittingReview}
              className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {isSubmittingReview ? "Submitting..." : "Submit Review"}
            </button>
          </form>
        </div>
      )}

      {reviewSubmitted && (
        <div className="bg-green-100 text-green-800 shadow rounded p-6 mt-6">
          Review submitted and pending moderation
        </div>
      )}

    </div>
  );
}
