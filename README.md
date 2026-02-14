# UniTrack

Track your university attendance from any ERP portal. Know exactly which classes you can skip and which ones you must attend.

**Live at [unitrack-web.vercel.app](https://unitrack-web.vercel.app)**

## Features

- **Attendance Dashboard** — Live attendance data with per-subject breakdowns
- **Smart Bunk Advice** — See how many classes you can safely skip per subject
- **Timetable** — Set up your weekly schedule manually or scan a photo of your timetable
- **Today's Classes** — Daily view with skip/attend verdicts at a glance
- **Per-Subject Thresholds** — Customize attendance targets for individual subjects (Premium)
- **Clickable Stat Cards** — Tap Overall/Safe/Can Bunk/Must Attend to filter subjects
- **Dark Mode** — Full dark theme support
- **Cloud Sync** — Firebase Auth + Firestore for persistent accounts across devices
- **Encrypted Credentials** — ERP passwords encrypted client-side with AES-GCM

## Premium (Rs 29/month)

UniTrack uses a freemium model with manual monthly payments via Razorpay.

| | Free | Premium |
|---|---|---|
| Attendance dashboard | Yes | Yes |
| Global threshold | Yes | Yes |
| Refreshes | 3/month | Unlimited |
| Per-subject thresholds | No | Yes |
| Timetable features | No | Yes |
| Free trial | 7 days | — |

- No auto-renewal — one-time payment for 30 days
- Renewing before expiry extends from current expiry date

## Getting Started

```bash
npm install
```

Create a `.env.local` with the following:

```
GEMINI_API_KEY=your_key_here

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
```

Then run the dev server:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Tech Stack

Next.js 16 / React 19 / Tailwind CSS 4 / TypeScript / Firebase / Razorpay
