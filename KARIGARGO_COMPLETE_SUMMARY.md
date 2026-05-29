# KarigarGo — Complete Project Summary for New Chat

## Project Overview
KarigarGo is a Pakistani gig-economy marketplace ("Uber for home services") connecting customers with skilled workers (electricians, plumbers, carpenters, AC technicians, painters, cleaners, etc.). Built as a mobile-first Progressive Web App with a full web-based admin panel.

---

## Live URLs
- **Production App:** https://quiet-raindrop-42bbfd.netlify.app
- **Admin Panel:** https://quiet-raindrop-42bbfd.netlify.app/admin
- **GitHub Repo:** https://github.com/karigargoapp-web/karigaraccnetlify
- **Supabase Project ID:** epekjmfmbgwfonjyhklm
- **Supabase URL:** https://epekjmfmbgwfonjyhklm.supabase.co

---

## Credentials & Access
- **GitHub Org:** karigargoapp-web
- **GitHub Token:** ghp_REDACTED_SEE_GITHUB_SETTINGS
- **Admin Email:** tayyabbabar2001@gmail.com (role = admin in DB)
- **Netlify Project:** quiet-raindrop-42bbfd

---

## How Deployments Work

### Code to Netlify (Automatic)
```
Claude makes code changes in working directory
        ↓
git add -A && git commit -m "message"
        ↓
git push https://karigargoapp-web:TOKEN@github.com/karigargoapp-web/karigaraccnetlify.git main
        ↓
Netlify detects push to main branch
        ↓
Netlify auto-builds (npm run build) and deploys
        ↓
Live on quiet-raindrop-42bbfd.netlify.app in ~1 min
```

### Supabase Changes (Direct via MCP)
- DB migrations applied via Supabase:apply_migration tool
- SQL queries run via Supabase:execute_sql tool
- No manual steps needed for DB changes

### Netlify Environment Variables
```
VITE_SUPABASE_URL=https://epekjmfmbgwfonjyhklm.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from Supabase Settings > API>
```

### Supabase Auth Configuration
- **Site URL:** https://quiet-raindrop-42bbfd.netlify.app
- **Redirect URLs:**
  - https://quiet-raindrop-42bbfd.netlify.app/**
  - https://quiet-raindrop-42bbfd.netlify.app/email-confirmed
  - https://quiet-raindrop-42bbfd.netlify.app/reset-password
  - http://localhost:5173/**
  - com.karigargo.app://login (for Android APK)
  - com.karigargo.app://** (for Android APK)

---

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- React Router v6
- Tailwind CSS 3
- Framer Motion
- React Hot Toast
- React Icons (Ionicons 5)
- React Leaflet + Leaflet (maps)
- jsPDF + html2canvas (PDF receipts)
- DOMPurify (XSS prevention)
- Capacitor (Android APK wrapper)

### Backend (All Supabase)
- PostgreSQL 17
- Supabase Auth (email/password + Google OAuth)
- Supabase Realtime (live chat, job updates, location)
- Supabase Storage (CNIC images, photos, voice notes)
- Row Level Security (RLS) policies
- PostgreSQL stored functions + triggers

### Deployment
- Netlify (auto-deploy from GitHub main branch)
- GitHub repo: karigargoapp-web/karigaraccnetlify

### Mobile
- PWA (Add to Home Screen on Android/iOS)
- Capacitor Android APK (com.karigargo.app)
- APK built with Android Studio from android/ folder

---

## Database Schema (14 Tables)

| Table | Purpose |
|---|---|
| users | All users — customers, workers, admins |
| worker_profiles | Skills, CNIC, bio, ratings |
| jobs | All job postings and lifecycle |
| bids | Worker bids on jobs |
| messages | Real-time chat |
| reviews | Post-job reviews |
| notifications | In-app alerts |
| worker_locations | Live GPS tracking |
| wallets | Balance + reward points per user |
| wallet_transactions | Full transaction ledger |
| escrow | Locked job payments |
| disputes | Dispute cases |
| admin_actions | Admin audit log |
| platform_revenue | Commission + bidding fee tracking |

### Key Enums
- **job_status:** pending, bidAccepted, inspectionDone, proceedRequested, workCostProposed, workCostAccepted, workCostRejected, inProgress, paused, disputed, completed, cancelled
- **user_role:** customer, worker, admin
- **approval_status:** pending, approved, rejected

### Key DB Functions
| Function | Purpose |
|---|---|
| fn_lock_inspection_escrow | Locks inspection fee to escrow |
| fn_settle_inspection_only | Settles inspection-only job |
| fn_lock_work_escrow | Locks work amount + deducts 20rs bidding fee |
| fn_complete_job | Final settlement: 10% commission, 2% rewards |
| fn_dispute_settle | Admin dispute resolution |
| handle_signup_user | Creates user, sets approval_status by role |
| create_wallet_for_new_user | Auto-creates wallet (100rs bonus for workers) |
| create_worker_profile_on_signup | Auto-creates worker_profiles row |

### DB Triggers
- trg_create_wallet — new user gets wallet (100rs for workers)
- trg_create_worker_profile — new worker gets worker_profiles row

### Performance Indexes
idx_users_role, idx_users_role_approval, idx_jobs_status, idx_jobs_customer_id,
idx_jobs_worker_id, idx_jobs_created_at, idx_wallet_tx_user_id, idx_wallet_tx_type,
idx_platform_revenue_type, idx_escrow_status, idx_escrow_job_id,
idx_disputes_status, idx_notifications_user_id, idx_wallets_user_id

---

## Payment Model

### Core Rules
- Wallet-only (no cash)
- Inspection-first pricing (worker bids inspection fee only, max 500rs)
- Worker signup bonus: 100rs (covers first 5 bids at 20rs each)
- 20rs bidding fee charged to worker ONLY when customer accepts work cost and job starts
- 10% platform commission on every completion (deducted from worker, NOT shown to customer)
- 2% reward points to both parties on completion
- Escrow holds all funds until customer confirms completion
- No disputes after completion

### Payment Flow
```
1. Customer posts job (no payment)
2. Workers bid inspection fee (max 500rs)
3. Customer accepts bid → inspection fee locked in escrow
4. Worker inspects
5A. Customer ends at inspection → fn_settle_inspection_only
5B. Customer requests work cost → worker proposes → customer accepts
    → fn_lock_work_escrow (20rs from worker, work amount from customer)
6. Work done → customer marks complete → fn_complete_job
   Worker gets 90%, Platform gets 10%, Both get 2% reward points
```

### Financial Constants
```typescript
PLATFORM_COMMISSION_RATE = 0.10
REWARD_RATE = 0.02
BIDDING_FEE = 20
MAX_INSPECTION_CHARGE = 500
WORKER_SIGNUP_BONUS = 100
```

---

## Complete Job Status Machine
```
pending
  → bidAccepted (inspection fee locked in escrow)
    → inspectionDone (customer marks inspection complete)
      → proceedRequested (customer wants to proceed, worker notified)
        → workCostProposed (worker submits cost)
          → inProgress (customer accepts, 20rs deducted from worker)
            → completed (customer marks done, fn_complete_job)
      → completed (customer ends at inspection, fn_settle_inspection_only)
    → paused → disputed (dispute raised)
  → cancelled
```

---

## User Roles and Key Rules

### Customer
- Posts jobs (voice note required, photo required, no budget field)
- ONLY customer can mark inspection complete
- ONLY customer can mark job complete
- Customer controls all job progression
- Customer does NOT see platform fees or worker deductions

### Worker
- Must be approved by admin before bidding
- Must have 20rs minimum wallet balance to bid
- Gets 100rs signup bonus automatically
- Cannot mark inspection done (customer does it)
- Cannot complete job (customer does it)
- Location shared automatically from bidAccepted through job completion
- After customer requests work cost (proceedRequested) → worker submits cost

### Admin
- Accesses /admin (full-width web dashboard, not mobile shell)
- Can approve/reject workers with reason
- Can view CNIC images (lightbox)
- Can resolve disputes (continue/partial/cancel)
- Can suspend users
- Sees platform revenue (commissions + bidding fees)
- Revenue stored in platform_revenue table

---

## Authentication
- Email/password with email confirmation required
- Google OAuth via Supabase
- Portal enforcement: workers cannot login through customer portal
- Admin can login through any portal (exception added)
- signOut uses scope:'global' + window.location.href='/login' (fixes first-click logout bug)

### To make someone admin:
```sql
update users set role = 'admin', approval_status = 'approved'
where email = 'email@example.com';
```

---

## Layout and Responsive Design

### Strategy
- Desktop: 430px phone shell centered with grey background (looks like phone preview)
- Real phones (< 480px): full width, no shadow, no grey
- Admin panel: completely outside AppShell, full-width web layout

### CSS (src/index.css)
```css
.app-shell { max-width: 430px; margin: 0 auto; box-shadow: 0 0 60px rgba(0,0,0,0.12); }
@media (max-width: 480px) {
  .app-shell { max-width: 100% !important; width: 100vw !important; box-shadow: none !important; }
  #root { display: block !important; }
}
.bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); max-width: 430px; }
@media (max-width: 480px) {
  .bottom-nav { left: 0 !important; transform: none !important; max-width: 100% !important; }
}
```

---

## Storage Buckets (all public)
- avatars — profile photos
- signup-docs — CNIC front/back images
- job-images — job photos + voice notes
- message-media — chat images

---

## PWA and Android APK

### PWA
- manifest.json, sw.js in public/
- icon-192.png, icon-512.png (green background)
- Install: Chrome → Install App

### Android APK (Capacitor)
- App ID: com.karigargo.app
- Config: capacitor.config.ts
- Build: Android Studio → Build → Build APK(s)
- Output: android/app/build/outputs/apk/debug/app-debug.apk

### To rebuild APK after code changes:
```bash
npm run build
npx cap sync android
# Android Studio → Build → Build APK(s)
```

### APK Known Issue
Google Sign-In requires adding to Supabase redirect URLs:
- com.karigargo.app://login
- com.karigargo.app://**
And to Google Cloud Console OAuth credentials as Android client with SHA-1 fingerprint.

---

## All Bugs Fixed

| # | Bug | Fix |
|---|---|---|
| 1 | Admin panel 430px on desktop | AppShell bypassed for admin routes |
| 2 | Workers not showing in admin | RLS blocked nested joins, separate queries |
| 3 | Something went wrong on signup | signup-docs bucket set to public |
| 4 | Worker profile not saving Google OAuth | DB trigger + upsert instead of update |
| 5 | Budget field showing | Removed from form, validation, DB insert |
| 6 | Admin login looping | Added admin exception to portal check |
| 7 | 404 on page refresh | netlify.toml with SPA redirect |
| 8 | Google login to Vercel | Fixed Site URL in Supabase Auth |
| 9 | Logout unreliable | scope:global + hard redirect |
| 10 | 20rs not deducted | acceptWorkCost calls fn_lock_work_escrow |
| 11 | Job active after inspection-only | Changed to completed status |
| 12 | Platform fee shown to customer | Removed from confirmation modal |
| 13 | Confirm button double-fire | Added confirming state + disabled |
| 14 | Categories repeating 3x | Removed auto-scroll animation |
| 15 | Grey bars on mobile | Fixed CSS with !important overrides |
| 16 | Revenue not updating | platform_revenue table + updated DB functions |
| 17 | Worker can mark inspection | Removed button from worker side |
| 18 | No live location auto | liveTrackingPhase expanded to all active statuses |
| 19 | Duplicate ic_launcher_background | Removed from colors.xml |
| 20 | Post job stuck loading | 30s upload timeout + catch block |
| 21 | Worker approval not enforced | ProtectedRoute + useAuth + JobBid checks |
| 22 | Wallet screens missing | Created customer/Wallet.tsx + worker/Wallet.tsx |
| 23 | No withdraw for worker | WithdrawSection component in worker wallet |
| 24 | Admin dashboard slow | 14 DB indexes added |

---

## Current Data
- tayyababar2001@gmail.com — customer, balance 2000rs
- tayyabbabar2001@gmail.com — admin, approved
- Two workers registered with 100rs bonus each

---

## File Structure
```
src/
  App.tsx                    
  router.tsx                 AppShell wraps customer/worker, admin separate
  hooks/useAuth.tsx          auth, approval, global signOut
  layouts/AdminLayout.tsx    dark sidebar, full-width
  pages/
    auth/                    Login, WorkerLogin, Signups, CompleteProfiles
    customer/
      Home.tsx               categories, jobs, bottom nav
      PostJob.tsx            voice required, photo required, no budget
      JobDetail.tsx          bids, accept bid, fn_lock_inspection_escrow
      ActiveJob.tsx          full job flow customer-side
      Wallet.tsx             balance, transactions, top-up coming soon
    worker/
      Dashboard.tsx          job feed, approval banner
      ActiveJob.tsx          location auto, work cost on proceedRequested
      JobBid.tsx             wallet + approval checks
      Wallet.tsx             100rs bonus, withdraw, transactions
      PendingApproval.tsx    blocks unapproved workers
    admin/
      Dashboard.tsx          realtime stats, alerts
      Workers.tsx            approve/reject with CNIC
      WorkerDetail.tsx       full profile, lightbox
      Users.tsx              customers, suspend
      Jobs.tsx               all jobs, filters
      JobDetail.tsx          escrow, chat, notes, cancel
      Disputes.tsx           open/resolved
      DisputeDetail.tsx      resolve (continue/partial/cancel)
      Wallets.tsx            wallets, transactions, escrow
      Revenue.tsx            platform_revenue, bar chart
      Reports.tsx            flagged users
  types/index.ts             all types + financial constants
  index.css                  design system, responsive
android/                     Capacitor Android project
public/
  manifest.json              PWA manifest
  sw.js                      service worker
  icon-192.png               
  icon-512.png               
  _redirects                 Netlify SPA redirect
netlify.toml                 build config + redirects
capacitor.config.ts          Android config (com.karigargo.app)
```

---

## Future Work
- JazzCash / EasyPaisa payment integration (UI ready)
- NADRA CNIC verification
- Play Store release (signed APK with keystore)
- Google Sign-In in APK (needs SHA-1 + OAuth Android client)
- AI job matching
- Worker subscription plans
- Multi-city expansion
