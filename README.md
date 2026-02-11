# UniTrack

Track your university attendance from any JUNO Campus ERP. See which classes you can safely skip and which ones you must attend.

## Features

- **Attendance Dashboard** — Live attendance data with per-subject stats
- **Smart Bunk Advice** — Know exactly how many classes you can skip per subject
- **Timetable Awareness** — Set up your weekly schedule (manual or scan a photo with AI)
- **Today's Classes** — See today's classes with skip/attend verdicts at a glance
- **Per-Subject Thresholds** — Customize attendance targets per subject
- **Dark Mode** — Full dark theme support

## Setup

```bash
npm install
npm run dev
```

Add your Gemini API key for timetable image scanning:

```
# .env.local
GEMINI_API_KEY=your_key_here
```

Free key available at [aistudio.google.com](https://aistudio.google.com).

## Tech Stack

- Next.js 16, React 19, Tailwind CSS 4, TypeScript
- Gemini 2.0 Flash for timetable image parsing

## Contributors

- **Moni** — Creator
- **Claude** — AI pair programmer
