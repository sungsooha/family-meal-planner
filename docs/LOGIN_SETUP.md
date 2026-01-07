# Login Setup

This app supports two sign-in modes:

- Magic link (email OTP)
- Email + password

## Supabase Settings
1. Open Supabase → **Authentication → Providers**.
2. Enable:
   - **Email** (magic link)
   - **Email + Password** (password sign-in)
3. In **Authentication → URL Configuration**, add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://<vercel-app>.vercel.app/auth/callback`

## App Configuration
Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ALLOWED_EMAILS=you@example.com,partner@example.com
```

`ALLOWED_EMAILS` is optional; when set, only those addresses can access the app.

## Sign-In Flow
- Go to `/login`.
- Choose **Magic link**, **Email + password**, or **Sign up**.
- For magic links on iOS, open the link in the same browser that requested it.

## Sign-Up Flow (optional)
- Choose **Sign up** from `/login`.
- Only emails in `ALLOWED_EMAILS` are permitted.
- The account is created server-side with `email_confirm: true`.

## Reset Password Flow
- Choose **Reset password** from `/login`.
- Enter your email to receive a reset link.
- Open the link in the same browser; the page switches to reset mode.
- Enter a new password and submit.

## Troubleshooting
- `missing_session` usually means the link opened in a different browser or in-app view.
- Re-request the link from the same device and open it in the same browser.
