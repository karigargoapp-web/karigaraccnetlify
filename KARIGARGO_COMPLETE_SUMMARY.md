# KarigarGo — Complete Project Summary

## Project Overview
KarigarGo is a Pakistani gig-economy marketplace ("Uber for home services") connecting customers with skilled workers (electricians, plumbers, carpenters, AC technicians, painters, cleaners, etc.). Built as a mobile-first Progressive Web App with a full web-based admin panel.

---

## Live URLs
- **Production App:** https://karigargo.netlify.app
- **Admin Panel:** https://karigargo.netlify.app/admin
- **GitHub Repo:** https://github.com/karigargoapp-web/karigaraccnetlify
- **Supabase Project ID:** epekjmfmbgwfonjyhklm
- **Supabase URL:** https://epekjmfmbgwfonjyhklm.supabase.co

---

## Credentials & Access
- **GitHub Org:** karigargoapp-web
- **Admin Email:** tayyabbabar2001@gmail.com (role = admin in DB)
- **Netlify Project:** karigargo

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
Live on karigargo.netlify.app in ~1 min
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
- **Site URL:** https://karigargo.netlify.app
- **Redirect URLs:**
  - https://karigargo.netlify.app/**
  - http://localhost:5173/**
  - karigargo://login
  - karigargo://**

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
- React Leaflet + Leaflet (OpenStreetMap — free, no Google Maps API)
- jsPDF + html2canvas (PDF receipts)
- DOMPurify (XSS prevention)
- Capacitor (Android APK wrapper)

### Backend (All Supabase)
- PostgreSQL 17
- Supabase Auth (email/password + Google OAuth via PKCE)
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

### Key DB Functions (9)
| Function | Purpose |
|---|---|
| fn_lock_inspection_escrow | Locks inspection fee to escrow |
| fn_settle_inspection_only | Settles inspection-only job |
| fn_lock_work_escrow | Locks work amount + deducts bidding fee |
| fn_complete_job | Final settlement: 10% commission, 2% rewards |
| fn_dispute_settle | Admin dispute resolution |
| handle_signup_user | Creates user, sets approval_status by role |
| handle_complete_signup_profile | Completes profile after signup |
| handle_signup_worker_profile | Creates worker_profiles row |
| create_wallet_for_new_user | Auto-creates wallet (100rs bonus for workers) |

### DB Triggers (13)
- trg_create_wallet — new user gets wallet (100rs for workers)
- trg_create_worker_profile — new worker gets worker_profiles row
- Plus 11 additional triggers for various automated operations

### Performance Indexes (14)
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

### Web (Netlify)
- Email/password with email confirmation required
- Google OAuth via Supabase PKCE flow
- `detectSessionInUrl: false` — code exchange handled manually in useAuth.tsx
- Old session cleared from localStorage when `?code=` detected (prevents initializePromise hang)
- `exchangeCodeForSession(code)` result handled directly via `.then()` — no reliance on SIGNED_IN event
- INITIAL_SESSION skipped when code exchange is pending
- `oauth-intended-role` set in localStorage before Google redirect (customer or worker)
- Portal enforcement: workers cannot login through customer portal
- Admin can login through any portal (exception added)
- signOut uses scope:'global' + window.location.href='/login'

### APK (Capacitor)
- `flowType: 'pkce'` everywhere
- Deep link scheme: `karigargo://` (dots not allowed in Android schemes)
- `@capacitor/app` + `@capacitor/browser` plugins for deep links
- `setupNativeAuthListener()` called in main.tsx before React mounts
- PKCE verifier backed up to `karigargo-pkce-backup` key before `Browser.open()` — Supabase SDK deletes the verifier during INITIAL_SESSION when app resumes
- Verifier restored in `appUrlOpen` handler before `exchangeCodeForSession`
- AndroidManifest.xml has intent-filter for `karigargo` scheme

### Key Auth Files
- `src/lib/supabase.ts` — client config, old session clearing on callback
- `src/lib/nativeAuth.ts` — APK deep link handling, verifier backup/restore
- `src/lib/authRedirect.ts` — always uses `window.location.origin` for redirects
- `src/lib/authRole.ts` — signOutIfEmailPasswordUnconfirmed check
- `src/hooks/useAuth.tsx` — AuthProvider, fetchUserProfile, onAuthStateChange
- `src/main.tsx` — setupNativeAuthListener before React mounts

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
git stash && git pull && npm run build && npx cap sync android
# Android Studio → Clean Project → Build APK(s)
```

### APK Deep Link Setup
- Supabase redirect URL: `karigargo://login`
- AndroidManifest.xml: intent-filter for `karigargo` scheme
- capacitor.config.ts: `androidScheme: 'https'`
- Google Cloud Console: Only `https://epekjmfmbgwfonjyhklm.supabase.co/auth/v1/callback` as redirect URI

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
| 8 | Google login redirect wrong site | Fixed Site URL in Supabase Auth |
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
| 25 | Web Google login stuck loading | detectSessionInUrl:false + manual exchangeCodeForSession + .then() handler |
| 26 | APK Google login stuck on login | PKCE verifier backup/restore (SDK deletes during INITIAL_SESSION) |
| 27 | Orphaned Google users | Manual DB inserts + wallet creation |
| 28 | oauth-intended-role missing on web | Added to Login.tsx handleGoogle |
| 29 | initializePromise hang on callback | Clear old session from localStorage when ?code= detected |
| 30 | Duplicate phone error | User-friendly error message for unique constraint violation |
| 31 | ReviewWorker/ReviewCustomer no error handling | Added try/catch + finally blocks |
| 32 | ActiveJob status transitions unhandled | Added error checks to all supabase operations |
| 33 | Worker submitWorkCost unhandled | Added error return on failure |
| 34 | Console.logs in production | Removed all debug console.logs |
| 35 | Unused loadingRef | Removed unused ref and import |
| 36 | Vercel removed | Deleted vercel.json, .vercel directory, all references |

---

## Key Learnings & Principles

- **Supabase SDK `initializePromise` blocks everything**: `setSession()`, `getSession()`, `exchangeCodeForSession()` all await it. If an old expired session is in localStorage, the refresh attempt can hang indefinitely. Always clear old session before code exchange.
- **`detectSessionInUrl: true` runs exchange inside `initializePromise`**: If the exchange hangs, INITIAL_SESSION never fires and the app shows loading forever. Safer to use `detectSessionInUrl: false` and handle exchange manually.
- **PKCE verifier deleted by SDK during INITIAL_SESSION**: On Capacitor, when app resumes after Chrome, `_removeSession()` is called which deletes the code verifier. Must backup to a separate key before `Browser.open()`.
- **Nested Supabase joins fail silently under RLS**: `select('*, worker_profiles(*)')` style joins consistently fail even when policies appear correct. Use separate queries.
- **Deep link scheme constraint**: Android does not allow dots in custom URI schemes — use `karigargo://` not `com.karigargo.app://`
- **OAuth redirect URI split**: Google Cloud Console = only `https://epekjmfmbgwfonjyhklm.supabase.co/auth/v1/callback`; `karigargo://login` goes only in Supabase Dashboard redirect URLs
- **Auth config changes**: Site URL and redirect URLs cannot be changed via SQL — must be done in Supabase Dashboard UI under Authentication → URL Configuration
- **Fixes should be targeted and minimal**, not full rewrites
- **`window.location.origin`** for all redirect URLs — works on any domain (Netlify, Vercel, localhost)

---

## Approach & Patterns

- **Session startup**: Claude reads `KARIGARGO_COMPLETE_SUMMARY.md` at the start of each session
- **Every code change**: Build to verify zero TypeScript errors, then push to GitHub; Netlify auto-deploys on push to `main`
- **Supabase MCP tools**: `Supabase:apply_migration` for schema/function changes; `Supabase:execute_sql` for data queries and one-time fixes
- **Bug fixing philosophy**: Targeted, minimal changes preferred over rewrites

---

## File Structure
```
src/
  App.tsx
  main.tsx                     setupNativeAuthListener before React mounts
  router.tsx                   AppShell wraps customer/worker, admin separate
  hooks/useAuth.tsx            auth, approval, global signOut, code exchange
  lib/
    supabase.ts                client config, old session clearing on callback
    nativeAuth.ts              APK deep link, verifier backup/restore
    authRedirect.ts            window.location.origin based redirects
    authRole.ts                email confirmation check
    i18n.tsx                   internationalization
  layouts/AdminLayout.tsx      dark sidebar, full-width
  pages/
    auth/                      Login, WorkerLogin, Signups, CompleteProfiles
    customer/
      Home.tsx                 categories, jobs, bottom nav
      PostJob.tsx              voice required, photo required, no budget
      JobDetail.tsx            bids, accept bid, fn_lock_inspection_escrow
      ActiveJob.tsx            full job flow customer-side
      Wallet.tsx               balance, transactions, top-up coming soon
    worker/
      Dashboard.tsx            job feed, approval banner
      ActiveJob.tsx            location auto, work cost on proceedRequested
      JobBid.tsx               wallet + approval checks
      Wallet.tsx               100rs bonus, withdraw, transactions
      PendingApproval.tsx      blocks unapproved workers
    admin/
      Dashboard.tsx            realtime stats, alerts
      Workers.tsx              approve/reject with CNIC
      WorkerDetail.tsx         full profile, lightbox
      Users.tsx                customers, suspend
      Jobs.tsx                 all jobs, filters
      JobDetail.tsx            escrow, chat, notes, cancel
      Disputes.tsx             open/resolved
      DisputeDetail.tsx        resolve (continue/partial/cancel)
      Wallets.tsx              wallets, transactions, escrow
      Revenue.tsx              platform_revenue, bar chart
      Reports.tsx              flagged users
  types/index.ts               all types + financial constants
  index.css                    design system, responsive
  components/
    ChatWindow.tsx             real-time messaging with media
    NotificationBell.tsx       unread count badge
android/                       Capacitor Android project
public/
  manifest.json                PWA manifest
  sw.js                        service worker
  icon-192.png
  icon-512.png
  logo.png                     KarigarGo logo
  _redirects                   Netlify SPA redirect
  favicon.png
netlify.toml                   build config + redirects
capacitor.config.ts            Android config (com.karigargo.app)
```

---

## GitHub Push Command
```bash
git push https://karigargoapp-web:TOKEN@github.com/karigargoapp-web/karigaraccnetlify.git main
```
Note: Never commit credential strings (GitHub push protection will block). Local branch is `master`, remote is `main` — use `master:main` if needed.

---

## Future Work
- JazzCash / EasyPaisa payment integration (UI ready)
- NADRA CNIC verification
- Play Store release (signed APK with keystore)
- Google Sign-In in APK (needs SHA-1 + OAuth Android client)
- AI job matching
- Worker subscription plans
- Multi-city expansion
