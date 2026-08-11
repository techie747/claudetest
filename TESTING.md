# Test coverage

`npm test` runs two files, 31 tests total, all passing as of handoff.

## `src/logic.test.jsx` — 21 tests, pure functions

No rendering, no mocking — straight input/output on the analytics and
formatting functions. Covers:

- `gradeFromScore` — every band boundary (39/40, 54/55, 69/70, 84/85)
- `computeStats` — zero trades (no divide-by-zero/NaN), mixed win/loss/open
- `computeGradeBreakdown` — all 5 bands always returned even empty; only
  closed trades count toward a grade
- `computeStructureBreakdown` — empty input, sort order by avg P&L
- `computeCumulativePnl` — empty input, accumulates in date order regardless
  of input order
- `computeInsights` — under-5-closed-trades messaging, never throws on 0
  trades, no `NaN`/`undefined` leaking into generated text
- `computeDTE` — null on missing/unparseable dates instead of `NaN`
- `fmtMoney` / `fmtPrice` — null, negative, zero, decimal precision
- `computeStopPlan` — debit vs. credit trigger math, missing-data fallback
  text

## `src/flow.test.jsx` — 10 tests, full interaction

Renders the real `App` component in jsdom with `window.storage` and
`window.fetch` mocked (not stubbed-out — actually exercised), driven with
`@testing-library/user-event` the way a person would tap through it.

- Initial mount on Analyze tab, empty Journal state — no crash
- Full flow: type ticker → run analysis → every section renders (structure
  map, conviction pillars, catalysts, trade cards with expiration badges,
  stop-loss playbook, management plan, risk lists) → log a trade → appears
  correctly in the Journal → close it → stats update, no `NaN`
- Resilience to imperfect model output: JSON wrapped in markdown fences,
  JSON with prose before/after it, a non-JSON response, an HTTP error
  status, and a response with mostly-null fields — all produce either a
  correct render or a labeled, retryable error state, never a blank screen
  or an uncaught exception

## What isn't covered (be aware before you extend)

- The real Anthropic API call itself — tests mock `fetch`, so prompt
  quality (does the model actually follow the schema, get strikes right,
  etc.) isn't something this suite can verify. That needs live runs against
  real tickers.
- `ResizeObserver` is stubbed for jsdom (recharts needs it; jsdom doesn't
  have it). Real browsers have it natively — this is a test-environment gap
  only, not a product concern.
- Visual/CSS regressions — this is behavioral testing, not screenshot
  testing.
