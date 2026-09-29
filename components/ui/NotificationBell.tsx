"use client";

import { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/v1/notifications");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRead = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleReadAll = async () => {
    try {
      const res = await fetch("/api/v1/notifications/read-all", { method: "PATCH" });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-800 transition-colors"
      >
        <Bell className="w-6 h-6 text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full transform translate-x-1 -translate-y-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900">
            <h3 className="text-lg font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleReadAll}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-slate-400">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 border-b border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer ${
                    !n.isRead ? "bg-slate-700/20" : ""
                  }`}
                  onClick={() => {
                    if (!n.isRead) handleRead(n.id);
                  }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-sm ${!n.isRead ? "font-bold text-white" : "font-medium text-slate-300"}`}>
                      {n.title}
                    </h4>
                    {!n.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{n.message}</p>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                    {n.link && (
                      <Link href={n.link} className="text-blue-400 hover:underline" onClick={(e) => { e.stopPropagation(); if (!n.isRead) handleRead(n.id); }}>
                        View
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
