# Product Requirements Specification — Hotel Management System

**Document Version:** 1.0
**Status:** Draft — Pending Approval
**Location:** `/docs/requirements.md`

---

## 1. Product Overview

### 1.1 What This System Does

This is a **single-property Hotel Property Management System (PMS)** that digitizes and unifies the day-to-day operations of a hotel: room inventory, guest bookings, payments, invoicing, housekeeping coordination, staff management, and guest communication.

The system provides:

- A **public-facing booking experience** for customers to discover room availability, book rooms, pay online, and manage their stay.
- **Operational dashboards** for hotel staff (Receptionist, Housekeeper, Manager) to manage bookings, rooms, payments, and guests without relying on manual registers, spreadsheets, or phone-based coordination.
- An **administrative layer** for the Admin to provision the staff hierarchy and oversee the property.

### 1.2 Target Users

| User             | Description                                                                        |
| ---------------- | ---------------------------------------------------------------------------------- |
| **Admin**        | The property owner or system owner. Seeded into the system; not self-registered.   |
| **Manager**      | Runs daily hotel operations; manages staff, rooms, refunds, and reporting.         |
| **Receptionist** | Front-desk staff handling walk-in bookings, check-in/check-out, and cash payments. |
| **Housekeeper**  | Staff responsible for room readiness and cleaning status updates.                  |
| **Customer**     | Guests who browse, book, pay for, and review stays.                                |

### 1.3 Main Problems It Solves

- Eliminates manual/paper-based booking registers and double-booking risk.
- Centralizes payment collection (online and offline) and reconciliation.
- Gives housekeeping a real-time, structured view of room status instead of verbal handoffs.
- Provides guests a self-service channel for booking, payment, and post-stay feedback.
- Creates an auditable trail of sensitive operations (refunds, staff creation, room changes).
- Establishes a foundation that can support future AI-driven automation (e.g., smart pricing, AI concierge) without re-architecting core modules.

### 1.4 Scope Boundaries

**In scope:**

- One hotel property, single location.
- Five fixed roles as defined in the Master Instructions.
- Room inventory, bookings (online + offline), payments (Razorpay + cash), refunds, invoicing, notifications, reviews, and audit logging.

**Out of scope (explicitly excluded per Master Instructions):**

- Multi-hotel or multi-branch support.
- Floor-level or building-level modeling.
- GST/tax configuration engine.
- Subscription billing or SaaS metering.
- Super Admin or multi-tenant account structures.
- AI features (architecture must anticipate them; none are built in this phase).

---

## 2. User Roles

### 2.1 ADMIN

**Responsibilities**

- Sole owner of the top-level system account (seeded at deployment, not created via UI signup).
- Oversees the entire platform and staff hierarchy.

**Allowed actions**

- Create, edit, deactivate Manager accounts.
- View all bookings, payments, refunds, and audit logs across the property.
- View system-wide reporting and analytics.
- Access all data Managers can access.

**Restricted actions**

- Cannot be created or deleted through the application UI (seed-only account).
- Does not perform day-to-day operational tasks (booking creation, check-in/out) — these belong to Receptionist/Manager.

**Dashboard requirements**

- Staff management (Managers) overview.
- Property-wide KPIs: occupancy, revenue, bookings, cancellations.
- Full audit log access.
- Read access to all Manager-level dashboard widgets.

---

### 2.2 MANAGER

**Responsibilities**

- Runs daily hotel operations.
- Manages Receptionist and Housekeeper accounts.
- Owns room inventory and pricing configuration.
- Approves refunds and resolves escalations.

**Allowed actions**

- Create, edit, deactivate Receptionist and Housekeeper accounts.
- Create, edit, delete rooms; manage room types and images.
- View and manage all bookings and payments.
- Approve or reject refund requests.
- View audit logs (scoped to hotel operations).
- View reporting/analytics dashboards.

**Restricted actions**

- Cannot create or manage other Managers.
- Cannot access Admin-only seed/account-provisioning functions.

**Dashboard requirements**

- Staff management (Receptionist/Housekeeper).
- Room management (CRUD, image uploads, status).
- Booking oversight (all bookings, filters, search).
- Refund approval queue.
- Revenue and occupancy reporting.
- Audit log viewer.

---

### 2.3 RECEPTIONIST

**Responsibilities**

- Front-desk operations: walk-in bookings, check-in, check-out, cash handling.
- First point of contact for guests on-site.

**Allowed actions**

- Create offline bookings for walk-in guests.
- Collect and record cash payments.
- Assign/reassign rooms to bookings.
- Generate and print/download invoices.
- Perform guest check-in and check-out.
- View room availability and status.
- View bookings (own-created and property-wide, per Manager configuration).

**Restricted actions**

- Cannot create/edit/delete staff accounts.
- Cannot create/edit/delete rooms.
- Cannot approve refunds.
- Cannot view full audit logs (only their own action history, if exposed).

**Dashboard requirements**

- Today's arrivals/departures.
- Quick booking creation form.
- Room status board (available/occupied/dirty/maintenance).
- Invoice generation/download shortcuts.
- Search and filter across bookings.

---

### 2.4 HOUSEKEEPER

**Responsibilities**

- Maintain and report room readiness status.

**Allowed actions**

- View assigned rooms/tasks.
- Update room status (e.g., Dirty → Cleaning → Clean/Ready).
- View room-level notes relevant to cleaning (e.g., late checkout, do-not-disturb).

**Restricted actions**

- Cannot create/edit bookings.
- Cannot access payment, invoice, or guest personal/financial data beyond what's needed to identify a room.
- Cannot manage staff or rooms (structurally — only status transitions).

**Dashboard requirements**

- Task list of rooms needing attention, grouped by status/urgency.
- Simple status-update controls (large touch targets — mobile/tablet-first).
- Minimal, focused UI (no financial widgets).

---

### 2.5 CUSTOMER

**Responsibilities**

- Book and pay for stays; provide identity verification; leave reviews post-stay.

**Allowed actions**

- Register/login via OTP.
- Browse room availability and pricing.
- Create online bookings, upload ID documents, pay via Razorpay.
- View own booking history, invoices, and payment status.
- Cancel eligible bookings (before check-in) and request refunds.
- Submit a review after checkout.
- Manage own profile.

**Restricted actions**

- Cannot view other customers' data.
- Cannot access any staff/admin dashboard or operational data.
- Cannot directly approve their own refund (requires Manager approval).

**Dashboard requirements**

- Upcoming/past bookings.
- Booking detail view (status, invoice, payment).
- Cancellation/refund request flow.
- Review submission (post-checkout).
- Profile management.

---

## 3. Authentication Requirements

### 3.1 Customer Authentication

**OTP Login**

- Customer enters phone number or email.
- System generates a time-bound OTP and delivers it (SMS/email via Resend, queued through BullMQ).
- OTP has a defined expiration window and a limited number of verification attempts.
- On successful verification, a session is created (HTTP-only cookie).
- New customers are implicitly registered on first successful OTP login; returning customers are logged in.

**Logout**

- Invalidates the active session/cookie server-side.

**Profile**

- Customers can view and update profile details (name, contact info, saved identity documents where applicable).

### 3.2 Staff Authentication (Manager, Receptionist, Housekeeper)

**Email + Password Login**

- Staff log in with email and password.
- Passwords are hashed (never stored or logged in plaintext).
- Failed login attempts are rate-limited.

**Forgot Password**

- Staff requests a reset link via their registered email.
- A single-use, time-bound, hashed reset token is generated and emailed.
- Token is invalidated after use or expiration.

**Reset Password**

- Staff sets a new password via the emailed link.
- New password is validated against complexity rules and hashed before storage.
- All existing sessions for that account are invalidated after a successful reset.

**Account Creation Flow (Staff)**

- Staff accounts are never self-registered.
- Creation flow:
  1. Admin creates a Manager, **or** Manager creates a Receptionist/Housekeeper.
  2. System generates a secure temporary password.
  3. Password is hashed and stored.
  4. Credentials (email + temporary password) are emailed to the new staff member via Resend (queued job).
  5. Staff member is required/prompted to change the password on first login.

### 3.3 Admin Authentication

- Admin is a seeded account (not created through any UI flow).
- Uses the same email + password login mechanism as staff, with the same security controls (hashing, rate limiting, forgot/reset password).

---

## 4. Room Management

### 4.1 Predefined Room Types

- A fixed, configurable set of room types (e.g., Standard, Deluxe, Suite, Executive) — defined as an enum/reference set, editable by Manager, not freeform per booking.
- Each room type defines: base price, max occupancy, default amenities, description.

### 4.2 Room Creation (Manager)

- Manager creates individual rooms, each assigned to a room type.
- Required fields: room number/identifier, room type, floor/location label (informational only — no structural floor modeling), base price override (optional), status (default: Available).

### 4.3 Room Editing (Manager)

- Manager can edit room details: type, price override, amenities, description, active/inactive flag.
- Edits must not silently affect bookings already confirmed against the room's prior configuration (historical booking records retain a snapshot of price/details at booking time).

### 4.4 Room Deletion (Manager)

- Rooms can be deleted/deactivated only if they have no active or future bookings.
- Soft-delete (deactivation) is preferred over hard delete to preserve historical booking/invoice integrity.

### 4.5 Room Image Upload (Cloudinary)

- Manager uploads one or more images per room via Cloudinary.
- Support setting a primary/cover image.
- Images must be validated (file type, size limits) before upload.
- Deleting a room image removes it from Cloudinary and the room record.

### 4.6 Room Status Lifecycle

```
AVAILABLE → BOOKED → OCCUPIED → CHECKED_OUT → CLEANING → AVAILABLE
                                            ↘ MAINTENANCE ↗
```

| Status      | Meaning                                              | Set By                           |
| ----------- | ---------------------------------------------------- | -------------------------------- |
| AVAILABLE   | Ready to be booked                                   | System / Housekeeper             |
| BOOKED      | Reserved for an upcoming stay, guest not yet arrived | System (on booking confirmation) |
| OCCUPIED    | Guest has checked in                                 | Receptionist                     |
| CHECKED_OUT | Guest has checked out, room needs cleaning           | Receptionist                     |
| CLEANING    | Housekeeper actively cleaning                        | Housekeeper                      |
| MAINTENANCE | Temporarily unavailable (repairs, issues)            | Manager / Housekeeper            |

- Status transitions should be validated (e.g., a room cannot go directly from AVAILABLE to CHECKED_OUT).
- Room status changes should emit domain events (`room.updated`, `room.status_changed`) for downstream consumers (housekeeping dashboard, availability engine).

---

## 5. Booking System

### 5.1 Online Booking (Customer)

Flow:

1. Customer selects check-in date, check-out date, and number/type of guests.
2. System displays available rooms matching criteria (availability computed against existing bookings, with concurrency-safe checks to prevent double-booking).
3. Customer selects a room.
4. Customer uploads an identity document (stored securely via Cloudinary).
5. Customer proceeds to payment (Razorpay).
6. On successful payment, booking status becomes **Confirmed**; room status becomes **Booked**.
7. Confirmation notification (email + in-app) is sent.

### 5.2 Offline Booking (Receptionist)

Flow:

1. Receptionist searches for available rooms for requested dates.
2. Receptionist enters guest details (may or may not have a customer account).
3. Receptionist assigns a room.
4. Receptionist collects cash payment (or partial/pay-at-checkout, per configuration) and marks payment as received.
5. Booking status becomes **Confirmed**; invoice is generated.
6. Booking is recorded with `source = OFFLINE` and the creating receptionist attributed for audit purposes.

### 5.3 Booking Lifecycle

```
PENDING_PAYMENT → CONFIRMED → CHECKED_IN → CHECKED_OUT → COMPLETED
        ↓               ↓
    CANCELLED       CANCELLED → REFUND_REQUESTED → REFUND_APPROVED/REJECTED
```

| Status                            | Description                                                    |
| --------------------------------- | -------------------------------------------------------------- |
| PENDING_PAYMENT                   | Online booking initiated, awaiting payment confirmation        |
| CONFIRMED                         | Payment received (online) or recorded (offline); room reserved |
| CHECKED_IN                        | Guest has arrived and been checked in by Receptionist          |
| CHECKED_OUT                       | Guest has completed their stay                                 |
| COMPLETED                         | Stay finished, invoice finalized, eligible for review          |
| CANCELLED                         | Booking cancelled before check-in                              |
| REFUND_REQUESTED                  | Customer requested refund on a cancelled booking               |
| REFUND_APPROVED / REFUND_REJECTED | Manager decision on refund request                             |

- Each transition emits a domain event (`booking.created`, `booking.checked_in`, `booking.checked_out`, `booking.cancelled`).
- Booking creation (online and offline) must be concurrency-safe to prevent two guests being assigned the same room for overlapping dates.

---

## 6. Payment System

### 6.1 Online Payment

- Integrated via Razorpay checkout for online bookings.
- Payment intent created at booking initiation; booking held in `PENDING_PAYMENT` until confirmed.
- Razorpay webhook/callback confirms payment status server-side (not trusted from client alone).
- On confirmed payment: booking → `CONFIRMED`, `payment.completed` event emitted, invoice generation triggered.
- Failed/abandoned payments leave the booking in a cancellable/expirable pending state (auto-expiry after a configured window, releasing the room hold).

### 6.2 Offline Payment

- Receptionist records cash payment against a booking at creation or at check-in/checkout.
- Receptionist confirmation marks the payment record as `PAID` with method `CASH` and the confirming staff member attributed.

### 6.3 Refunds

1. **Customer cancellation before check-in**: Customer initiates cancellation on a `CONFIRMED` (not yet checked-in) booking, which triggers a refund request.
2. **Manager approval**: Refund request appears in the Manager's approval queue with booking/payment context. Manager approves or rejects.
3. **Refund processing**: On approval, refund is processed via Razorpay (for online payments) or logged for manual cash refund workflows (for offline payments), as an asynchronous/queued job. `refund.approved` event emitted; customer notified.

- Refund eligibility rules (e.g., cutoff time before check-in, partial vs. full refund) should be configurable, not hardcoded inline.

---

## 7. Invoice System

- **Invoice generation**: Automatically triggered on booking confirmation (offline) or payment completion (online), and finalized at checkout. Queued as a background job.
- **PDF creation**: Invoices are rendered to PDF, including hotel details, guest details, room/stay details, charges, and payment status.
- **Customer dashboard access**: Customers can view and download invoices for their own bookings.
- **Receptionist access**: Receptionists can view/generate/download invoices for bookings they manage.
- **Download option**: PDF download available from both customer and staff dashboards.
- **Email notification**: Invoice PDF is emailed to the customer automatically upon generation (via Resend, queued).

---

## 8. Notification System

### 8.1 Events Triggering Notifications

- `booking.created`
- `payment.completed`
- `booking.cancelled`
- `refund.approved`
- `booking.checked_in`
- `booking.checked_out`
- `invoice.generated`
- `staff.created`
- `password.reset_requested` / `password.reset_completed`

### 8.2 Channels

- **Email** (via Resend, all events queued through BullMQ — never sent synchronously in the request path).
- **In-app notification** (persisted, shown via a notification bell in staff/customer dashboards, with read/unread state).

### 8.3 Design Notes

- Notification dispatch should be event-driven: domain events are published, and a notification module subscribes and fans out to the appropriate channel(s) per event type and recipient role.
- This keeps notification logic decoupled from booking/payment/room business logic, and allows future channels (SMS, push) to be added without modifying core modules.

---

## 9. Dashboard Requirements

### 9.1 Shared Layout (all staff dashboards)

- Sidebar navigation
- Top navbar
- Breadcrumb
- Notification bell
- Profile menu
- Responsive navigation (collapses appropriately on tablet/mobile)

### 9.2 Customer Dashboard

- Cards: upcoming stay, active booking status.
- Table/list: booking history with filters (status, date range) and search.
- Notifications panel.
- Fully responsive (mobile-first, since most customers will access via phone).

### 9.3 Receptionist Dashboard

- Cards: today's arrivals, today's departures, rooms needing attention.
- Table: all bookings with search/filter (status, date, room type).
- Room status board.
- Quick-action booking creation.
- Responsive for desktop (primary) and tablet (front-desk devices).

### 9.4 Housekeeper Dashboard

- Card/list view of rooms needing cleaning, grouped by urgency.
- Minimal filters (status, floor/location label).
- Large touch targets, mobile/tablet-first design.

### 9.5 Manager Dashboard

- Cards: occupancy rate, revenue summary, pending refund approvals, active staff count.
- Tables: bookings, rooms, staff — each with search, filter, pagination.
- Refund approval queue.
- Audit log viewer (scoped).
- Responsive for desktop (primary), tablet-capable.

### 9.6 Admin Dashboard

- Cards: property-wide KPIs (occupancy, revenue, bookings, cancellations).
- Table: Manager accounts with create/edit/deactivate actions.
- Full audit log viewer.
- Responsive for desktop (primary).

### 9.7 Common Dashboard Behaviors

- Empty states for all tables/lists.
- Skeleton loaders during data fetch; no layout shift.
- Consistent pagination pattern across all tables.
- Debounced search inputs.

---

## 10. Review System

- **Submission**: Customers may submit a review (rating + written feedback) only for bookings in `COMPLETED` status (i.e., after checkout).
- **Display**: Reviews are shown on the relevant room/property listing for prospective customers; average rating aggregated and displayed.
- **Moderation**: Reviews are subject to moderation before public display — Manager (and Admin) can hide/remove reviews that violate content guidelines. A review starts in a `PENDING` or `PUBLISHED` state depending on configured moderation policy (pre- vs. post-moderation), with the ability to flag/unpublish after the fact.
- `review.created` event emitted on submission for downstream consumers (e.g., moderation queue, notifications).

---

## 11. Audit Requirements

### 11.1 Actions to Track

- Login (success and failure) / Logout — all roles.
- Booking changes (creation, status transitions, cancellations).
- Room changes (creation, edits, deletion/deactivation, status changes).
- Staff account creation (and edits/deactivation).
- Refund approvals/rejections.
- Other sensitive actions: password resets, permission-relevant changes, manual payment confirmations.

### 11.2 Audit Log Content

Each entry should capture: actor (user id + role), action type, target entity, timestamp, and relevant before/after context where applicable.

### 11.3 Who Can View Logs

- **Admin**: full, unscoped access to all audit logs.
- **Manager**: access to audit logs scoped to hotel operations (bookings, rooms, staff they manage, refunds) — not Admin-level account provisioning logs.
- No other role has audit log access.

---

## 12. Non-Functional Requirements

### Performance

- Server Components used by default; Client Components only where interactivity requires it.
- Pagination on all list/table views; no unbounded queries.
- Database indexes on frequently queried fields (booking dates, room status, user lookups).
- Redis caching for hot-path reads where beneficial (e.g., room availability lookups).
- Debounced search inputs to avoid excessive requests.

### Security

- Hashed passwords; hashed password-reset and OTP-adjacent tokens.
- OTP expiration and attempt limits.
- Rate limiting on authentication endpoints.
- HTTP-only cookies for session management.
- Input validation and sanitization on every request (Zod, client + server).
- Secure file upload handling (type/size validation) for Cloudinary uploads (room images, ID documents).
- No internal error details or secrets exposed to clients.
- Permission checks enforced through a centralized authorization layer, not scattered role checks.

### Scalability

- Long-running or external-dependent work (emails, OTP delivery, invoice generation, refund processing, notifications) processed asynchronously via BullMQ — never blocking the request/response cycle.
- Domain-event-driven module boundaries so new capabilities (including future AI features) can subscribe to events without modifying existing business logic.

### Maintainability

- Feature-module code organization (API, services, repository, validation, types, constants, events, utilities per module).
- No business logic inside route handlers.
- Reusable components, hooks, utilities, constants, and validation schemas — no duplicated logic.
- Strict TypeScript throughout.

### Accessibility

- Accessible components (proper labeling, keyboard navigation, sufficient contrast) via shadcn/ui primitives.
- Semantic HTML and ARIA attributes where interactive custom components are used.

### Mobile Responsiveness

- All customer-facing and staff-facing surfaces responsive across desktop, tablet, and mobile.
- Housekeeper and Receptionist interfaces prioritized for tablet/mobile usability given on-the-floor usage patterns.

### Error Handling

- Consistent error response format across all API endpoints.
- User-facing error states with retry actions where appropriate, on every async page/action.
- Graceful degradation when non-critical services (e.g., notification dispatch) fail, without blocking core operations (e.g., booking confirmation).

### Loading States

- Route-level `loading.tsx` for all async routes.
- Skeleton loaders for cards, tables, forms, and lists.
- Button-level loading states for all form submissions/actions.
- Optimistic UI only where safe (i.e., where failure is rare and reversible).
- No layout shift during loading transitions.

---

## Document Status

This PRS defines **what** the system must do and the rules governing each domain. It does not prescribe implementation details, file structures, or code — those are governed separately by the Master Instructions and will be addressed in subsequent phase-by-phase implementation planning.

**Awaiting your review and approval before proceeding to the next step (e.g., technical architecture / schema design).**
