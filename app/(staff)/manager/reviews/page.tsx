"use client";

import { useEffect, useState } from "react";

interface Review {
  id: string;
  rating: number;
  comment: string;
  users?: { name: string };
  bookings?: { checkInDate: string; checkOutDate: string };
}

export default function ModerationQueuePage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/v1/reviews/moderation-queue");
      if (!res.ok) throw new Error("Failed to fetch moderation queue");
      const data = await res.json();
      setReviews(data.data || data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleModerate = async (id: string, action: "PUBLISHED" | "REJECTED") => {
    try {
      const res = await fetch(`/api/v1/reviews/${id}/moderate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`Failed to ${action.toLowerCase()} review`);
      fetchReviews();
    } catch (error) {
      console.error(error);
      alert(`Error trying to ${action.toLowerCase()} review`);
    }
  };

  if (isLoading) return <div className="p-6">Loading moderation queue...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-slate-100">Review Moderation Queue</h1>
      
      {reviews.length === 0 ? (
        <div className="bg-white p-6 rounded shadow text-slate-900">
          No reviews pending moderation.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white p-6 rounded shadow text-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">{review.users?.name || "Guest"}</span>
                  <span className="text-yellow-500 font-bold">{review.rating} / 5</span>
                </div>
                {review.bookings && (
                  <p className="text-sm text-gray-500 mb-4">
                    Stay: {new Date(review.bookings.checkInDate).toLocaleDateString()} - {new Date(review.bookings.checkOutDate).toLocaleDateString()}
                  </p>
                )}
                <p className="text-gray-700 italic mb-6">"{review.comment}"</p>
              </div>
              
              <div className="flex gap-2 mt-auto">
                <button 
                  onClick={() => handleModerate(review.id, "PUBLISHED")}
                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition"
                >
                  Approve
                </button>
                <button 
                  onClick={() => handleModerate(review.id, "REJECTED")}
                  className="flex-1 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 transition"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
