"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchBooking = async () => {
    try {
      const res = await fetch(`/api/v1/bookings/${id}`);
      if (!res.ok) throw new Error("Failed to fetch booking");
      const resData = await res.json();
      setBooking(resData.data || resData);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();
  }, [id]);

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

  if (isLoading) return <div className="p-6">Loading booking details...</div>;
  if (!booking) return <div className="p-6">Booking not found.</div>;

  const canCancel = booking.status === "PENDING_PAYMENT" || booking.status === "CONFIRMED";

  return (
    <div className="p-6 max-w-3xl mx-auto text-slate-100">
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

      {canCancel && (
        <div className="mb-6 text-right">
          <button 
            onClick={cancelBooking}
            disabled={isCancelling}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
          >
            {isCancelling ? "Cancelling..." : "Cancel Booking"}
          </button>
        </div>
      )}

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
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploading ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
