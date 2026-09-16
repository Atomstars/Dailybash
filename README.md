# Daymark

Daymark is a calm, mobile-first dashboard for recording what happened in every hour of the day and seeing how much useful work actually got done.

## What it includes

- A complete 24-hour daily timeline
- Four impact categories: deep work, progress, maintenance, and recharge
- Live useful-hours, quality, focus, and completion summaries
- Daily intention and end-of-day reflection
- Previous/next-day navigation and a jump-to-current-hour action
- Automatic, private browser storage with no account required
- Responsive desktop and mobile layouts

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production

```bash
npm run build
npm start
```

## Data privacy

Entries are stored in the browser's `localStorage`. They stay on the current device and browser profile. Clearing site data will remove them.
