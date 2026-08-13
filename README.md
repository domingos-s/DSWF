# Days Since We Fought

A mobile-first progressive web app for tracking peaceful streaks with family members.

## What it does

- Setup flow for adding family members by name and profile photo
- Independent live streak timer for each person
- **We fought** resets the clock and immediately starts a fresh streak
- 10-second undo after a reset
- Current-streak leaderboard and personal bests
- Milestone badges at 1, 3, 7, 14, 30, 90, and 365 days
- On-device history and best-streak tracking
- Add/edit/remove family members
- Local JSON backup export
- Offline service worker and installable PWA manifest
- No account or backend; data stays in browser local storage

## Run locally

Serve the repository over HTTP(S). For example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

> Service workers and PWA installation require a secure context (`https://`) in production. `localhost` is treated as secure for development.

## Hosting

The app is static and can be hosted directly with GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any static web host.

## Data model

All data is stored under the browser key `dswf:v1`. Profile photos are resized client-side before being stored. Fight events and completed streaks remain local to the device unless the user explicitly exports a JSON backup.
