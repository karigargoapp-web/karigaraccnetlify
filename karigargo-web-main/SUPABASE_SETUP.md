# Supabase Email Confirmation Setup

## Required Configuration

To enable email confirmation redirects for both localhost and production, you need to configure the following in your Supabase dashboard:

### 1. Navigate to Authentication Settings
Go to: **Supabase Dashboard → Authentication → URL Configuration**

### 2. Set Site URL
Set the **Site URL** to your production URL:
```
https://karigargo-web-67uc.vercel.app
```

### 3. Add Redirect URLs
Add the following URLs to the **Redirect URLs** list:

**For Production:**
```
https://karigargo-web-67uc.vercel.app/**
https://karigargo-web-67uc.vercel.app/email-confirmed
```

**For Local Development:**
```
http://localhost:5173/**
http://localhost:5173/email-confirmed
```

**For Vercel Preview Deployments (optional):**
```
https://karigargo-web-*.vercel.app/**
```

### 4. Email Templates (Optional)
You can customize the email confirmation template in:
**Supabase Dashboard → Authentication → Email Templates → Confirm signup**

The default template includes a link that will redirect users to `/email-confirmed` after they click "Confirm your email".

## How It Works

1. User signs up via `/signup/customer` or `/signup/worker`
2. Supabase sends a confirmation email with a magic link
3. User clicks the link in their email
4. Supabase verifies the email and redirects to `/email-confirmed`
5. The `EmailConfirmed` component shows a success message
6. After 3 seconds, user is automatically redirected to their dashboard based on role

## Testing Locally

1. Start your dev server: `npm run dev`
2. Sign up with a real email address
3. Check your email for the confirmation link
4. Click the link - you should be redirected to `http://localhost:5173/email-confirmed`
5. After 3 seconds, you'll be redirected to your dashboard

## Troubleshooting

**Issue:** Email link redirects to production instead of localhost
- **Solution:** Make sure `http://localhost:5173/**` is in your Redirect URLs list

**Issue:** "Invalid redirect URL" error
- **Solution:** Verify that the exact URL is added to the Redirect URLs list in Supabase

**Issue:** Email not received
- **Solution:** Check your spam folder, or check Supabase logs in Dashboard → Logs
