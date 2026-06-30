# Marketing CRM — Lead Management System

Internal lead tracking and follow-up CRM for the marketing team. MERN stack, deployed on Render.

See `CRM_SRS_v1.md` (shared separately) for the full requirement spec — schema, API design, and decisions are documented there.

## Local Setup

### 1. Backend

```bash
cd server
cp .env.example .env
# Fill in MONGO_URI (your Atlas connection string + a real database name),
# and generate two long random strings for JWT_ACCESS_SECRET / JWT_REFRESH_SECRET.
npm install
```

Create the first admin account:

```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=SomeStrongPassword node src/utils/seedAdmin.js
```

Run the backend:

```bash
npm run dev   # http://localhost:5000
```

### 2. Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev   # http://localhost:5173
```

### 3. Or run both together from the project root

```bash
npm run install:all
npm run dev
```

## First Login

Log in with the admin account you seeded. From the admin dashboard:
1. Add Products (Admin > Products) — users need at least one product before they can create leads.
2. Add your marketing team as Users (Admin > Users), with a temporary password you relay to them.

## Deploying to Render

1. Push this repo to GitHub.
2. In Render, "New > Blueprint", point it at the repo — `render.yaml` will create both services (`crm-backend`, `crm-frontend`) automatically.
3. Fill in the env vars marked `sync: false` in the Render dashboard for `crm-backend`:
   - `MONGO_URI` — your Atlas connection string (use a dedicated database name, e.g. `crm_production`)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — long random strings (e.g. `openssl rand -hex 32`)
   - `CLIENT_URL` — the deployed frontend URL (Render will assign one like `https://crm-frontend-xxxx.onrender.com`), needed for CORS
4. Fill in `VITE_API_BASE_URL` for `crm-frontend` — the deployed backend URL + `/api`.
5. In MongoDB Atlas, allow network access from Render (either `0.0.0.0/0` with strong credentials, or Render's static outbound IPs if your plan includes them).
6. After first deploy, SSH/shell into the backend service (or run locally pointed at the production `MONGO_URI`) to run the `seedAdmin.js` script once.

## What's Built (v1 scope)

- Auth: JWT access + httpOnly refresh cookie, role-based access (admin/user), password reset flow (email sending stubbed — see `authController.js`, wire up Resend when ready)
- Lead entry form with customer autocomplete (name-only matching), product dropdown, conditional follow-up date / lost reason fields
- Full follow-up activity log per lead (history preserved, not overwritten)
- User dashboard: due-today follow-ups, stats, points (2/lead, simple v1 rule)
- Lead listing with date-range/status/search filters
- Admin: user management, product management, dashboard analytics, per-user performance table, report exports (Excel/CSV/PDF)
- Soft-delete on products (isActive flag) to preserve historical report integrity
- Audit log on key mutations (lead create/update, user create/update/deactivate)

## Known Follow-ups / Not Yet Built

- Email delivery for password reset (currently logs the reset link server-side — wire up Resend using `RESEND_API_KEY` in `.env`)
- Admin "Reassign Lead" action (discussed but not yet confirmed in scope — leads are currently locked to their creator with no UI-level reassignment)
- WhatsApp/email follow-up digest (deferred per SRS decision, in-app only for v1)
