# System Architecture — Hotel Management System

**Document Version:** 1.0
**Status:** Draft — Pending Approval
**Location:** `/docs/architecture.md`
**Depends on:** `/docs/requirements.md`, Master Instructions

---

## 1. High Level Architecture

```
                         ┌────────────────────────┐
                         │        Browser          │
                         │  Customer / Staff UI     │
                         └───────────┬─────────────┘
                                     │ HTTPS
                                     ▼
                    ┌───────────────────────────────┐
                    │        Next.js (App Router)     │
                    │  Server Components / Client     │
                    │  Route Handlers (/api/v1/*)     │
                    └───────────┬─────────────┬───────┘
                                │             │
                 ┌──────────────┘             └───────────────┐
                 ▼                                             ▼
      ┌─────────────────────┐                      ┌───────────────────────┐
      │   PostgreSQL (Neon)   │                      │   Redis (cache +       │
      │   via Prisma ORM      │                      │   BullMQ job store)    │
      └─────────────────────┘                      └───────────┬───────────┘
                                                                 │
                                                     ┌───────────▼────────────┐
                                                     │     BullMQ Workers       │
                                                     │  Email / OTP / Invoice /  │
                                                     │  Refund / Notification    │
                                                     └───────────┬────────────┘
                                                                 │
                    ┌────────────────────────────────────────────┼─────────────────┐
                    ▼                                            ▼                 ▼
          ┌─────────────────┐                        ┌──────────────────┐  ┌──────────────┐
          │  Resend (Email)   │                        │  Razorpay (Pay)    │  │  Cloudinary    │
          └─────────────────┘                        └──────────────────┘  │  (Files)       │
                                                                              └──────────────┘
```

### Frontend

- **Next.js App Router** with **React + TypeScript**, styled with **Tailwind CSS** and **shadcn/ui**.
- **Server Components by default**; Client Components only for interactivity (forms, dialogs, real-time widgets).
- Form state and validation via **React Hook Form + Zod**, with the same Zod schemas reused for server-side validation (single source of truth for validation rules).
- Route-level `loading.tsx` and `error.tsx` for every async route, per the Master Instructions.

### Backend

- **Next.js Route Handlers** under `/api/v1/` act as the HTTP boundary only — they parse, validate, delegate to services, and format responses. No business logic lives here.
- Backend logic organized into **feature modules** (see Section 2), each with its own service/repository/validation layers.

### Database

- **PostgreSQL**, hosted on **Neon**, accessed exclusively through **Prisma ORM**.
- Prisma is the single data-access layer — no raw SQL except for narrowly justified, reviewed performance cases (e.g., row-locking queries for booking concurrency), which are isolated inside the repository layer.

### Queue System

- **Redis** backs **BullMQ**, which handles all asynchronous/background work: email/OTP delivery, invoice generation, refund processing, and notification fan-out.
- Redis is also used as a **cache** for hot-path reads (e.g., room availability lookups), separate from its role as the BullMQ backing store (logically separated via key prefixes/namespaces).

### Storage

- **Cloudinary** handles all file storage: room images and customer identity documents.
- The application never stores binary file data itself — only Cloudinary URLs/public IDs and metadata in Postgres.

### Email System

- **Resend** is the email delivery provider, invoked **only from BullMQ workers**, never synchronously inside a request/response cycle.

### Payment System

- **Razorpay** handles online payment collection and refund issuance.
- Payment confirmation is **never trusted from the client** — it is confirmed server-side via Razorpay webhook/callback verification before a booking is marked `CONFIRMED`.

---

## 2. Application Structure

```
src/
├── app/                          # Next.js App Router (routes, layouts, pages only)
│   ├── (customer)/               # Customer-facing route group
│   ├── (staff)/                  # Staff dashboard route group (Receptionist, Housekeeper, Manager, Admin)
│   ├── api/
│   │   └── v1/
│   │       ├── auth/
│   │       ├── users/
│   │       ├── rooms/
│   │       ├── bookings/
│   │       ├── payments/
│   │       ├── refunds/
│   │       ├── invoices/
│   │       ├── notifications/
│   │       ├── reviews/
│   │       └── audit/
│   └── layout.tsx / loading.tsx / error.tsx (per route segment)
│
├── modules/                      # Core business logic (framework-agnostic where possible)
│   ├── auth/
│   ├── users/                    # Staff + customer account records, profile mgmt
│   ├── rooms/
│   ├── bookings/
│   ├── payments/
│   ├── refunds/
│   ├── invoices/
│   ├── notifications/
│   ├── reviews/
│   ├── audit/
│   └── dashboard/                # Aggregation/read-model logic for dashboard widgets
│
├── shared/
│   ├── authorization/            # Centralized RBAC/permission engine (Section 6)
│   ├── events/                   # Event bus, event type registry (Section 7)
│   ├── queues/                   # BullMQ queue definitions + worker registration (Section 8)
│   ├── validation/                # Shared Zod primitives/utilities
│   ├── errors/                    # Standardized error classes + API error formatting
│   ├── constants/
│   ├── types/
│   └── utils/
│
├── lib/                          # Third-party client singletons
│   ├── prisma.ts
│   ├── redis.ts
│   ├── cloudinary.ts
│   ├── resend.ts
│   └── razorpay.ts
│
├── components/                   # Shared/reusable UI (shadcn-based)
│   ├── ui/                        # shadcn primitives
│   ├── forms/
│   ├── tables/
│   └── layout/                    # Sidebar, Navbar, Breadcrumb, etc.
│
└── hooks/                        # Shared reusable React hooks
```

### Module Responsibilities

Each module under `modules/<name>/` follows the same internal shape:

```
modules/<name>/
├── api/            # Thin handlers called by app/api/v1/<name> route files
├── service.ts      # Business logic / orchestration
├── repository.ts   # All Prisma queries for this module's entities
├── validation.ts   # Zod schemas (request + form validation)
├── types.ts        # TypeScript types/interfaces
├── constants.ts    # Enums, fixed values
├── events.ts       # Domain events this module publishes
└── utils.ts        # Module-local helpers
```

| Module            | Responsibility                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **auth**          | OTP issuance/verification, staff login, password reset/forgot-password, session/cookie issuance and invalidation.                                      |
| **users**         | Staff and customer account records, role assignment, profile data, staff creation flow (temp password generation).                                     |
| **rooms**         | Room types, room CRUD, room status lifecycle, Cloudinary image association.                                                                            |
| **bookings**      | Booking creation (online/offline), availability computation, booking lifecycle transitions, concurrency-safe room holds.                               |
| **payments**      | Razorpay payment intent creation, webhook verification, cash payment recording, payment status tracking.                                               |
| **refunds**       | Refund request creation, Manager approval workflow, refund execution orchestration (delegates actual money movement to payments module / Razorpay).    |
| **invoices**      | Invoice record creation, PDF generation orchestration, retrieval for customer/staff.                                                                   |
| **notifications** | Subscribes to domain events, fans out to email (via queue) and in-app notification records; in-app notification read/unread state.                     |
| **reviews**       | Review submission eligibility checks, storage, moderation state, aggregation for display.                                                              |
| **audit**         | Subscribes to sensitive domain events, writes immutable audit log entries, exposes scoped read access.                                                 |
| **dashboard**     | Read-only aggregation/query logic that composes data from other modules' repositories for dashboard cards/tables (does not own its own core entities). |

**Rule:** Modules communicate with each other primarily through **domain events** (Section 7) rather than direct cross-module service calls, except where a direct synchronous read is unavoidable (e.g., bookings module checking room availability from the rooms module). Direct cross-module calls, when necessary, go through the other module's `service.ts` — never reach into another module's `repository.ts` directly.

---

## 3. Backend Architecture

### Layers

| Layer                | Responsibility                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Route Layer**      | Next.js Route Handler. Parses request, calls validation, calls the module's service, formats the HTTP response. No business logic.                                                        |
| **Validation Layer** | Zod schemas validate and parse incoming request data (body/query/params) before it reaches the service. Rejects invalid input with a standardized error response.                         |
| **Service Layer**    | Orchestrates business logic: enforces business rules, coordinates repository calls, triggers events, calls other modules' services when needed. This is where "what should happen" lives. |
| **Repository Layer** | Owns all Prisma queries for its module's entities. No business logic — pure data access (create/read/update/delete, including transactional operations).                                  |
| **Database Layer**   | PostgreSQL via Prisma Client — schema, constraints, indexes, transactions.                                                                                                                |
| **Event Layer**      | After a service completes a meaningful state change, it publishes a domain event. Subscribers (in other modules) react independently and asynchronously where possible.                   |
| **Queue Layer**      | BullMQ jobs are enqueued (typically by an event subscriber) for any work involving external systems or non-critical-path processing (email, PDF generation, refund execution).            |

### Data Flow

```
Client Request
     ↓
API Route (app/api/v1/.../route.ts)
     ↓
Validation (Zod schema — reject early on invalid input)
     ↓
Authorization check (centralized permission layer — Section 6)
     ↓
Service Layer (business rules, orchestration)
     ↓
Repository Layer (Prisma queries, transactions)
     ↓
Database (PostgreSQL)
     ↓
Domain Event Published (e.g., booking.created)
     ↓
Event Subscribers (notifications, audit, future AI, etc.)
     ↓
Queue Jobs Enqueued where needed (email, invoice PDF, etc.)
     ↓
HTTP Response returned to Client (does NOT wait on queued/async work)
```

**Key principle:** The HTTP response returns as soon as the core state change is durably committed to the database. Anything not required for that response (emails, PDFs, notifications) happens after, via events and queues, so request latency stays low and external-provider failures never block the core operation.

---

## 4. Database Architecture (Design Only — No Prisma Code Yet)

### 4.1 Core Entities

| Entity               | Purpose                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`               | Base identity record for all humans in the system (Admin, Manager, Receptionist, Housekeeper, Customer), discriminated by `role`.                             |
| `StaffProfile`       | Staff-specific fields (linked 1:1 to `User` where `role != CUSTOMER`) — e.g., createdByUserId, mustChangePassword flag.                                       |
| `OtpVerification`    | OTP codes issued for customer login, with expiry and attempt tracking.                                                                                        |
| `PasswordResetToken` | Hashed, single-use, time-bound tokens for staff password resets.                                                                                              |
| `Session`            | Active session records (or reliance on signed HTTP-only cookies with server-side revocation list — see Section 5).                                            |
| `RoomType`           | Reference/config entity: name, base price, max occupancy, default amenities.                                                                                  |
| `Room`               | Individual bookable unit: room number, `roomTypeId`, price override, status, active flag.                                                                     |
| `RoomImage`          | Cloudinary references linked to a `Room`.                                                                                                                     |
| `Booking`            | Central booking record: guest reference, room reference, dates, guest count, status, source (ONLINE/OFFLINE), snapshot of price/room details at booking time. |
| `IdentityDocument`   | Cloudinary reference for uploaded guest ID, linked to a `Booking` or `User`.                                                                                  |
| `Payment`            | Payment record linked to a `Booking`: method (RAZORPAY/CASH), amount, status, provider reference id.                                                          |
| `Refund`             | Refund request linked to a `Payment`/`Booking`: status, requestedBy, approvedBy, reason, amount.                                                              |
| `Invoice`            | Generated invoice linked to a `Booking`: PDF reference (Cloudinary or generated-file store), totals, status.                                                  |
| `Notification`       | In-app notification record: recipient, type, payload, read/unread state.                                                                                      |
| `Review`             | Linked to a completed `Booking`: rating, text, moderation status.                                                                                             |
| `AuditLog`           | Immutable record: actor, action, target entity/id, metadata, timestamp.                                                                                       |

### 4.2 Relations (Conceptual)

- `User` 1—1 `StaffProfile` (nullable; only for staff roles).
- `User` 1—N `OtpVerification` (customer only).
- `User` 1—N `PasswordResetToken` (staff only).
- `RoomType` 1—N `Room`.
- `Room` 1—N `RoomImage`.
- `Room` 1—N `Booking`.
- `User` (customer) 1—N `Booking`; `User` (receptionist, nullable) 1—N `Booking` (as `createdByStaffId` for offline bookings).
- `Booking` 1—1 `IdentityDocument` (or 1—N if multiple guests require documents).
- `Booking` 1—N `Payment` (supports partial/multiple payment records, though typically 1).
- `Payment` 1—0/1 `Refund`.
- `Booking` 1—1 `Invoice`.
- `Booking` 0/1—1 `Review`.
- `User` 1—N `Notification`.
- `User` 1—N `AuditLog` (as actor).

### 4.3 Enums

- `UserRole`: `ADMIN`, `MANAGER`, `RECEPTIONIST`, `HOUSEKEEPER`, `CUSTOMER`
- `RoomStatus`: `AVAILABLE`, `BOOKED`, `OCCUPIED`, `CHECKED_OUT`, `CLEANING`, `MAINTENANCE`
- `BookingStatus`: `PENDING_PAYMENT`, `CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `COMPLETED`, `CANCELLED`, `REFUND_REQUESTED`, `REFUND_APPROVED`, `REFUND_REJECTED`
- `BookingSource`: `ONLINE`, `OFFLINE`
- `PaymentMethod`: `RAZORPAY`, `CASH`
- `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `REFUNDED`
- `RefundStatus`: `REQUESTED`, `APPROVED`, `REJECTED`, `PROCESSED`
- `InvoiceStatus`: `GENERATED`, `SENT`
- `ReviewStatus`: `PENDING`, `PUBLISHED`, `HIDDEN`
- `NotificationChannel`: `EMAIL`, `IN_APP`
- `AuditActionType`: enumerated set matching Section 11 of the PRS (e.g., `LOGIN`, `LOGOUT`, `BOOKING_CREATED`, `ROOM_UPDATED`, `STAFF_CREATED`, `REFUND_APPROVED`, ...)

### 4.4 Indexes (Conceptual)

- `Room.status` — for availability/status board queries.
- `Booking.(roomId, checkIn, checkOut)` composite — for overlap/availability checks.
- `Booking.status` — for dashboard filtering.
- `Booking.customerId`, `Booking.createdByStaffId` — for user-scoped queries.
- `Payment.bookingId`, `Payment.status` — for reconciliation queries.
- `OtpVerification.(identifier, expiresAt)` — for fast OTP lookups and cleanup.
- `PasswordResetToken.tokenHash` (unique) — for fast, safe token lookup.
- `AuditLog.(actorId, createdAt)` and `AuditLog.actionType` — for log querying.
- `Notification.(userId, read)` — for unread-count queries.

### 4.5 Transactions

Used wherever multiple writes must succeed or fail atomically, most critically:

- **Booking creation**: availability re-check + room hold + booking row creation must occur inside a single transaction with appropriate row-level locking to prevent double-booking under concurrent requests.
- **Payment confirmation**: payment status update + booking status update + room status update.
- **Refund approval**: refund status update + payment status update (+ triggering the refund-processing queue job only after commit).
- **Staff account creation**: user row + staff profile row + temp password hash, created together.

### 4.6 Soft Deletion Strategy

- Entities with downstream historical significance (`Room`, `User`) use a soft-delete pattern: `isActive` / `deactivatedAt` fields rather than hard deletes.
- Entities that are inherently append-only/historical (`Booking`, `Payment`, `Invoice`, `AuditLog`) are **never deleted** — cancellation/rejection is represented as a status, not a row removal.
- `RoomImage` and other purely auxiliary records may be hard-deleted, provided the corresponding Cloudinary asset is also removed.

### 4.7 Audit Strategy

- `AuditLog` is **append-only** — no update or delete operations are exposed for it at the application layer.
- Audit entries are written by the **audit module's subscriber**, reacting to domain events, not scattered `service.ts` files manually inserting log rows — this keeps audit coverage consistent and centrally reviewable.
- Every sensitive event (Section 11 of PRS) must have a corresponding audit subscriber; this is enforced by convention/code review, not automatically, so it must be checked at the end of each implementation phase.

---

## 5. Authentication Architecture

### 5.1 OTP Flow (Customer)

1. Customer submits phone/email.
2. `auth` service generates a numeric OTP, stores a **hashed** OTP value with `expiresAt` and `attemptCount` in `OtpVerification`.
3. An OTP-delivery job is enqueued (BullMQ OTP queue) → Resend sends the code.
4. Customer submits the OTP; service compares against the stored hash, checks expiry and attempt count.
5. On success: OTP record invalidated, session/cookie issued, `User` record created if this is a first-time login.
6. On repeated failure: attempts are capped; further attempts blocked until a new OTP is requested (rate-limited).

### 5.2 Password Flow (Staff)

1. **Login**: email + password submitted → password compared against stored hash (bcrypt/argon2-class hashing) → session/cookie issued on success.
2. **Forgot Password**: staff submits email → service generates a random token, stores only its **SHA-256 hash** in `PasswordResetToken` with an expiry → raw token emailed as a reset link (queued job) → raw token never persisted.
3. **Reset Password**: staff submits new password + token from link → service hashes the submitted token and looks up a matching, unexpired, unused `PasswordResetToken` → on match, updates the password hash, marks the token used, and **invalidates all active sessions** for that account.

### 5.3 Session Management

- Sessions are represented via a signed, **HTTP-only, Secure, SameSite** cookie.
- Session payload is minimal (user id, role) — sensitive data is never stored client-side.
- Server-side session validation checks the cookie signature and (if a revocation/session table is used) confirms the session hasn't been invalidated (e.g., due to password reset or logout).

### 5.4 Cookie Strategy

- `HttpOnly`: prevents JS access (mitigates XSS token theft).
- `Secure`: cookie only sent over HTTPS.
- `SameSite=Lax` (or `Strict` where UX allows): mitigates CSRF.
- Reasonable expiry with sliding/rolling renewal on activity; distinct expiry policy may apply for staff vs. customer sessions.

### 5.5 Security Considerations

- All OTPs and reset tokens stored **hashed**, never in plaintext.
- Rate limiting on: OTP request, OTP verification, staff login, forgot-password request.
- Generic error messaging on login/OTP failures (do not reveal whether an email/phone exists in the system).
- Temporary passwords issued to new staff are single-use in effect — first login should prompt a mandatory password change (`mustChangePassword` flag on `StaffProfile`).

---

## 6. Authorization Architecture

### 6.1 RBAC Model

- Five fixed roles (`ADMIN`, `MANAGER`, `RECEPTIONIST`, `HOUSEKEEPER`, `CUSTOMER`) as defined in the PRS.
- Roles are **not** dynamically created/edited by end users — they are a fixed enum — but the permission system underneath is **permission-based**, not role-string-based, so future flexibility doesn't require rewiring every check.

### 6.2 Permission System

- A central permission registry maps each **permission** (e.g., `room:create`, `booking:cancel:any`, `refund:approve`, `audit:view:scoped`, `audit:view:all`) to the roles that hold it.
- Services and route handlers check **permissions**, never raw role strings:
  - Bad: `if (user.role === "MANAGER")`
  - Correct: `authorize(user, "room:create")`
- This indirection means role-to-permission mapping can evolve (e.g., splitting a role's responsibilities later) without touching every call site.

### 6.3 Middleware

- A single Next.js middleware (or route-group-level guard) handles **coarse-grained** checks: is the request authenticated at all, and does the session's role belong to the route group being accessed (e.g., `/​(staff)/​*` requires any staff role; `/​(staff)/​admin/​*` requires `ADMIN`).
- **Fine-grained** checks (e.g., "can this Receptionist view this specific booking," "can this Manager approve this specific refund") happen in the **service layer**, using the centralized permission-check utility — not duplicated ad hoc in route handlers.

### 6.4 Permission Checking Flow

```
Request arrives
     ↓
Middleware: is there a valid session? → 401 if not
     ↓
Middleware: is session role permitted for this route group? → 403 if not
     ↓
Route Handler → Validation
     ↓
Service Layer: authorize(user, "specific:permission", resourceContext?)
     ↓
   Allowed → proceed with business logic
   Denied  → throw standardized ForbiddenError → API returns 403
```

- The `authorize()` utility lives in `shared/authorization/` and is the **only** place permission logic is implemented. All modules import and call it rather than reimplementing checks.

---

## 7. Event Driven Architecture

### 7.1 Events (Representative Set)

| Domain  | Events                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Booking | `booking.created`, `booking.confirmed`, `booking.checked_in`, `booking.checked_out`, `booking.completed`, `booking.cancelled` |
| Room    | `room.created`, `room.updated`, `room.status_changed`, `room.deleted`                                                         |
| Payment | `payment.completed`, `payment.failed`                                                                                         |
| Refund  | `refund.requested`, `refund.approved`, `refund.rejected`, `refund.processed`                                                  |
| Invoice | `invoice.generated`                                                                                                           |
| Staff   | `staff.created`, `staff.deactivated`                                                                                          |
| Auth    | `password.reset_requested`, `password.reset_completed`, `otp.requested`, `otp.verified`                                       |
| Review  | `review.created`, `review.moderated`                                                                                          |

### 7.2 Publishers

- Domain events are published **only from the Service Layer**, immediately after the relevant database transaction has committed successfully. A service never publishes an event for a change that hasn't been durably persisted.

### 7.3 Subscribers

- Subscribers are registered in `shared/events/` and live inside the module they belong to (e.g., the `notifications` module subscribes to nearly all events; the `audit` module subscribes to all sensitive-action events; the `invoices` module subscribes to `booking.checked_out` / `payment.completed`).
- Subscribers are independent of one another — a failure in one subscriber (e.g., notification dispatch) must not roll back or block another (e.g., audit logging) or the originating transaction, which has already committed.
- Subscribers that need to talk to external systems (email, PDF rendering, Razorpay refund calls) **enqueue a BullMQ job** rather than doing the work inline.

### 7.4 Future AI Agent Consumption

- Because state changes are expressed as **published domain events** rather than being buried inside direct service-to-service calls, a future AI module can subscribe to the same event bus (e.g., `booking.created`, `review.created`, `room.status_changed`) **without modifying any existing module**.
- Example future capabilities enabled by this shape: an AI pricing agent subscribing to `booking.created`/`booking.cancelled` to adjust room pricing; an AI concierge subscribing to `booking.confirmed` to proactively message guests; an AI review-summarizer subscribing to `review.created`.
- The event payload contracts (Section 7.1) act as a stable interface — as long as they're not broken, AI subscribers can be added, removed, or iterated on independently of booking/payment/auth/room logic, satisfying the Master Instructions' requirement that AI never be tightly coupled to core modules.

---

## 8. Queue Architecture (BullMQ)

| Queue                  | Jobs                                                                                                    | Triggered By                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Email Queue**        | Generic transactional emails (welcome, staff credentials, generic notices)                              | `staff.created`, misc. notification events  |
| **OTP Queue**          | OTP code delivery (SMS/email)                                                                           | `otp.requested`                             |
| **Notification Queue** | In-app notification creation + fan-out; may sub-delegate to Email Queue for email-channel notifications | Nearly all domain events                    |
| **Invoice Queue**      | Invoice PDF generation and email delivery                                                               | `booking.checked_out` / `payment.completed` |
| **Refund Queue**       | Refund execution against Razorpay (or manual cash-refund logging)                                       | `refund.approved`                           |

### Design Notes

- Each queue has a dedicated worker with **retry policy with backoff** and a **dead-letter/failed-job** path for manual inspection (critical for payment/refund-adjacent jobs).
- Jobs are **idempotent** where possible (e.g., invoice generation checks whether an invoice already exists for the booking before creating a duplicate) — important since retries can and will happen.
- The **OTP Queue** and **Email Queue** are kept separate from Invoice/Refund queues so that a slowdown in one (e.g., a burst of OTP requests) doesn't starve time-sensitive refund processing.
- Queues live in `shared/queues/`, with each module only responsible for **enqueuing** jobs relevant to it — workers can be colocated or split into separate processes later without changing module code.

---

## 9. File Storage Architecture (Cloudinary)

- All uploads (room images, guest identity documents) go through a single `lib/cloudinary.ts` client wrapper — no module talks to the Cloudinary SDK directly.
- Upload flow: client requests a signed upload (server-generated signature) → client uploads directly to Cloudinary → client/server persists the returned `publicId`/`secureUrl` against the relevant entity (`RoomImage`, `IdentityDocument`).
- **Validation before persistence**: file type and size are validated both client-side (UX) and server-side (authoritative) before the reference is accepted into the database.
- **Sensitive files** (identity documents) are stored in a Cloudinary folder/access mode that is not publicly listable, and access URLs are only ever generated server-side, scoped to authorized requests (the customer themselves, or staff with a legitimate need — e.g., Receptionist verifying ID at check-in).
- Deleting a `Room` or `RoomImage` triggers deletion of the corresponding Cloudinary asset (via a queued or synchronous cleanup call, depending on volume) to avoid orphaned files.

---

## 10. Future AI Architecture

- AI is **not implemented** in this phase, but the architecture is deliberately shaped to support it:
  - **Event-driven core** (Section 7): AI modules subscribe to existing events instead of being called synchronously from booking/payment/auth/room code.
  - **Modular boundaries**: a future `modules/ai/` (or per-capability `modules/ai-pricing/`, `modules/ai-concierge/`) would follow the same module shape (service/repository/validation/events) as every other module, and would own its own data (e.g., AI-generated suggestions, agent conversation logs) rather than writing into core entities directly.
  - **Read access via repositories/services, not raw DB access**: if an AI module needs data from bookings/rooms, it calls the existing module's `service.ts` (read methods), preserving encapsulation and permission enforcement.
  - **Tool-call safety**: any future AI agent capable of taking actions (e.g., creating a booking on a guest's behalf) would go through the **same service layer and authorization checks** as a human-initiated request — no bypass path. Idempotency keys should be used for any AI-initiated write, since agentic retries are common.
  - **Queue reuse**: AI-triggered async work (e.g., generating a personalized offer email) can reuse existing queues (Email Queue) or introduce a dedicated `AI Queue` without touching other queues.

---

## 11. Security Architecture

### Authentication Security

- Password hashing via a strong adaptive algorithm (bcrypt/argon2-class); OTPs and reset tokens hashed at rest.
- Rate limiting on all auth entry points (login, OTP request/verify, forgot password).
- Session invalidation on password reset and logout.
- Generic, non-enumerating error messages on auth failures.

### Authorization Security

- All permission checks routed through the single centralized `authorize()` utility (Section 6) — no ad hoc role checks anywhere in route handlers or services.
- Fine-grained, resource-scoped checks (e.g., "this booking belongs to this customer") enforced at the service layer, not assumed from the route alone.

### API Security

- Every `/api/v1/*` endpoint validates input via Zod before touching business logic.
- Consistent, sanitized error responses — internal error details, stack traces, and secrets are never returned to the client.
- CSRF mitigation via `SameSite` cookies (+ additional CSRF token for state-changing requests if cookie-based auth is used for browser-originated form posts).
- Razorpay webhook endpoints verify request signatures before trusting payload contents.

### Upload Security

- Server-side (not just client-side) validation of file type/size for all Cloudinary uploads.
- Signed upload flow so unauthenticated/unauthorized parties cannot upload directly to the hotel's Cloudinary account.
- Identity documents stored with restricted access mode; URLs generated only for authorized requests.

### Database Security

- Prisma parameterized queries throughout — no raw string-concatenated SQL.
- Least-privilege database credentials for the application connection.
- Sensitive fields (password hashes, token hashes) never selected into API responses (explicit `select`/DTO mapping rather than returning raw Prisma models).
- Audit log is append-only at the application layer, protecting the integrity of the accountability trail.

---

## 12. Development Rules

- **Strict TypeScript** across the entire codebase; no implicit `any`.
- **No business logic in route handlers** — route handlers only parse, validate, delegate, and format responses.
- **No direct cross-module repository access** — modules interact with each other only through the other module's service layer or through domain events.
- **No scattered role checks** — all authorization goes through `shared/authorization`.
- **No synchronous external calls in the request path** for non-critical work — email, PDF generation, and refund execution are always queued.
- **Reusable over duplicated** — shared validation, constants, hooks, and UI components are extracted, not copy-pasted.
- **Every async page/action has a loading, empty, and error state** — no exceptions.
- **Every phase must leave the project fully working** — no partially-wired features merged into a broken state.
- **Consistent API response format** across all `/api/v1/*` endpoints (success and error shapes).
- **No secrets or internal error details ever returned to the client.**
- Code must be free of TypeScript/ESLint errors, dead code, and duplicated logic before a phase is considered complete, per the Master Instructions' phase-completion checklist.

---

## Document Status

This document defines the **technical architecture** — module boundaries, layering, data flow, database design (conceptual), auth/authorization design, event/queue design, storage design, and security posture. No application code or Prisma schema code has been written.

**Awaiting your review and approval before proceeding to the next step (e.g., Prisma schema implementation / Phase 1 build).**
