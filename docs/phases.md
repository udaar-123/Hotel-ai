# Development Roadmap — Hotel Management System

**Document Version:** 1.0
**Status:** Draft — Pending Approval
**Location:** `/docs/phases.md`
**Depends on:** `/docs/requirements.md`, `/docs/architecture.md`, Master Instructions

---

## How This Roadmap Works

- Phases are executed **strictly in order**. No phase begins until the previous phase is approved.
- Every phase must leave the application in a **fully working state** — no phase may break functionality delivered by an earlier phase.
- Every phase ends with the reporting format defined in the Master Instructions: what was completed, files created/modified, database changes, environment variables added, manual testing checklist, remaining work, and a suggested commit message.
- The 19 recommended phases have been kept, with minor scope clarifications so each phase has a genuinely testable, working output. No phases were added or removed.

---

## Phase 1 — Project Setup & Engineering Foundation

**Objective**
Establish the base Next.js/TypeScript project with all tooling, folder structure, and shared infrastructure scaffolding needed for every later phase, with no business features yet.

**Features Implemented**

- Next.js (App Router) + TypeScript project initialized.
- Tailwind CSS + shadcn/ui installed and configured.
- ESLint + strict TypeScript config.
- Base modular folder structure created (`modules/`, `shared/`, `lib/`, `components/`, `hooks/`) per architecture doc.
- Environment variable structure (`.env.example`) established.
- Base layout, global styles, and design tokens.
- Standardized API response/error format utilities (`shared/errors`).
- Placeholder health-check endpoint (`/api/v1/health`).

**Database Changes**

- None (no schema yet).

**API Changes**

- `GET /api/v1/health` — returns service status, used to confirm the app boots and responds correctly.

**UI Changes**

- Base app shell (root layout, global styles, font/theme setup).
- Placeholder landing page.

**Testing Checklist**

- [ ] App builds and runs locally with no TypeScript/ESLint errors.
- [ ] `/api/v1/health` returns a 200 with the standardized response shape.
- [ ] Folder structure matches architecture document.
- [ ] `.env.example` documents all variables anticipated for later phases (placeholders acceptable).

**Completion Criteria**
Project boots cleanly, lints cleanly, folder structure and response/error conventions are in place and documented, with nothing yet dependent on database, auth, or external services.

---

## Phase 2 — Database Design & Prisma Setup

**Objective**
Translate the conceptual database design from the architecture document into an actual Prisma schema and connect it to PostgreSQL (Neon), without yet exposing it through any feature.

**Features Implemented**

- Prisma installed and configured against Neon PostgreSQL.
- Full schema authored: all entities, relations, enums, and indexes defined in the architecture doc (`User`, `StaffProfile`, `OtpVerification`, `PasswordResetToken`, `RoomType`, `Room`, `RoomImage`, `Booking`, `IdentityDocument`, `Payment`, `Refund`, `Invoice`, `Notification`, `Review`, `AuditLog`).
- Initial migration generated and applied.
- Prisma Client singleton (`lib/prisma.ts`).
- Seed script scaffolding (structure only — Admin seed account is populated in Phase 3 once password hashing exists).

**Database Changes**

- Initial full schema creation (all tables, enums, indexes, relations from architecture doc Section 4).

**API Changes**

- None exposed yet — this phase is schema/infrastructure only.

**UI Changes**

- None.

**Testing Checklist**

- [ ] `prisma migrate` runs cleanly against Neon with no errors.
- [ ] Prisma Client generates without type errors.
- [ ] Schema reviewed against architecture doc for completeness (every entity/enum/relation/index present).
- [ ] Basic connectivity test (a simple script or health-check extension confirms DB read/write works).

**Completion Criteria**
Schema is fully migrated and matches the architecture document; a trivial read/write against the database succeeds; no feature code depends on it yet.

---

## Phase 3 — Authentication System

**Objective**
Implement customer OTP login and staff email/password authentication end-to-end, including session/cookie handling, forgot/reset password, and the Admin seed account.

**Features Implemented**

- Admin seed account creation (via seed script, using real password hashing).
- Customer OTP request + verify flow (OTP queue wired to Resend for delivery).
- Staff email/password login.
- Staff forgot-password and reset-password flow (hashed tokens, emailed reset link).
- Session/cookie issuance, validation, and logout for both customer and staff.
- Rate limiting on all auth endpoints.
- `auth` module fully implemented per architecture doc (route/validation/service/repository/events layers).

**Database Changes**

- No schema changes beyond Phase 2 (tables already exist); this phase begins actively writing to `User`, `OtpVerification`, `PasswordResetToken`.

**API Changes**

- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/staff/login`
- `POST /api/v1/auth/staff/forgot-password`
- `POST /api/v1/auth/staff/reset-password`
- `POST /api/v1/auth/logout`

**UI Changes**

- Customer OTP login screen (enter phone/email → enter code).
- Staff login screen.
- Staff forgot-password and reset-password screens.
- Basic authenticated/unauthenticated route redirection.

**Testing Checklist**

- [ ] Customer can request and verify an OTP and receive a session.
- [ ] Invalid/expired OTP is rejected; attempt limits enforced.
- [ ] Staff can log in with correct credentials; incorrect credentials rejected generically.
- [ ] Forgot-password email is delivered (via queue) with a working, single-use, expiring link.
- [ ] Password reset invalidates existing sessions.
- [ ] Logout invalidates the session/cookie.
- [ ] Rate limits trigger correctly under repeated attempts.

**Completion Criteria**
Both customer and staff can authenticate, maintain a session, and recover access via forgot/reset password, with all flows queue-backed and security controls (hashing, rate limiting, expiry) verified.

---

## Phase 4 — RBAC & Permissions

**Objective**
Implement the centralized authorization layer (permission registry, `authorize()` utility, and middleware) so every subsequent feature phase can enforce access control consistently from the start.

**Features Implemented**

- Permission registry mapping roles → permissions (per architecture doc Section 6).
- `shared/authorization` module with the central `authorize()` utility.
- Route-group-level middleware enforcing coarse-grained role access (`/​(staff)/​*`, `/​(staff)/​admin/​*`, `/​(customer)/​*`).
- Standardized `ForbiddenError` → 403 response handling.
- Retrofitting: Phase 3's auth endpoints reviewed to ensure role-aware behavior is consistent with this new layer.

**Database Changes**

- None (permissions are code-defined, not data-driven, per the fixed-role design).

**API Changes**

- No new business endpoints; existing endpoints (health, auth) reviewed/wrapped with the authorization layer where applicable.

**UI Changes**

- Route protection: unauthorized users redirected appropriately (login vs. 403 page) based on role/route mismatch.

**Testing Checklist**

- [ ] Unauthenticated requests to protected routes return 401.
- [ ] Authenticated but under-permissioned requests return 403.
- [ ] Each role can access only the route groups intended for it.
- [ ] `authorize()` utility unit-tested for each permission/role combination defined so far.
- [ ] No direct role-string checks exist outside `shared/authorization`.

**Completion Criteria**
A fully working, centrally enforced permission system exists and is verified against all five roles, ready to be used by every feature module built from this point forward.

---

## Phase 5 — User Management

**Objective**
Implement the staff hierarchy creation flow (Admin → Manager → Receptionist/Housekeeper) and profile management for all roles.

**Features Implemented**

- Admin can create/edit/deactivate Manager accounts.
- Manager can create/edit/deactivate Receptionist and Housekeeper accounts.
- Temporary password generation + credential email delivery (via queue) on staff creation.
- Mandatory password change on first staff login (`mustChangePassword` flag enforced).
- Customer and staff profile view/edit.
- `users` module fully implemented (service/repository/validation/events).
- `staff.created` / `staff.deactivated` events published and available for later audit/notification subscribers.

**Database Changes**

- Active use of `StaffProfile.mustChangePassword` and `deactivatedAt` fields (already in schema from Phase 2).

**API Changes**

- `POST /api/v1/users/staff` (create staff, role-scoped by creator's permissions)
- `GET /api/v1/users/staff` (list, scoped)
- `PATCH /api/v1/users/staff/:id` (edit/deactivate)
- `GET /api/v1/users/me` / `PATCH /api/v1/users/me` (profile)

**UI Changes**

- Admin: Manager management table + create/edit dialogs.
- Manager: Receptionist/Housekeeper management table + create/edit dialogs.
- Profile page for all roles.
- Forced password-change screen on first staff login.

**Testing Checklist**

- [ ] Admin can create a Manager; Manager cannot create another Manager.
- [ ] Manager can create Receptionist/Housekeeper; Receptionist/Housekeeper cannot create staff.
- [ ] New staff receive credential email and are forced to change password on first login.
- [ ] Deactivated staff cannot log in.
- [ ] Profile updates persist correctly and are validated (Zod, both sides).
- [ ] Creation respects RBAC from Phase 4 (403 for unauthorized attempts).

**Completion Criteria**
The full staff hierarchy can be provisioned exactly per the Master Instructions' chain of command, with working credential delivery, forced password change, and profile management for every role.

---

## Phase 6 — Room Management

**Objective**
Implement room type and room CRUD, image upload via Cloudinary, and the room status lifecycle.

**Features Implemented**

- Room type configuration (Manager-editable reference data).
- Room CRUD (Manager only), including price override, active/inactive flag.
- Cloudinary signed upload integration for room images; primary image selection.
- Room status lifecycle implementation with validated transitions (`AVAILABLE → BOOKED → OCCUPIED → CHECKED_OUT → CLEANING → AVAILABLE`, plus `MAINTENANCE`).
- `rooms` module fully implemented; `room.created` / `room.updated` / `room.status_changed` / `room.deleted` events published.

**Database Changes**

- Active use of `RoomType`, `Room`, `RoomImage` tables (already in schema).

**API Changes**

- `POST /api/v1/rooms/types`, `GET /api/v1/rooms/types`, `PATCH /api/v1/rooms/types/:id`
- `POST /api/v1/rooms`, `GET /api/v1/rooms`, `GET /api/v1/rooms/:id`, `PATCH /api/v1/rooms/:id`, `DELETE /api/v1/rooms/:id` (soft delete)
- `POST /api/v1/rooms/:id/images`, `DELETE /api/v1/rooms/:id/images/:imageId`
- `PATCH /api/v1/rooms/:id/status`

**UI Changes**

- Manager: room type management, room list/table with filters, room create/edit forms, image upload UI.
- Room status board (foundational version — full board polish happens in Phase 12/13).

**Testing Checklist**

- [ ] Room and room type CRUD works with correct validation and RBAC (Manager-only).
- [ ] Room deletion blocked if active/future bookings exist (rule stubbed/tested even though bookings don't exist until Phase 7 — verify the guard logic independently).
- [ ] Image upload/delete works and stays in sync with Cloudinary (no orphaned assets after delete).
- [ ] Status transitions enforce the valid lifecycle graph; invalid transitions rejected.
- [ ] Events (`room.*`) fire correctly and are observable (e.g., via logging) even though no subscriber consumes them yet.

**Completion Criteria**
Managers can fully manage room inventory, types, images, and status; the room status lifecycle is enforced; the module is ready to be consumed by the booking system.

---

## Phase 7 — Customer Booking System (Online)

**Objective**
Implement the full customer-facing online booking flow up through booking confirmation (payment integration itself is completed in Phase 9 — this phase wires the booking flow with a payment-pending state and a stubbed/minimal payment confirmation path so the flow is testable end-to-end).

**Features Implemented**

- Availability search (dates, guests, room type) with concurrency-safe overlap checking.
- Booking creation flow: date/guest selection → room selection → identity document upload (Cloudinary) → booking placed in `PENDING_PAYMENT`.
- Booking lifecycle state machine implemented in the `bookings` module (all statuses from architecture doc).
- Customer booking history and detail views.
- Cancellation entry point for customers (pre-check-in), transitioning `CONFIRMED → CANCELLED` (refund workflow itself arrives in Phase 9).
- `booking.created`, `booking.confirmed`, `booking.cancelled` events published.

**Database Changes**

- Active use of `Booking`, `IdentityDocument` tables.

**API Changes**

- `GET /api/v1/rooms/availability`
- `POST /api/v1/bookings` (online, customer-initiated)
- `GET /api/v1/bookings` (customer's own bookings)
- `GET /api/v1/bookings/:id`
- `POST /api/v1/bookings/:id/cancel`
- `POST /api/v1/bookings/:id/identity-document`

**UI Changes**

- Room browsing/availability search UI.
- Booking creation flow (multi-step: dates → room → identity doc → review).
- Customer booking history/detail pages.
- Cancellation UI.

**Testing Checklist**

- [ ] Availability search correctly excludes rooms with overlapping confirmed bookings.
- [ ] Concurrent booking attempts for the same room/dates cannot both succeed (concurrency test).
- [ ] Identity document upload validated (type/size) and securely stored.
- [ ] Booking lifecycle transitions match the defined state machine; invalid transitions rejected.
- [ ] Customer can view and cancel only their own bookings (authorization scoping verified).
- [ ] Events fire correctly for create/confirm/cancel.

**Completion Criteria**
A customer can search availability, create an online booking with an uploaded ID document, and see it through to a payment-pending/confirmed state without double-booking risk; cancellation works pre-check-in.

---

## Phase 8 — Offline Receptionist Booking

**Objective**
Implement the Receptionist-facing walk-in booking flow, including cash payment recording and room assignment, reusing the booking engine built in Phase 7.

**Features Implemented**

- Receptionist booking creation UI/flow (guest details, room assignment, cash payment recording).
- Booking `source = OFFLINE` attribution to the creating Receptionist.
- Check-in / check-out actions performed by Receptionist, updating both `Booking` and `Room` status together (transactional).
- Receptionist booking list/search/filter (property-wide, per architecture).

**Database Changes**

- No schema changes; active use of `Booking.source`, `Booking.createdByStaffId`, `Payment` (cash path) fields already modeled.

**API Changes**

- `POST /api/v1/bookings/offline`
- `POST /api/v1/bookings/:id/check-in`
- `POST /api/v1/bookings/:id/check-out`
- `GET /api/v1/bookings` (staff-scoped list with filters/search, extending the customer-scoped version from Phase 7)

**UI Changes**

- Receptionist quick-booking creation form.
- Receptionist booking list with search/filter.
- Check-in/check-out action controls.

**Testing Checklist**

- [ ] Receptionist can create an offline booking with room assignment and cash payment recorded.
- [ ] Check-in/check-out transitions update both booking and room status atomically.
- [ ] Offline bookings correctly attributed (`source`, `createdByStaffId`) for later audit.
- [ ] Receptionist cannot perform Manager-only actions (RBAC boundary check).
- [ ] Previous (Phase 7) online booking flow still works unmodified (regression check).

**Completion Criteria**
Receptionists can fully manage walk-in bookings end-to-end (create, assign, collect cash, check in/out) without affecting the online booking flow.

---

## Phase 9 — Payment Integration

**Objective**
Fully wire Razorpay for online payments and implement the complete refund workflow (request → Manager approval → processing), replacing the payment-pending stub from Phase 7.

**Features Implemented**

- Razorpay checkout integration for online bookings (`PENDING_PAYMENT → CONFIRMED` on verified payment).
- Razorpay webhook handler with signature verification (server-side payment confirmation, never trusted from client).
- Payment failure/timeout handling with room-hold expiry.
- Refund request flow (customer-initiated on eligible cancellations).
- Manager refund approval/rejection queue and actions.
- Refund processing via Refund Queue (Razorpay refund API for online payments; logged manual workflow for cash).
- `payment.completed`, `payment.failed`, `refund.requested`, `refund.approved`, `refund.rejected`, `refund.processed` events published.

**Database Changes**

- Active use of `Payment` and `Refund` tables in full (status transitions, provider references).

**API Changes**

- `POST /api/v1/payments/razorpay/order` (create payment intent for a booking)
- `POST /api/v1/payments/razorpay/webhook`
- `POST /api/v1/refunds` (customer request)
- `GET /api/v1/refunds` (Manager queue)
- `PATCH /api/v1/refunds/:id` (approve/reject)

**UI Changes**

- Razorpay checkout embed/redirect on booking payment step.
- Payment status feedback (success/failure) on the customer booking flow.
- Manager refund approval queue UI.
- Customer refund status visibility on booking detail page.

**Testing Checklist**

- [ ] Successful Razorpay payment correctly confirms the booking and updates room status.
- [ ] Webhook signature verification rejects tampered/unauthenticated payloads.
- [ ] Failed/abandoned payment expires the room hold and does not leave a false-confirmed booking.
- [ ] Refund request → Manager approval → Razorpay refund executes correctly (test-mode).
- [ ] Cash-booking refund path logs correctly for manual processing.
- [ ] All payment/refund actions are queue-backed (no external calls block the request path).
- [ ] Regression: Phases 7 and 8 booking flows remain fully functional.

**Completion Criteria**
Online payments and the full refund lifecycle (request, approval, processing) work end-to-end and are verifiably decoupled from the request/response cycle via queues.

---

## Phase 10 — Invoice System

**Objective**
Implement automatic invoice generation, PDF creation, and access/download for both customers and staff.

**Features Implemented**

- Invoice record creation triggered on booking confirmation (offline) / payment completion (online) and finalized at checkout.
- PDF generation via the Invoice Queue (idempotent — no duplicate invoices on retry).
- Invoice email delivery to the customer (via Resend, queued).
- Customer invoice view/download (own bookings only).
- Receptionist invoice view/download/generate (bookings they manage).
- `invoice.generated` event published.

**Database Changes**

- Active use of `Invoice` table (PDF reference, totals, status).

**API Changes**

- `GET /api/v1/invoices/:bookingId`
- `GET /api/v1/invoices/:bookingId/download`
- `POST /api/v1/invoices/:bookingId/generate` (Receptionist manual trigger/regeneration if needed)

**UI Changes**

- Invoice view/download buttons on customer booking detail page.
- Invoice view/download/generate controls on Receptionist booking detail page.

**Testing Checklist**

- [ ] Invoice auto-generates at the correct lifecycle point (confirmation/checkout) with accurate charges.
- [ ] PDF renders correctly with all required details (hotel, guest, stay, charges, payment status).
- [ ] Retry of the invoice job does not create duplicate invoices (idempotency verified).
- [ ] Invoice email delivered via queue.
- [ ] Access control: customer sees only their own invoices; Receptionist sees invoices for bookings they manage.
- [ ] Download works for both roles.

**Completion Criteria**
Invoices are generated automatically and correctly at the right lifecycle points, downloadable by the right roles, and emailed without blocking the booking/payment flow.

---

## Phase 11 — Notification System

**Objective**
Implement the event-driven notification system (email + in-app) covering all events defined in the PRS, replacing any ad hoc notification calls made informally in earlier phases.

**Features Implemented**

- `notifications` module fully implemented: subscribes to all relevant domain events (`booking.*`, `payment.completed`, `refund.approved`, `invoice.generated`, `staff.created`, `password.reset_*`, etc.).
- In-app notification persistence + read/unread state.
- Notification bell UI component (shared across all dashboards).
- Consolidation pass: any direct/ad hoc email sends from earlier phases (e.g., Phase 5 staff credentials, Phase 3 password reset) are confirmed to route through this same event-driven notification path for consistency.

**Database Changes**

- Active use of `Notification` table.

**API Changes**

- `GET /api/v1/notifications` (current user, paginated)
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`

**UI Changes**

- Notification bell + dropdown/panel in the shared dashboard layout (all roles).
- Unread badge count.

**Testing Checklist**

- [ ] Every event in the PRS's Section 8 list produces the correct notification(s) on the correct channel(s).
- [ ] In-app notifications appear for the correct recipient only.
- [ ] Read/unread state updates correctly and persists.
- [ ] Email notifications are queue-backed and do not duplicate on retry.
- [ ] Regression: earlier phases' direct email flows (Phase 3, Phase 5) still function after being routed through this module.

**Completion Criteria**
All PRS-defined events reliably produce both email and in-app notifications through a single, decoupled, event-driven mechanism.

---

## Phase 12 — Housekeeping Module

**Objective**
Build the Housekeeper-facing experience: task list and room status update controls, completing the room status lifecycle's operational side.

**Features Implemented**

- Housekeeper task list: rooms in `CHECKED_OUT`/`CLEANING`/`MAINTENANCE` needing attention, grouped by urgency.
- Status update controls (`CHECKED_OUT → CLEANING → AVAILABLE`, and flagging `MAINTENANCE`).
- Minimal, mobile/tablet-first UI per PRS Section 2.4 and 9.4.
- Reuses `rooms` module status-transition logic from Phase 6 — no duplicated status logic.

**Database Changes**

- None (uses existing `Room.status` and related fields).

**API Changes**

- `GET /api/v1/rooms/housekeeping-queue` (Housekeeper-scoped view)
- Reuses `PATCH /api/v1/rooms/:id/status` from Phase 6 (with Housekeeper-permitted transitions added to the permission registry).

**UI Changes**

- Housekeeper dashboard: task list/cards, large touch-target status controls.

**Testing Checklist**

- [ ] Housekeeper sees only rooms needing attention, correctly grouped/prioritized.
- [ ] Status updates persist and are reflected immediately in Receptionist/Manager room views.
- [ ] Housekeeper cannot access financial/guest-personal data (authorization boundary check).
- [ ] UI verified usable on tablet/mobile viewport sizes.
- [ ] Regression: Phase 6/8 room and check-out flows remain correct.

**Completion Criteria**
Housekeepers have a focused, working interface to manage room readiness, fully integrated with the existing room status lifecycle with no duplicated logic.

---

## Phase 13 — Dashboard Development

**Objective**
Build out the full dashboard experience for every role (cards, tables, filters, search, responsive layout) per PRS Section 9, consolidating and polishing the partial dashboards introduced incidentally in earlier phases.

**Features Implemented**

- Shared dashboard layout finalized (sidebar, navbar, breadcrumb, notification bell, profile menu — responsive).
- Customer dashboard: upcoming/past bookings cards + table, filters, search.
- Receptionist dashboard: today's arrivals/departures, room status board, booking table with filters/search, quick-action booking creation.
- Manager dashboard: occupancy/revenue cards, refund approval queue, bookings/rooms/staff tables with search/filter/pagination.
- Admin dashboard: property-wide KPIs, Manager account table.
- `dashboard` module aggregation/read-model queries implemented (read-only composition across modules' repositories/services).
- Skeleton loaders, empty states, and error/retry states finalized across all dashboard surfaces.

**Database Changes**

- None expected (may add supporting indexes if aggregation queries reveal performance needs — documented if so).

**API Changes**

- `GET /api/v1/dashboard/customer`
- `GET /api/v1/dashboard/receptionist`
- `GET /api/v1/dashboard/manager`
- `GET /api/v1/dashboard/admin`
  (Each aggregates data from existing module services — no new business logic introduced.)

**UI Changes**

- Full dashboard build-out for all five roles per PRS Section 9, including responsive behavior across desktop/tablet/mobile.

**Testing Checklist**

- [ ] Every role's dashboard renders correct, correctly-scoped data.
- [ ] Search, filter, and pagination work consistently across all tables.
- [ ] Skeleton loaders appear during fetch; no layout shift.
- [ ] Empty and error states verified for each widget.
- [ ] Responsive behavior verified at desktop, tablet, and mobile breakpoints for every role.
- [ ] Regression: no earlier-phase feature access is broken by dashboard consolidation.

**Completion Criteria**
Every role has a complete, responsive, production-quality dashboard consistent with the shared layout system and PRS requirements.

---

## Phase 14 — Review System

**Objective**
Implement post-checkout customer reviews with moderation support for Manager/Admin.

**Features Implemented**

- Review submission eligibility check (`Booking.status === COMPLETED`, one review per booking).
- Review display on room/property listings with aggregated rating.
- Moderation workflow (Manager/Admin can hide/unpublish; configurable pre/post-moderation policy per architecture doc).
- `review.created` / `review.moderated` events published (feeding notifications and, later, potential AI summarization).

**Database Changes**

- Active use of `Review` table (already in schema).

**API Changes**

- `POST /api/v1/reviews` (customer, eligible bookings only)
- `GET /api/v1/reviews` (public, published only)
- `GET /api/v1/reviews/moderation-queue` (Manager/Admin)
- `PATCH /api/v1/reviews/:id/moderate`

**UI Changes**

- Review submission form on completed bookings (customer).
- Review display on room/property browsing pages.
- Moderation queue UI (Manager/Admin).

**Testing Checklist**

- [ ] Review submission blocked for non-completed bookings and duplicate reviews.
- [ ] Reviews display correctly with accurate aggregated ratings.
- [ ] Moderation actions (hide/publish) work and immediately affect public display.
- [ ] Only Manager/Admin can access the moderation queue (RBAC check).
- [ ] Notifications fire appropriately (e.g., to Manager on new review, if configured).

**Completion Criteria**
Customers can leave reviews only for eligible completed stays, and Managers/Admins can moderate content before or after it's publicly visible, per the configured policy.

---

## Phase 15 — Audit Logging

**Objective**
Implement the `audit` module fully: subscribing to all sensitive events defined in the PRS and exposing scoped log viewing for Admin and Manager.

**Features Implemented**

- `audit` module event subscribers wired to every sensitive event identified in PRS Section 11 (login/logout, booking changes, room changes, staff creation, refund approval, password resets, etc.) — retrofitted across all prior phases' event emissions.
- Append-only `AuditLog` writes (no update/delete exposed).
- Scoped log viewer: Admin sees all logs; Manager sees hotel-operations-scoped logs only.
- Search/filter on audit logs (actor, action type, date range).

**Database Changes**

- Active, comprehensive use of `AuditLog` table (already in schema).

**API Changes**

- `GET /api/v1/audit` (scoped by requester's role — Admin: all, Manager: scoped subset)

**UI Changes**

- Audit log viewer in Admin and Manager dashboards, with search/filter and pagination.

**Testing Checklist**

- [ ] Every sensitive action defined in the PRS produces a corresponding audit log entry — verified action by action against the PRS Section 11 list.
- [ ] Audit logs are immutable (no update/delete path exists at the API layer).
- [ ] Manager's log view is correctly scoped (cannot see Admin-only account-provisioning logs).
- [ ] Search/filter/pagination work correctly on the audit viewer.
- [ ] No regression to any module whose events are now also captured by audit subscribers.

**Completion Criteria**
A complete, verified, append-only audit trail exists across every sensitive action in the system, viewable by Admin (full) and Manager (scoped).

---

## Phase 16 — Reports

**Objective**
Build reporting/analytics views on top of existing data (occupancy, revenue, bookings, cancellations, refunds) for Manager and Admin, without introducing new core entities.

**Features Implemented**

- Occupancy rate reporting (by date range).
- Revenue reporting (by date range, payment method, room type).
- Booking/cancellation/refund summary reporting.
- Exportable report views (e.g., CSV export) where useful for Manager/Admin.
- Reports built as read-only aggregation logic in the `dashboard` module (or a closely related `reports` extension), consistent with the architecture's "read models compose from existing repositories" principle — no duplicated business logic.

**Database Changes**

- None expected; may add read-optimized indexes if reporting queries reveal a need (documented if so).

**API Changes**

- `GET /api/v1/reports/occupancy`
- `GET /api/v1/reports/revenue`
- `GET /api/v1/reports/bookings-summary`

**UI Changes**

- Reporting section in Manager/Admin dashboards with date-range filters and (where applicable) export controls.

**Testing Checklist**

- [ ] Reports produce figures that reconcile against underlying booking/payment/refund data for known test scenarios.
- [ ] Date-range filtering works correctly across report types.
- [ ] Export (if implemented) produces correctly formatted files.
- [ ] Access restricted to Manager/Admin.
- [ ] No performance regression on core booking/payment flows from reporting query load (validated informally here; formal tuning happens in Phase 17).

**Completion Criteria**
Manager and Admin have accurate, correctly-scoped reporting views built entirely from existing data, with no new core business logic introduced.

---

## Phase 17 — Performance Optimization

**Objective**
Systematically review and optimize performance across the application now that all features exist, without changing functional behavior.

**Features Implemented**

- Database query audit: confirm all indexes from the architecture doc are in place and effective (`EXPLAIN ANALYZE` review on hot paths — availability search, dashboard aggregations, audit/report queries).
- Redis caching applied to appropriate hot-path reads (e.g., room availability, room type/reference data).
- Review of Server vs. Client Component boundaries to minimize unnecessary client-side JS.
- Image optimization review (Cloudinary transformation usage, Next.js image handling).
- Pagination audit across all list/table endpoints (no unbounded queries remain).
- Debounced search audit across all search inputs.
- BullMQ queue/worker concurrency and backoff settings reviewed and tuned.

**Database Changes**

- Potential addition of missing indexes identified during the audit (documented explicitly, migration-tracked).

**API Changes**

- No functional changes; potential response shape/caching-header additions where relevant, documented if introduced.

**UI Changes**

- No functional changes; possible loading/perceived-performance improvements (e.g., additional skeleton refinement).

**Testing Checklist**

- [ ] Key hot-path queries reviewed and confirmed to use appropriate indexes.
- [ ] Caching introduced does not serve stale data in ways that break correctness (e.g., availability cache invalidated correctly on booking changes).
- [ ] No unbounded (unpaginated) queries remain anywhere in the app.
- [ ] Full regression pass across all prior phases to confirm no functional behavior changed.
- [ ] Load/latency spot-checks on the highest-traffic flows (availability search, dashboard loads).

**Completion Criteria**
The application's performance characteristics are reviewed and tuned against the architecture's performance requirements, with zero functional regressions.

---

## Phase 18 — Security Review

**Objective**
Conduct a full security pass across authentication, authorization, API, upload, and database layers against the architecture document's Security Architecture (Section 11), before deployment.

**Features Implemented**

- Full review/verification of: password hashing, OTP/token hashing, rate limiting coverage, session/cookie flags, CSRF mitigations, Razorpay webhook signature verification.
- Full review/verification of: centralized `authorize()` usage (no ad hoc role checks anywhere), fine-grained resource-scoped checks on every sensitive endpoint.
- Full review/verification of: input validation coverage on every `/api/v1/*` endpoint, standardized error responses with no internal detail leakage.
- Full review/verification of: signed Cloudinary uploads, server-side file validation, restricted access mode for identity documents.
- Full review/verification of: Prisma-only data access (no raw SQL outside justified/reviewed cases), least-privilege DB credentials, sensitive fields excluded from API responses via explicit selects/DTOs.
- Fixes applied for any gaps found, each documented.

**Database Changes**

- None expected, unless a gap requires a schema-level fix (documented explicitly if so).

**API Changes**

- Only as needed to close identified gaps (documented explicitly).

**UI Changes**

- Only as needed to close identified gaps (documented explicitly).

**Testing Checklist**

- [ ] Section-by-section checklist against architecture doc Section 11 completed with sign-off on each item.
- [ ] Penetration-style manual checks: attempt cross-role access, attempt to bypass authorization on sensitive endpoints, attempt to tamper with webhook payloads, attempt oversized/invalid file uploads.
- [ ] Confirm no secrets/stack traces are ever returned in API responses (spot-check across error paths).
- [ ] Confirm audit logging (Phase 15) captures all security-relevant test actions performed during this review.
- [ ] Full regression pass to confirm no functionality broke as a result of security fixes.

**Completion Criteria**
Every item in the architecture document's Security Architecture section has been explicitly verified or remediated, with no known open gaps before deployment.

---

## Phase 19 — Deployment Preparation

**Objective**
Prepare the fully built, optimized, and security-reviewed application for production deployment on Vercel (application) with Neon (database) and associated third-party services.

**Features Implemented**

- Production environment variable configuration finalized and documented (Vercel, Neon, Redis, Resend, Razorpay, Cloudinary — production keys/domains, not sandbox).
- Production build verification (no dev-only code paths, no sandbox email sender in production config).
- BullMQ worker deployment/runtime strategy finalized (how workers run in production — e.g., dedicated worker process/service).
- Database migration strategy for production (safe migration application process).
- Monitoring/error-tracking hook points identified (even if a specific tool isn't mandated here, the integration points are documented).
- Final full regression pass across all 18 prior phases in a production-like (staging) environment.
- Rollback plan documented.

**Database Changes**

- None beyond applying the final, already-reviewed migration set to the production database.

**API Changes**

- None (deployment-only phase); production-mode configuration only (e.g., disabling verbose error output, if not already fully handled in Phase 18).

**UI Changes**

- None functional; production build/asset optimization only.

**Testing Checklist**

- [ ] Full manual regression checklist executed against a staging environment matching production configuration.
- [ ] All third-party integrations (Resend domain, Razorpay live/test mode, Cloudinary, Neon) verified against production credentials in staging first.
- [ ] BullMQ workers confirmed running and processing jobs correctly in the production-like environment.
- [ ] Rollback procedure tested or at minimum fully documented and reviewed.
- [ ] Environment variable completeness double-checked against `.env.example` from Phase 1.

**Completion Criteria**
The application is verified, staged, and ready for production go-live, with all integrations confirmed against production-equivalent configuration and a documented rollback plan in place.

---

## Cross-Phase Rules (Apply to Every Phase Above)

- No phase is started without prior phase approval.
- No phase may be marked complete with outstanding TypeScript/ESLint errors, dead code, or duplicated logic, per the Master Instructions' phase-completion checklist.
- Every phase that touches an async operation must include the required loading/empty/error states — this is not deferred to Phase 13; each phase implements it for its own surfaces as it goes, and Phase 13 consolidates/polishes.
- Every phase that introduces a new domain event must confirm (from Phase 11/15 onward) that notification and audit subscribers are updated accordingly — this is explicitly checked from Phase 11 onward and finalized in Phase 15.
- Regression verification against all previously completed phases is a mandatory part of every phase's testing checklist from Phase 8 onward (once there is meaningful cross-phase surface area to regress).

---

## Document Status

This roadmap sequences the full build from empty repository to deployment-ready application across 19 phases, each independently working, testable, and non-breaking with respect to prior phases.

**Awaiting your approval before Phase 1 implementation begins.**
