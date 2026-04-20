# Umurenge IT Inventory — Backend API

Express + TypeScript + PostgreSQL REST API for the Umurenge IT Inventory Management System.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, and SMTP_* for email

# 3. Create database and run migrations
createdb umurenge_inventory        # or use your Postgres client
npm run db:migrate

# 4. Seed with sample data (optional)
npm run db:seed

# 5. Start dev server
npm run dev
# → http://localhost:3000
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | JWT signing secret (keep private!) | — |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_SECURE` | Use TLS (true/false) | `false` |
| `SMTP_USER` | SMTP login | — |
| `SMTP_PASS` | SMTP password / app password | — |
| `SMTP_FROM` | From address for emails | — |
| `FRONTEND_URL` | Frontend URL for reset links | `http://localhost:5173` |
| `RESET_TOKEN_EXPIRES_MINUTES` | Password reset link lifetime | `60` |

> **Gmail tip:** Enable 2-Step Verification, then create a 16-char App Password at  
> https://myaccount.google.com/apppasswords — use that as `SMTP_PASS`.

---

## API Routes

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | Login, returns `{ user, token }` |
| POST | `/auth/register` | — | Register new user |
| GET  | `/auth/me` | ✓ | Current user profile |
| POST | `/auth/forgot-password` | — | Send password reset email |
| POST | `/auth/reset-password` | — | Reset password with token |

**Forgot password flow:**
```
POST /api/auth/forgot-password
Body: { "email": "user@example.com" }
→ Sends email with reset link (always returns 200 to prevent enumeration)

POST /api/auth/reset-password
Body: { "token": "...", "password": "newpassword" }
→ Validates token, updates password
```

### Departments — `/api/departments`

| Method | Path | Description |
|---|---|---|
| GET    | `/departments` | List all (with `user_count`, `equipment_count`) |
| GET    | `/departments/:id` | Dept + `users[]` + `equipment[]` |
| POST   | `/departments` | Create |
| PATCH  | `/departments/:id` | Update |
| DELETE | `/departments/:id` | Delete (fails if has users) |

### Users — `/api/users`

| Method | Path | Query params | Description |
|---|---|---|---|
| GET    | `/users` | `search`, `department`, `page`, `limit` | Paginated list |
| GET    | `/users/:id` | — | User + `equipment[]` + `handovers[]` |
| POST   | `/users` | — | Create |
| PATCH  | `/users/:id` | — | Update |
| DELETE | `/users/:id` | — | Delete (releases equipment) |

### Equipment — `/api/equipment`

| Method | Path | Query params | Description |
|---|---|---|---|
| GET    | `/equipment` | `search`, `status`, `category`, `condition`, `assignedTo`, `departmentId`, `page`, `limit` | Paginated list |
| GET    | `/equipment/categories` | — | Category list with counts |
| GET    | `/equipment/:id` | — | Equipment + `handovers[]` |
| POST   | `/equipment` | — | Create |
| PATCH  | `/equipment/:id` | — | Update |
| DELETE | `/equipment/:id` | — | Delete |

### Handovers — `/api/handovers`

| Method | Path | Query params | Description |
|---|---|---|---|
| GET    | `/handovers` | `status`, `activityType`, `userId`, `equipmentId`, `search`, `dateFrom`, `dateTo`, `sortBy`, `sortDir`, `page`, `limit` | Paginated + filtered |
| GET    | `/handovers/:id` | — | Full detail with all joined fields |
| POST   | `/handovers` | — | Create (also updates equipment status) |
| PATCH  | `/handovers/:id/cancel` | — | Cancel pending handover |

**Sort columns for `sortBy`:** `date`, `created_at`, `activity_type`, `status`, `equipment_name`, `from_user`, `to_user`

### Reports — `/api/reports`

| Method | Path | Query params | Description |
|---|---|---|---|
| GET    | `/reports/dashboard` | — | KPI stats + recent handovers |
| GET    | `/reports/equipment` | `department`, `condition`, `category`, `period`, `dateFrom`, `dateTo`, `userId` | Equipment breakdowns + raw items |
| GET    | `/reports/handovers` | `period`, `dateFrom`, `dateTo`, `userId`, `activityType` | Handover trends + raw items |

**Period values:** `3m`, `6m`, `1y`, `all`  
(If `dateFrom`/`dateTo` are set they take priority over `period`)

---

## Database Schema

```
departments          users              equipment
────────────         ─────────          ─────────────
id (uuid PK)         id (uuid PK)       id (uuid PK)
name                 name               name
code (unique)        email (unique)     category
description          password_hash      serial_number (unique)
created_at           department_id →    tag_number (unique)
updated_at           role               assigned_to → users.id
                     avatar             status
                     is_admin           condition
                     created_at         purchase_date
                     updated_at         notes
                                        created_at
                                        updated_at

handovers                    password_reset_tokens
─────────────────────        ─────────────────────────
id (uuid PK)                 id (uuid PK)
from_user_id → users.id      user_id → users.id
to_user_id → users.id        token (unique)
equipment_id → equipment.id  expires_at
date                         used
status                       created_at
activity_type
notes
created_at
updated_at
```

---

## RBAC Notes

The `is_admin` boolean on the `users` table controls admin access.  
The seed script creates one admin user:

| Email | Password |
|---|---|
| admin@umurenge.rw | Admin@123 |

The `requireAdmin` middleware in `src/middleware/auth.ts` can be added to any route to restrict it to admins only. Currently all authenticated routes are accessible to any logged-in user — the frontend handles RBAC display logic.

---

## Scripts

```bash
npm run dev          # tsx watch — hot reload
npm run build        # tsc → dist/
npm run start        # node dist/index.js
npm run db:migrate   # Run SQL migrations (safe, idempotent)
npm run db:seed      # Seed sample data
npm run db:reset     # migrate + seed
```
