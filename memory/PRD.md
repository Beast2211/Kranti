# Kranti Ganesh Mandal 2026 Management — PRD

## Original Problem Statement
Production-ready cross-platform mobile app to manage a Ganesh Mandal: Members, Vargani (community
donations), Vargani payments, Advance/Pending Vargani, Expenses, Events, Reports, Notifications,
User approvals, Admin accounts and a dynamic Dashboard. Three roles (Super Admin, Admin, Member),
strict backend-enforced RBAC, secure JWT auth, INR formatting.

## Architecture
- **Frontend:** Expo (React Native) + expo-router file-based routing. Bottom tabs: Dashboard,
  Members, Vargani, Expenses, More. Custom fonts (Space Grotesk / Plus Jakarta Sans). Festive
  saffron/gold theme. react-native-keyboard-controller for forms. expo-file-system + expo-sharing
  for CSV export.
- **Backend:** FastAPI + MongoDB (motor). All routes under `/api`. JWT (PyJWT HS256) + bcrypt.
  RBAC via `require_roles` dependency. UUID string ids, `_id` excluded. Soft deletes (`deleted_at`).
- **Auth:** Members log in with 10-digit mobile; Admins/Super Admin with User ID. Members self-
  register → `pending` → admin approval → `active`. Token invalidation via `token_version`.

## User Personas
- **Super Admin:** full system control incl. admin management + audit logs.
- **Admin:** operational — members, approvals, vargani, expenses, events, reports.
- **Member:** read-only dashboard/members/vargani/expenses/events/reports + own password.

## Core Requirements (static)
- Correct Vargani math: Collected = SUM(payments); Pending = Target - Collected. No double-count of advance.
- Payment cannot exceed pending unless `allow_overpay`.
- Dashboard aggregates: total target/collected/pending/expenses/net balance + upcoming events + recent activity.
- Notifications on register/approve/reject/payment/expense/event. Audit logging of all mutations.

## Implemented (2026-06)
- [x] JWT auth: login, register, logout, change-password, forgot/reset, /auth/me — 2026-06
- [x] Seeded first Super Admin (superadmin / Kranti@2026, from backend/.env) — 2026-06
- [x] RBAC middleware (super_admin/admin/member) enforced backend — 2026-06
- [x] Members CRUD + search/filter + approve/reject workflow — 2026-06
- [x] Vargani payments CRUD + member summary + derived collected/pending — 2026-06
- [x] Expenses CRUD (10 categories) + filter — 2026-06
- [x] Events CRUD + status; upcoming surfaced on dashboard — 2026-06
- [x] Dashboard KPIs + progress bar + quick actions + recent activity — 2026-06
- [x] Reports (Financial/Vargani/Expenses/Events) + CSV export — 2026-06
- [x] Notifications (audience-based) + mark read — 2026-06
- [x] Admin Management (super_admin) + Audit Logs — 2026-06
- [x] Festive UI, INR formatting, empty/loading/error states — 2026-06
- [x] Verified: 40/40 backend tests + frontend E2E — 2026-06
- [x] Event photos: admins attach a poster via gallery → Emergent Object Storage; shown as banner in Events list & thumbnail on Dashboard (backend /api/upload + /api/files with token auth) — 2026-06
- [x] Payment receipts: one-tap shareable ₹ PDF receipt from any payment row (Vargani ledger + member detail) via expo-print/expo-sharing — 2026-06
- [x] Event edit & delete: admins get Edit (prefilled form, PUT) and Delete (confirm dialog, soft delete) on every event card; new GET /api/events/{id} — 2026-06
- [x] Member edit & delete (member detail screen) + Expense edit & delete (per-row) for admins, with confirm dialogs; new DELETE /api/members/{id}, GET /api/expenses/{id} — 2026-06
- [x] Advance now counts as collected (reduces pending); dashboard total_collected includes advances — 2026-06
- [x] Dashboard: added "Kranti Ganesh Mandal 2026" heading; removed Advance KPI (replaced with Collection %) — 2026-06
- [x] Vargani payment edit & delete (Vargani ledger + member payment history) for admins, with confirm dialogs; new GET /api/payments/{id}; edit/delete recalculate collected & pending automatically — 2026-06
- [x] Login screen: Ganesha hero image added above "Kranti Ganesh Mandal" title (assets/images/ganesha-hero.jpg) — verified rendering — 2026-06
- [x] Fixed event date display (timezone off-by-one): date-only strings now parsed as local dates via parseDateLocal/eventDateParts/formatEventDate; events list & dashboard cards show correct badge + full date (e.g. "15 Jun 2026") — verified by testing agent — 2026-06
- [x] Calendar date picker for events: custom cross-platform DatePickerField (month grid, prev/next nav, today highlight) replaces manual YYYY-MM-DD text on Add/Edit Event — verified — 2026-06
- [x] Member payment reminder: dashboard shows each member their own pending Vargani balance ("₹X left of ₹Y target") with tap-through to Vargani, or a "fully paid" thank-you card; backend /api/dashboard returns my_vargani for member users — verified — 2026-06

## Backlog / Remaining
- P1: Receipt & event image uploads via cloud object storage (deferred per user).
- P1: Native date/time picker for events (currently YYYY-MM-DD text).
- P2: Edit/delete UI for individual payments & expenses (backend supports it).
- P2: Pagination for very large lists.
- P2: Real SMS/email delivery for password recovery (code currently returned in-app).
- P2: PWA manifest/service worker polish for installable web.

## Next Tasks
- Gather user feedback on flows; wire image uploads if requested.
