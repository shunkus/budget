# Budget Manager

A mobile-first personal budget app. A fixed amount is added to your budget every day, and expenses, income and subscriptions are deducted or added as you record them.

## Features

- **Daily budget**: Adds a set amount every day (Japan time). Missed days are added in one go the next time the app opens
- **Keypad input**: Built-in calculator keypad (`+ − × ÷`) with frequently used amounts, a preview of the balance after use, and a resizable key height (drag the handle above the keypad; double-tap to reset)
- **Memo & category**: Optional free-text memo and category per transaction. Frequently used values are suggested, and a memo used before fills in its last category automatically
- **Transaction history**: 7 days / 30 days / 1 year / all time, with expense, income and net totals, daily net per date, weekday labels (weekends highlighted) and inline editing of amount, memo and category. History is kept for about 3 years
- **TSV copy & bulk edit**: Copy the listed transactions as TSV, edit them anywhere (a spreadsheet or your own AI), and paste them back to update amount, memo and category in bulk. Rows are matched by ID; daily and subscription rows are read-only
- **Subscriptions**: Register monthly or yearly subscriptions; their prorated daily cost is deducted every day. Search, filter, sort and copy the list
- **Statistics**: Spending for 7 days / 30 days / 12 months with a daily-budget reference line, average by weekday, and breakdowns by category and memo
- **Settings**: Daily budget, last update date, budget reset, and light / dark / system theme
- **Login**: Simple username/password login checked on the server

## Tech Stack

- Next.js 16 (App Router), React 19
- TypeScript
- Tailwind CSS 4
- localStorage for data (stored per browser; nothing is synced to a server)

## Setup

Create `.env.local` with the login credentials:

```bash
AUTH_USERNAME=your-username
AUTH_PASSWORD=your-password
```

Then install and start the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the app.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/            # Pages, layout and the /api/auth route
├── components/     # Dashboard, keypad and modals (history, stats, subscriptions, settings)
├── contexts/       # Auth and budget state
├── hooks/          # Shared hooks (clipboard copy)
└── lib/            # Storage, calculator, statistics, suggestions, TSV and theme helpers
```

## Deployment

Deploy to Vercel and set `AUTH_USERNAME` and `AUTH_PASSWORD` as environment variables:

```bash
vercel
```

Or connect your GitHub repository for automatic deployments.
