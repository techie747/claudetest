# The Options Architect

A React + Vite app for grading options trade setups and journaling them, with
an AI-powered analysis engine (Claude, with web search) behind a small
Express backend.

## Architecture

- `src/` — React app (Vite). Trades persist to `localStorage`.
- `server.cjs` — Express server. Serves the built frontend and exposes
  `POST /api/analyze`, which holds `ANTHROPIC_API_KEY` server-side and proxies
  requests to `https://api.anthropic.com/v1/messages` (with the
  `web_search_20250305` tool). The frontend never sees the API key.

## Setup

```bash
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY
```

## Running it

```bash
npm test        # 31 tests, ~4s
npm run build    # production build (dist/)
npm start        # builds and runs the Express server on :3000
```

For frontend-only development with hot reload (analysis calls proxy to the
Express server on :3000, so run `node server.cjs` alongside it):

```bash
node server.cjs  # in one terminal
npm run dev       # in another — served on :5173, proxies /api to :3000
```

## Notes

- Trade journal data is stored in the browser's `localStorage` (single
  device). For multi-device persistence, swap `loadTrades`/`saveTrades` in
  `src/App.jsx` for calls to a real backend + database.
- The analyze endpoint burns a real Anthropic API call plus a web search per
  request — consider rate-limiting `/api/analyze` before any public deploy.
