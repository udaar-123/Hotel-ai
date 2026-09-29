"use client";

import { useEffect, useState } from "react";

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRefunds = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/refunds");
      if (!res.ok) throw new Error("Failed to fetch refunds");
      const data = await res.json();
      setRefunds(data.data || data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const handleAction = async (id: string, action: "APPROVE" | "REJECT") => {
    if (!confirm(`Are you sure you want to ${action.toLowerCase()} this refund?`)) return;

    try {
      const res = await fetch(`/api/v1/refunds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`Failed to ${action.toLowerCase()} refund`);
      alert(`Refund ${action.toLowerCase()}d successfully`);
      fetchRefunds();
    } catch (error) {
      console.error(error);
      alert(`Error trying to ${action.toLowerCase()} refund`);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading refunds...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto text-slate-100">
      <h1 className="text-3xl font-bold mb-6">Refund Requests</h1>

      <div className="bg-white shadow rounded overflow-hidden text-slate-900">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-4 font-semibold text-gray-700">Refund ID</th>
              <th className="p-4 font-semibold text-gray-700">Booking ID</th>
              <th className="p-4 font-semibold text-gray-700">Amount</th>
              <th className="p-4 font-semibold text-gray-700">Reason</th>
              <th className="p-4 font-semibold text-gray-700">Status</th>
              <th className="p-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {refunds.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No refunds found.
                </td>
              </tr>
            ) : (
              refunds.map((refund) => (
                <tr key={refund.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">{refund.id}</td>
                  <td className="p-4">{refund.payments?.bookingId || 'N/A'}</td>
                  <td className="p-4">${refund.amount}</td>
                  <td className="p-4">{refund.reason}</td>
                  <td className="p-4">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      refund.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      refund.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {refund.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {refund.status === "REQUESTED" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(refund.id, "APPROVE")}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(refund.id, "REJECT")}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
