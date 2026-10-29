# How the Role-Aware AI Agent Works

The AI ChatWidget in this application is a **Role-Aware Agentic System** built with the Vercel AI SDK and Groq (`qwen/qwen3.8-27b`). It dynamically adapts its behavior, system prompt, and callable tools based on the authenticated user's role.

Here is the step-by-step logic executing in `app/api/chat/route.ts`:

### 1. Authentication & Role Detection
When a user sends a message in the chat widget, the request hits `/api/chat` (`app/api/chat/route.ts`), which decrypts the HTTP-only `session` cookie:
* **Unauthenticated visitors** default to `"GUEST"`.
* **Authenticated users** resolve to their RBAC role (`"CUSTOMER"`, `"HOUSEKEEPER"`, `"RECEPTIONIST"`, `"MANAGER"`, or `"ADMIN"`).

### 2. Dynamic System Prompting & Agentic Tool Injection
Each role receives a tailored persona and strict tool scoping so users can only invoke actions permitted for their role:

* **GUEST:**
  * `checkAvailability` — Search available room types by check-in/out dates and guest count.
* **CUSTOMER:**
  * `checkAvailability`, `getCustomerDashboard`, `getMyBookings`, `bookRoom`
  * `cancelMyBooking` — Cancel an existing reservation.
  * `requestBookingRefund` — Request a refund for a completed booking payment.
  * `submitStayReview` — Submit a 1–5 star rating and comment for a checked-out stay.
  * `getMyBookingInvoice` — Generate or retrieve an invoice for a booking.
* **HOUSEKEEPER:**
  * `getHousekeepingQueue` — View rooms in `CHECKED_OUT`, `CLEANING`, or `MAINTENANCE` status.
  * `updateRoomStatus` — Transition room states (`CHECKED_OUT` → `CLEANING` → `AVAILABLE` / `MAINTENANCE`).
  * `getRoomStatusBoard` — View the live status board for all rooms.
* **RECEPTIONIST:**
  * `getFrontDeskOverview` — View today's arrivals, departures, available rooms, and occupied rooms.
  * `getAllBookings` — Search and filter hotel bookings by status or guest name.
  * `checkInGuest` / `checkOutGuest` — Perform front-desk guest check-in and check-out.
  * `createWalkInBooking` — Create offline/walk-in bookings with cash payment tracking.
  * `generateBookingInvoice` — Generate or fetch booking invoices.
  * `getRoomStatusBoard` / `updateRoomStatus` — View and update room statuses.
* **MANAGER:**
  * Includes all **Housekeeper** and **Receptionist** operational tools, plus:
  * `getManagerDashboard`, `getOccupancyReport`, `getRevenueReport`, `getBookingsSummaryReport`
  * `listStaffMembers`, `createStaffMember`, `toggleStaffStatus` (manage Receptionists & Housekeepers)
  * `listRoomTypes`, `createRoomType`, `createRoom` (inventory management)
  * `getRefundQueue`, `processRefundRequest` (approve/reject refunds)
  * `getPendingReviews`, `moderateReview` (publish/reject customer reviews)
  * `getAuditLogs` (inspect system audit trail)
* **ADMIN:**
  * Includes all **Manager**, **Receptionist**, and **Housekeeper** tools, plus:
  * `getAdminDashboard` — View platform-wide revenue, total hotels, and active managers.
  * `listManagers`, `createManager` — Onboard and manage hotel Managers (`toggleStaffStatus` also supports activating/deactivating Managers for Admins).
