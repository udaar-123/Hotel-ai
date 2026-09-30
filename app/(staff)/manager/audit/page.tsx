"use client";

import React, { useState } from "react";
import useSWR from "swr";

type AuditLog = {
  id: string;
  action: string;
  targetTable: string;
  oldValue: any;
  newValue: any;
  createdAt: string;
  users: {
    name: string;
    email: string;
  } | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState("All");

  const url = actionFilter === "All" 
    ? "/api/v1/audit" 
    : `/api/v1/audit?action=${encodeURIComponent(actionFilter)}`;

  const { data: resData, error, isLoading } = useSWR(url, fetcher);
  
  const data = resData || [];
  const logs = Array.isArray(data) ? data : data.data || [];


  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
            <p className="text-sm text-gray-400 mt-1">Immutable system audit trail.</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-2">
            <label htmlFor="action-filter" className="text-sm font-medium text-slate-700">
              Filter:
            </label>
            <select
              id="action-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="block w-56 rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm px-3 py-2 bg-white border outline-none"
            >
              <option value="All">All Actions</option>
              <option value="BOOKING_CONFIRMED">BOOKING_CONFIRMED</option>
              <option value="REFUND_APPROVED">REFUND_APPROVED</option>
              <option value="ROOM_STATUS_CHANGED">ROOM_STATUS_CHANGED</option>
              <option value="REVIEW_MODERATED">REVIEW_MODERATED</option>
            </select>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-gray-50 text-gray-900">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left font-semibold tracking-wider">Date/Time</th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold tracking-wider">Actor</th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold tracking-wider">Action</th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold tracking-wider">Target Table</th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-mono text-xs">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-slate-200 rounded w-28"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-slate-200 rounded w-32"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-slate-200 rounded w-36"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-slate-200 rounded w-24"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-200 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400 font-sans text-sm">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-sans">
                        <div className="font-semibold text-slate-900">
                          {log.users?.name || log.users?.email || "System"}
                        </div>
                        {log.users?.name && (
                          <div className="text-gray-400 text-xs mt-0.5">{log.users.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {log.targetTable}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className="max-w-md overflow-auto space-y-1">
                          {log.oldValue && (
                            <div className="flex gap-2">
                              <span className="font-semibold text-rose-600 shrink-0">Old:</span>
                              <span className="break-all">{JSON.stringify(log.oldValue)}</span>
                            </div>
                          )}
                          {log.newValue && (
                            <div className="flex gap-2">
                              <span className="font-semibold text-emerald-600 shrink-0">New:</span>
                              <span className="break-all">{JSON.stringify(log.newValue)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
