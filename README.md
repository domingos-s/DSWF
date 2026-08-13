# Days Since We Fought

A mobile-first progressive web app for tracking peaceful streaks with family members, reflecting after conflict, and learning from relationship patterns privately on-device.

## What it does

- Setup flow for adding family members by name and profile photo
- Independent rolling 24-hour streak timer for each person
- **We fought** resets the clock and immediately starts a fresh streak
- 10-second undo after a reset
- Guided post-fight reflection journal
- Structured trigger categories, emotion selection, conflict intensity, repair status, and next-step choices
- Reflection registry and calendar view
- On-device insights engine with minimum-evidence thresholds
- Timing, weekday, emotion, trigger, cross-variable, clustering, relationship-contrast, streak-trend, and household-trend insights
- Evidence viewer for generated insights
- Helpful / not-helpful feedback and 30-day dismissal controls
- 7-day behavioral experiments with baseline comparison
- Current-streak leaderboard and personal bests
- Milestone badges at 1, 3, 7, 14, 30, 90, and 365 days
- Local JSON backup export
- Offline service worker and installable PWA manifest
- No account or backend; journal and analytics data stay in browser local storage

## Insights philosophy

Insights are deterministic and computed locally from the user's own records. The app treats observed patterns as prompts for reflection rather than proof of causation, blame, or diagnosis. More consequential associations require larger samples before they are surfaced.

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

All data is stored under the browser key `dswf:v1`. Profile photos are resized client-side before being stored. Fight events, completed streaks, reflections, insight feedback, dismissals, and experiment history remain local to the device unless the user explicitly exports a JSON backup.
