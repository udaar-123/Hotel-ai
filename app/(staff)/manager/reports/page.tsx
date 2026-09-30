"use client";

import { useState, useEffect } from "react";

export default function ReportsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const [occupancyData, setOccupancyData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [bookingsSummary, setBookingsSummary] = useState<any>(null);

  useEffect(() => {
    // Set default to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    setEndDate(today.toISOString().split("T")[0]);
    setStartDate(thirtyDaysAgo.toISOString().split("T")[0]);
  }, []);

  const fetchReports = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    try {
      const qs = `?startDate=${startDate}&endDate=${endDate}`;
      const [occRes, revRes, bookRes] = await Promise.all([
        fetch(`/api/v1/reports/occupancy${qs}`),
        fetch(`/api/v1/reports/revenue${qs}`),
        fetch(`/api/v1/reports/bookings-summary${qs}`)
      ]);

      const occData = await occRes.json();
      const revData = await revRes.json();
      const bookData = await bookRes.json();

      setOccupancyData(occData.data);
      setRevenueData(revData.data);
      setBookingsSummary(bookData.data);
    } catch (error) {
      console.error("Error fetching reports", error);
      alert("Failed to fetch reports.");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!occupancyData || !revenueData || !bookingsSummary) {
      alert("Please fetch reports first.");
      return;
    }

    const lines: string[] = [];
    lines.push("Report Category,Metric,Value");
    
    // Occupancy
    lines.push(`Occupancy,Rate,${occupancyData.rate}`);
    lines.push(`Occupancy,Booked Nights,${occupancyData.bookedNights}`);
    lines.push(`Occupancy,Total Possible Nights,${occupancyData.totalPossibleNights}`);
    
    // Revenue
    lines.push(`Revenue,Total Revenue,${revenueData.totalRevenue}`);
    if (revenueData.byMethod) {
      Object.entries(revenueData.byMethod).forEach(([key, val]) => {
        lines.push(`Revenue By Method,${key},${val}`);
      });
    }
    if (revenueData.byRoomType) {
      Object.entries(revenueData.byRoomType).forEach(([key, val]) => {
        lines.push(`Revenue By Room Type,${key},${val}`);
      });
    }

    // Bookings Summary
    lines.push(`Bookings Summary,Total Bookings,${bookingsSummary.totalBookings}`);
    lines.push(`Bookings Summary,Total Value,${bookingsSummary.totalValue}`);
    lines.push(`Bookings Summary,Refunds Processed,${bookingsSummary.refundsProcessed}`);
    lines.push(`Bookings Summary,Refunds Amount,${bookingsSummary.refundsAmount}`);

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${startDate}-to-${endDate}.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports Dashboard</h1>
      </div>

      <div className="bg-white p-4 rounded shadow mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div>
          <label className="block text-sm font-medium text-gray-700">Start Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="mt-1 block w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">End Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="mt-1 block w-full p-2 border rounded"
          />
        </div>
        <div className="flex-1"></div>
        <div className="flex gap-2 mt-4 md:mt-0 items-end">
          <button 
            onClick={fetchReports} 
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Fetching..." : "Fetch Reports"}
          </button>
          <button 
            onClick={exportToCSV}
            disabled={!occupancyData || loading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            Export to CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Occupancy Card */}
        <div className="bg-white shadow rounded p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Occupancy</h2>
          {occupancyData ? (
            <div className="space-y-2">
              <p><span className="font-medium">Rate:</span> {occupancyData.rate}</p>
              <p><span className="font-medium">Booked Nights:</span> {occupancyData.bookedNights}</p>
              <p><span className="font-medium">Total Possible Nights:</span> {occupancyData.totalPossibleNights}</p>
            </div>
          ) : (
            <p className="text-gray-500">No data</p>
          )}
        </div>

        {/* Revenue Card */}
        <div className="bg-white shadow rounded p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Revenue</h2>
          {revenueData ? (
            <div className="space-y-4">
              <p><span className="font-medium">Total Revenue:</span> ${revenueData.totalRevenue}</p>
              
              {revenueData.byMethod && (
                <div>
                  <p className="font-medium mb-1">By Method:</p>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {Object.entries(revenueData.byMethod).map(([key, val]) => (
                      <li key={key}>{key}: ${val as React.ReactNode}</li>
                    ))}
                  </ul>
                </div>
              )}

              {revenueData.byRoomType && (
                <div>
                  <p className="font-medium mb-1">By Room Type:</p>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {Object.entries(revenueData.byRoomType).map(([key, val]) => (
                      <li key={key}>{key}: ${val as React.ReactNode}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No data</p>
          )}
        </div>

        {/* Bookings Summary Card */}
        <div className="bg-white shadow rounded p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Bookings Summary</h2>
          {bookingsSummary ? (
            <div className="space-y-2">
              <p><span className="font-medium">Total Bookings:</span> {bookingsSummary.totalBookings}</p>
              <p><span className="font-medium">Total Value:</span> ${bookingsSummary.totalValue}</p>
              <p><span className="font-medium">Refunds Processed:</span> {bookingsSummary.refundsProcessed}</p>
              <p><span className="font-medium">Refunds Amount:</span> ${bookingsSummary.refundsAmount}</p>
            </div>
          ) : (
            <p className="text-gray-500">No data</p>
          )}
        </div>
      </div>
    </div>
  );
}
