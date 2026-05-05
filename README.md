# KarigarGo

**KarigarGo** is a comprehensive web-based marketplace platform connecting customers with skilled workers (karigars) in Pakistan. Built with React, TypeScript, Supabase, and Tailwind CSS.

> **Vite + React + TypeScript + Tailwind + Supabase**

## 📱 Live Demo

- **Production**: [https://karigargo.app](https://karigargo.app) *(update with your URL)*

## 🎯 Features

### For Customers
- 📋 Post jobs with details, budget, location, and media attachments
- 🗺️ Location picker with map integration
- 🔍 Browse and hire skilled workers
- 💬 Real-time chat with workers
- ⭐ Rate and review completed jobs
- 📱 Track job progress in real-time
- 🔔 Push notifications for job updates

### For Workers (Karigars)
- 📝 Create detailed profiles with skills, CNIC verification, and certificates
- 🔎 Browse available jobs and submit bids
- 💰 Set inspection charges and bid amounts
- 📍 Real-time location tracking during active jobs
- 💬 Direct communication with customers
- ⭐ Build reputation through customer reviews
- 💵 Track earnings and payment history

### Platform Features
- 🔐 Secure authentication (Email/Password + Google OAuth)
- 🛡️ Role-based access control (Customer/Worker/Admin)
- 🌍 Bilingual support (English/Urdu with RTL)
- 📊 Admin dashboard for user/job management
- 📄 PDF receipt generation
- 🗂️ File uploads for photos, CNIC, certificates

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS 3, Custom CSS |
| **Backend/DB** | Supabase (PostgreSQL + Auth + Storage) |
| **State Management** | React Context (useAuth, useI18n) |
| **Maps** | Leaflet + React-Leaflet |
| **PDF Generation** | jsPDF |
| **Animations** | Framer Motion |
| **Icons** | React Icons (Io5) |
| **Notifications** | Browser Push API |

## 📁 Project Structure

```
karigargo-web/
├── public/                    # Static assets
├── src/
│   ├── components/           # Reusable UI components
│   ├── hooks/                # Custom React hooks (useAuth, useI18n)
│   ├── lib/                  # Utilities (supabase, validation, i18n)
│   ├── pages/                # Page components
│   │   ├── auth/             # Login, Signup, Forgot Password
│   │   ├── customer/         # Customer portal pages
│   │   ├── worker/           # Worker portal pages
│   │   └── admin/            # Admin dashboard
│   ├── types.ts              # TypeScript interfaces
│   ├── router.tsx            # React Router configuration
│   └── index.css             # Global styles
├── supabase/
│   └── schema.sql            # Database schema & RLS policies
├── .env.local                # Environment variables (gitignored)
├── .env.example              # Example env file
├── index.html                # HTML entry point
├── package.json              # Dependencies
├── tailwind.config.js        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite configuration
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Supabase account** (free tier works)
- **Google Cloud account** (for OAuth - optional)

### 1. Clone the Repository

```bash
git clone https://github.com/karigargoapp-web/karigargo-web.git
cd karigargo-web
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → **New Query**
3. Copy and paste the contents of `supabase/schema.sql`
4. Run the query to create all tables, functions, and RLS policies

### 5. Configure Authentication

#### Google OAuth (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials (Web application)
3. Add redirect URI: `https://your-project-ref.supabase.co/auth/v1/callback`
4. Enable Google provider in Supabase Dashboard → Authentication → Providers

#### Redirect URLs in Supabase
In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `http://localhost:5173`
- **Redirect URLs**:
  ```
  http://localhost:5173/**
  http://localhost:5173/email-confirmed
  http://localhost:5173/reset-password
  http://localhost:5173/customer/home
  http://localhost:5173/worker/dashboard
  ```

### 6. Run the Development Server

```bash
npm run dev
```

The app will be available at **http://localhost:5173**

### 7. Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder.

## 🗄️ Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Core user data (name, email, phone, role, city) |
| `worker_profiles` | Worker-specific data (skills, bio, CNIC, certificates) |
| `jobs` | Job postings from customers |
| `bids` | Worker bids on jobs |
| `messages` | Chat messages between users |
| `reviews` | Customer-to-worker reviews |
| `notifications` | Push notification records |
| `worker_locations` | Real-time worker location tracking |

## 🔐 Authentication Flow

### Email/Password
1. User signs up at `/signup/customer` or `/signup/worker`
2. Supabase sends confirmation email
3. User clicks link → redirected to `/email-confirmed`
4. User can now log in

### Google OAuth
1. User clicks "Sign in with Google"
2. Google OAuth flow with Supabase
3. New users get profile created with intended role
4. Existing users checked against intended portal for role enforcement

### Role Enforcement
- Portal-specific login pages (`/login` for customers, `/login/worker` for workers)
- Mismatched roles get error and redirected to correct login page

## 🌍 Internationalization

The app supports **English** and **Urdu** with RTL layout for Urdu.

## 🚀 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Netlify

1. Build command: `npm run build`
2. Publish directory: `dist`
3. Add environment variables in Netlify dashboard

## 🧪 Testing Checklist

**Customer Flow:**
- [ ] Sign up as customer
- [ ] Post a job with location
- [ ] Receive bids from workers
- [ ] Accept a bid and chat
- [ ] Complete job and review worker

**Worker Flow:**
- [ ] Sign up as worker with CNIC
- [ ] Browse jobs and submit bid
- [ ] Get hired and track location
- [ ] Complete job and get reviewed

**Auth Flow:**
- [ ] Role enforcement works (customer can't log in as worker)
- [ ] Google OAuth works
- [ ] Password reset works

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "OAuth client was disabled" | Enable Google provider in Supabase |
| "Email already exists" on new DB | Check console for Supabase URL - ensure it's new project |
| White screen when navigating | Fixed - loading state now shows spinner |
| Phone number already registered | Intended behavior - numbers must be unique |

## 📝 Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run preview  # Preview production build locally
```

## 📄 License

MIT License

## 👥 Team

- **Developer**: [Your Name]
- **Product**: KarigarGo Team

---

**Made with ❤️ in Pakistan** 🇵🇰

A legacy Expo UI may exist locally as `karigargoapp-old-ui/` — it is gitignored.
