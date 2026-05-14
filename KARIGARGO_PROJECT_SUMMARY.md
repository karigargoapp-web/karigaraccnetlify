# KarigarGo — Complete Project Summary

## Overview

KarigarGo is a Pakistani gig-economy marketplace — "Uber for home services" — connecting customers with skilled workers (electricians, plumbers, carpenters, AC technicians, painters, cleaners, etc.). Built as a mobile-first web app with a full admin control panel.

**Live URL:** https://quiet-raindrop-42bbfd.netlify.app  
**Admin Panel:** https://quiet-raindrop-42bbfd.netlify.app/admin  
**GitHub Repo:** https://github.com/karigargoapp-web/karigaraccnetlify  
**Supabase Project:** epekjmfmbgwfonjyhklm

---

## Tech Stack

### Frontend
- **React 18** — UI framework
- **TypeScript** — full type safety
- **Vite** — build tool and dev server
- **React Router v6** — client-side routing, protected routes, role-based redirects
- **Tailwind CSS 3** — custom design system (dark green `#006600` primary theme)
- **Framer Motion** — animations and transitions
- **React Hot Toast** — notification toasts
- **React Icons (Ionicons 5)** — icon library
- **React Leaflet + Leaflet** — live worker tracking map
- **jsPDF + html2canvas** — PDF receipt generation in browser
- **DOMPurify** — XSS prevention in chat messages

### Backend
- **Supabase** — entire backend:
  - **PostgreSQL 17** — primary database
  - **Supabase Auth** — email/password + Google OAuth
  - **Supabase Realtime** — live chat, job status updates, worker location tracking
  - **Supabase Storage** — CNIC images, profile photos, voice notes, job photos, certificates
  - **Row Level Security (RLS)** — per-table access control
  - **PostgreSQL Functions & Triggers** — wallet, escrow, settlement, signup automation
  - **PostgreSQL Enums** — typed status fields across all tables

### Deployment
- **Netlify** — production hosting, auto-deploy from GitHub
- **GitHub** — version control (`karigargoapp-web/karigaraccnetlify`)
- **Vercel** — previous hosting (replaced by Netlify)

### Payment (planned, UI built)
- **JazzCash** — greyed out, coming soon
- **EasyPaisa** — greyed out, coming soon
- **Bank Transfer** — greyed out, coming soon

---

## Database Schema (14 Tables)

### Core Tables
| Table | Purpose |
|---|---|
| `users` | All users — customers, workers, admins |
| `worker_profiles` | Worker-specific data — skills, CNIC, bio, ratings |
| `jobs` | All job postings and their lifecycle |
| `bids` | Worker bids on jobs |
| `messages` | Real-time chat between customer and worker |
| `reviews` | Bidirectional reviews after job completion |
| `notifications` | In-app and push notifications |
| `worker_locations` | Live GPS tracking during active jobs |
| `reports` | Legacy reports table |

### Payment & Escrow Tables
| Table | Purpose |
|---|---|
| `wallets` | One per user — balance + reward points |
| `wallet_transactions` | Full ledger of every money movement |
| `escrow` | Holds locked job payments during work |
| `disputes` | Dispute cases raised during active jobs |
| `admin_actions` | Audit log of every admin action |

### Key Columns Added
- `users`: `approval_status`, `rejection_reason`, `suspended_at`, `suspension_reason`, `dispute_count`, `cancellation_count`
- `jobs`: `work_cost_total`, `cancellation_reason`, `cancellation_actor`, `paused_at`, `dispute_id`, `admin_note`
- `worker_profiles`: `cnic_verified_by`, `approval_reviewed_by`, `approval_reviewed_at`

### Enums
- `user_role`: customer, worker, admin
- `approval_status`: pending, approved, rejected
- `job_status`: pending, bidAccepted, inspectionDone, workCostProposed, workCostAccepted, workCostRejected, inProgress, paused, disputed, completed, cancelled
- `wallet_tx_type`: top_up, inspection_payment, escrow_lock, escrow_release, commission, reward, bidding_fee, refund, partial_refund, withdrawal
- `escrow_status`: inspection_held, work_held, released, refunded, partial_refund
- `dispute_status`: open, resolved, cancelled
- `dispute_resolution`: continue, partial, cancel
- `cancellation_actor`: customer, worker, admin

---

## Database Functions & Triggers

### Functions
| Function | Purpose |
|---|---|
| `handle_signup_user` | Creates user row on signup, sets approval_status based on role |
| `handle_complete_signup_profile` | Updates CNIC fields and marks profile_complete |
| `handle_signup_worker_profile` | Creates worker_profiles row |
| `create_wallet_for_new_user` | Auto-creates wallet on user insert, gives workers ₨100 bonus |
| `create_worker_profile_on_signup` | Auto-creates worker_profiles row for new workers |
| `fn_lock_inspection_escrow` | Moves inspection fee from customer wallet to escrow |
| `fn_settle_inspection_only` | Case A settlement — job ends at inspection |
| `fn_lock_work_escrow` | Locks full job amount, charges ₨20 bidding fee |
| `fn_complete_job` | Final settlement — releases escrow, deducts commission, issues rewards |
| `fn_dispute_settle` | Admin-triggered dispute resolution (cancel/partial/continue) |
| `is_admin` | Helper function for RLS policies |
| `update_worker_stats_on_completion` | Updates worker total_jobs and total_earnings |

### Triggers
| Trigger | Event | Action |
|---|---|---|
| `trg_create_wallet` | After INSERT on users | Creates wallet (₨100 for workers, ₨0 for customers) |
| `trg_create_worker_profile` | After INSERT on users (role=worker) | Creates worker_profiles row |
| `trg_wallets_updated_at` | Before UPDATE on wallets | Updates updated_at timestamp |
| `trg_escrow_updated_at` | Before UPDATE on escrow | Updates updated_at timestamp |

---

## Payment Model

### Core Principles
- Inspection-first pricing (no upfront budget)
- Wallet-only transactions (no cash)
- Single 10% platform commission
- 2% reward system for both parties
- Closed-loop custodial wallet model

### Payment Flow

**Step 1 — Customer Posts Job**
- No payment, no budget required

**Step 2 — Worker Bids**
- Workers bid inspection fee only (max ₨500)
- Worker must have ≥ ₨20 wallet balance to bid

**Step 3 — Customer Accepts Bid**
- Inspection fee deducted from customer wallet → locked in escrow

**Step 4 — Inspection Happens**

**Case A — Job ends at inspection (customer declines quote):**
- Escrow → Worker: 90% of inspection fee
- Escrow → Platform: 10% commission
- Customer earns: 2% reward points
- Worker earns: 0 points
- No bidding fee charged

**Case B — Job proceeds:**
- Customer approves total quote (inspection + work)
- Full amount locked in escrow
- Worker charged ₨20 bidding fee from their wallet
- Work proceeds

**Step 5 — Job Completion**
- Customer confirms "Work done and satisfactory"
- Escrow → Worker: 90% of total
- Platform: 10% commission
- Customer earns: 2% reward points
- Worker earns: 2% reward points
- (1 reward point = ₨1 usable value)

### Worker Signup Bonus
- Every new worker gets ₨100 automatically on signup
- Covers first 5 bids at ₨20 each — completely free
- After ₨100 spent, worker must top up wallet
- 10% commission applies from job 1 regardless

### Commission Formula
```
Platform Revenue = 10% × Total Amount
Customer Rewards = 2% × Total Amount
Worker Rewards = 2% × Total Amount (full jobs only)
Worker Earnings = 90% × Total Amount
```

---

## Dispute & Refund System

### Core Principle
- No disputes after job completion — final is final
- All issues resolved before customer confirms completion

### Dispute Stages
1. **After inspection (not a dispute)** — customer declines quote → clean exit, Case A settlement
2. **During work** — either party raises dispute → job paused

### Admin Resolution Options
| Option | Action |
|---|---|
| Continue | Job resumes, misunderstanding resolved |
| Partial | Admin sets % completed, worker gets that portion, customer refunded rest |
| Cancel | Full refund to customer, worker gets nothing |

### Escrow During Dispute
- Money stays locked until admin resolves
- Platform earns only on final settled amount

---

## Job Status State Machine

```
pending
  → bidAccepted        (inspection fee locked in escrow)
    → inspectionDone
      → workCostProposed
        → workCostRejected  (Case A: inspection-only settlement)
        → workCostAccepted  (Case B: full amount locked, ₨20 fee charged)
          → inProgress
            → paused         (dispute raised)
              → disputed     (admin reviewing)
            → completed      (customer confirms — final settlement)
  → cancelled          (any stage)
```

---

## User Roles & Portals

### Customer Portal
| Screen | Route | Purpose |
|---|---|---|
| Login | `/login` | Email/password or Google OAuth |
| Signup | `/signup/customer` | Email signup with CNIC verification |
| Complete Profile | `/complete-profile/customer` | City, phone, CNIC upload |
| Home | `/customer/home` | Browse categories, post job |
| Post Job | `/customer/post-job` | Create job request (no budget field) |
| My Jobs | `/customer/my-jobs` | All jobs list |
| Job Detail | `/customer/job/:id` | View bids, accept worker |
| Active Job | `/customer/active-job/:id` | Track job, approve quotes, complete job |
| Tracking | `/customer/tracking/:id` | Live worker location map |
| Wallet | `/customer/wallet` | Balance, top up (coming soon), transactions |
| Profile | `/customer/profile` | Settings, wallet link, personal info |
| Receipt | `/customer/receipt/:id` | PDF receipt download |
| Chat | `/chat/:jobId` | Real-time messaging |
| Messages | `/customer/messages` | All conversations |
| Notifications | `/customer/notifications` | All alerts |

### Worker Portal
| Screen | Route | Purpose |
|---|---|---|
| Login | `/login/worker` | Email/password or Google OAuth |
| Signup | `/signup/worker` | Full signup with skills, CNIC, bio |
| Pending Approval | `/worker/pending-approval` | Blocked until admin approves |
| Dashboard | `/worker/dashboard` | Job feed filtered by city |
| Job Bid | `/worker/job/:id` | Submit inspection bid |
| Active Job | `/worker/active-job/:id` | Manage active job, submit quote |
| My Bids | `/worker/my-bids` | All submitted bids |
| Earnings | `/worker/earnings` | Completed jobs and earnings |
| Wallet | `/worker/wallet` | Balance, ₨100 bonus display, transactions |
| Reviews | `/worker/reviews` | Customer feedback received |
| Profile | `/worker/profile` | Settings, wallet link |
| Chat | `/chat/:jobId` | Real-time messaging |

### Admin Panel
| Screen | Route | Purpose |
|---|---|---|
| Dashboard | `/admin` | Live stats, alerts, recent jobs, recent workers |
| Workers | `/admin/workers` | Pending/Approved/Rejected tabs, CNIC review, approve/reject |
| Worker Detail | `/admin/workers/:id` | Full profile, CNIC lightbox, wallet balance, job history |
| Customers | `/admin/users` | All customers, wallet balances, suspend/unsuspend |
| Jobs | `/admin/jobs` | All jobs with status tabs, city filter, search |
| Job Detail | `/admin/jobs/:id` | Full job info, escrow, chat history, admin notes, cancel |
| Disputes | `/admin/disputes` | Open/resolved disputes list |
| Dispute Detail | `/admin/disputes/:id` | Resolve with continue/partial/cancel options |
| Wallets | `/admin/wallets` | User wallets, transaction ledger, escrow logs |
| Revenue | `/admin/revenue` | Commissions, bidding fees, bar chart, top jobs |
| Reports | `/admin/reports` | Flagged users, cancellation patterns, suspend controls |

---

## Worker Approval System

### Flow
1. Worker signs up → `approval_status = 'pending'` set in DB
2. Worker logs in → redirected to **Pending Approval** screen
3. Worker cannot access dashboard, cannot bid on jobs
4. Admin logs into `/admin/workers` → sees pending workers with CNIC images
5. Admin clicks **Approve** → worker notified, can now bid
6. Admin clicks **Reject** with reason → worker notified with reason

### Enforcement Points
- `ProtectedRoute` in router checks `approval_status !== 'approved'` → redirects to pending screen
- `useAuth` hook checks approval on every session load
- `JobBid` page checks wallet ≥ ₨20 AND approval_status before allowing bid submission
- `handle_signup_user` DB function sets correct status based on role

---

## Admin Panel Architecture

### Layout
- Dark sidebar (`#0f172a` background) with green primary nav highlights
- Top header with breadcrumb navigation and live indicator
- Full-width content area (escapes the 430px mobile app-shell)
- Responsive — hamburger menu on mobile
- Footer with copyright

### Key Features
- **Real-time updates** via Supabase channel subscriptions on Dashboard
- **Refresh buttons** on every page
- **Separate queries** (no nested joins) to avoid RLS blocking
- **Live counts** on tab buttons (Pending/Approved/Rejected)
- **CNIC lightbox** — click CNIC images to enlarge
- **Audit log** — every admin action saved to `admin_actions` table
- **Notifications** sent to users on every admin action (approve/reject/suspend/resolve)

---

## Authentication System

### Flows
- **Email/Password** — with email confirmation required
- **Google OAuth** — instant login, profile completion required after first login
- **Portal enforcement** — workers cannot login through customer portal and vice versa
- **Admin bypass** — admin can login through any portal without being kicked out
- **Session isolation** — `sessionStorage` prevents cross-tab conflicts

### Auth Guards
| Guard | Purpose |
|---|---|
| `AuthRoute` | Redirects logged-in users to their home |
| `ProtectedRoute` | Blocks unauthenticated access |
| `ProfileCompletionRoute` | Forces profile completion before access |
| `AppShell` | Wraps customer/worker routes in 430px mobile shell |

### Admin Access Setup
```sql
update users set role = 'admin', approval_status = 'approved'
where email = 'your-email@gmail.com';
```

---

## Storage Buckets

| Bucket | Public | Purpose |
|---|---|---|
| `avatars` | Yes | Profile photos |
| `signup-docs` | Yes | CNIC front/back images |
| `job-images` | Yes | Job problem photos |
| `message-media` | Yes | Chat images, voice notes |

---

## Real-time Features

- **Live chat** — text, images, voice notes via Supabase channels
- **Job status updates** — customer and worker see live status changes
- **Worker tracking** — customer sees worker live location on Leaflet map during active job
- **Admin dashboard** — live updates via Supabase channel subscriptions on jobs/users/disputes tables
- **Notifications** — browser push notifications + in-app notification center

---

## Key Bugs Fixed During Development

| Bug | Root Cause | Fix |
|---|---|---|
| Admin panel showed 430px narrow column | `app-shell` CSS (max-width: 430px) wrapping admin routes | Moved `AppShell` inside router, admin routes bypass it |
| Workers not showing in admin panel | RLS blocking nested join `select('*, worker_profiles(*)')` | Separate queries — fetch users first, then profiles by user_id array |
| "Something went wrong" on signup | `signup-docs` storage bucket was private, blocking CNIC uploads | Set bucket to public, fixed storage RLS policies |
| Worker profile not saving on Google signup | No `worker_profiles` row created for Google OAuth workers | Added DB trigger + changed `.update()` to `.upsert()` |
| Budget field still showing | Old code on Netlify (wrong GitHub branch) | Fixed GitHub branch connection: `master` → `main` |
| Admin login redirected to login screen | Portal enforcement kicked out admin (role !== customer) | Added `role !== 'admin'` exception to portal check |
| 404 on page refresh | No SPA redirect rule | Added `netlify.toml` with `/* → /index.html` redirect |
| Google login redirecting to Vercel | Supabase Site URL set to Vercel URL | Changed Site URL to Netlify URL in Supabase Auth settings |
| Receipt math wrong | Platform fee added ON TOP of total (double charging) | Fixed: customer pays total, commission deducted from worker share |
| Worker earning wrong route | Navigated to `/customer/receipt/` | Fixed to `/worker/job-summary/` |
| Stale closure on tab switching | `fetchData` not wrapped in `useCallback` | Fixed with `useCallback` and correct dependency arrays |
| Inspection cap still ₨300 | Old cap not updated in 3 places | Updated to ₨500 in `overMax` check, placeholder, and error message |

---

## Environment Variables

```env
VITE_SUPABASE_URL=https://epekjmfmbgwfonjyhklm.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Set in Netlify: Project configuration → Environment variables

---

## Deployment Steps

### Push to GitHub
```bash
git add .
git commit -m "your message"
git push https://USERNAME:TOKEN@github.com/karigargoapp-web/karigaraccnetlify.git master:main
```

### Netlify Auto-Deploy
- Connected to `karigargoapp-web/karigaraccnetlify` GitHub repo
- Branch: `main`
- Build command: `npm run build`
- Publish directory: `dist`
- Auto-deploys on every push to `main`

### Manual Deploy (if needed)
```bash
npm install
npm run build
# Drag dist/ folder to Netlify deploys page
```

---

## Supabase Auth Configuration

Go to Supabase → Authentication → URL Configuration:

**Site URL:**
```
https://quiet-raindrop-42bbfd.netlify.app
```

**Redirect URLs:**
```
https://quiet-raindrop-42bbfd.netlify.app/**
https://quiet-raindrop-42bbfd.netlify.app/email-confirmed
https://quiet-raindrop-42bbfd.netlify.app/reset-password
http://localhost:5173/**
```

---

## Validation Rules

| Field | Rule |
|---|---|
| Email | Standard email format |
| Password | Min 8 chars, uppercase, lowercase, number |
| CNIC | Pakistani 13-digit format (12345-1234567-1) |
| Phone | Pakistani format (03XXXXXXXXX, 11 digits) |
| Inspection charge | Max ₨500 |
| Worker bio | Max 500 characters |
| Job title | Required, max 100 characters |
| Job description | Required, max 5000 characters |

---

## Financial Constants

```typescript
PLATFORM_COMMISSION_RATE = 0.10  // 10%
REWARD_RATE = 0.02               // 2%
BIDDING_FEE = 20                 // ₨20 per job start
MAX_INSPECTION_CHARGE = 500      // ₨500 max bid
WORKER_SIGNUP_BONUS = 100        // ₨100 free on signup
```

---

## Complete Example Journey

### Scenario — Full Job (Inspection + Work)

1. Customer posts "Fix AC" in Lahore — no budget required
2. Worker (with ₨100 bonus) bids ₨300 inspection
3. Customer accepts → ₨300 deducted from customer wallet → locked in escrow
4. Worker visits, inspects, proposes ₨2,200 work cost
5. Total = ₨2,500
6. Customer approves → ₨2,200 more locked in escrow → worker charged ₨20 bidding fee
7. Work happens
8. Customer confirms completion
9. Settlement:
   - Platform earns: ₨250 (10%)
   - Worker receives: ₨2,250 (90%) minus ₨20 bidding fee = ₨2,230 net
   - Customer earns: 50 reward points (2%)
   - Worker earns: 50 reward points (2%)

---

## Project Statistics

- **Total source files:** ~60+ TypeScript/TSX files
- **Total DB tables:** 14
- **DB functions:** 12
- **DB triggers:** 6
- **Admin pages:** 11
- **Customer pages:** 15+
- **Worker pages:** 12+
- **Shared components:** 10+
- **RLS policies:** 25+

---

*Last updated: May 2026*
*Built with Claude (Anthropic) — AI-assisted full-stack development*
