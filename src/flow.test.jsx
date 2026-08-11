import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from './App.jsx';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

function mockStorage() {
  const store = new Map();
  window.storage = {
    get: vi.fn(async (key) => (store.has(key) ? { key, value: store.get(key), shared: false } : null)),
    set: vi.fn(async (key, value) => { store.set(key, value); return { key, value, shared: false }; }),
    delete: vi.fn(async (key) => { store.delete(key); return { key, deleted: true, shared: false }; }),
    list: vi.fn(async () => ({ keys: [...store.keys()] })),
  };
  return store;
}

function mockAnalysisResponse(overrides = {}) {
  const base = {
    ticker: 'SPCX', price: 141.2, asOf: '2026-08-10', timeframe: 'daily',
    oneLinerRead: 'Coiling under a proven ceiling with volume drying up.',
    structure: {
      resistance2: { price: 160, touches: 2, status: 'Untested' },
      resistance1: { price: 140, touches: 2, status: 'Capping rallies' },
      current: 141.2,
      support1: { price: 120, touches: 4, status: 'Holding' },
      support2: { price: 110, touches: 3, status: 'Major floor' },
      rangeLow: 110, rangeHigh: 160, typicalSwingDollars: 12, typicalSwingPercent: 8.5, expectedMove: 15,
    },
    backAnalysis: 'Price has tested $140 twice and failed both times on declining volume.',
    catalysts: { earningsDate: '2026-11-03', earningsInWindow: false, news: 'Argus raised its target to $160.', impact: 'Bullish tailwind if $140 clears.' },
    conviction: { trend: 16, levelIntegrity: 15, momentum: 13, volRegimeFit: 14, catalyst: 17, total: 75, grade: 'A', direction: 'bullish', volatility: 'contracting', rationale: 'Clean structure, dated catalyst clear, momentum lagging slightly.' },
    trades: [
      { name: 'Bull Call Debit Spread', bestFit: true, plainEnglish: 'Defined-risk bet SPCX clears $140.', structureDetail: 'Long $140C / Short $160C', expiration: '2026-10-16', type: 'debit', costOrCredit: 420, maxGain: 1580, maxLoss: 420, breakeven: 144.2, probProfit: 55, estimated: true, whyStrikes: '$140 is the proven ceiling; $160 is the analyst target.', invalidation: 120 },
      { name: 'Bull Put Credit Spread', bestFit: false, plainEnglish: 'Collect premium betting SPCX holds above $120.', structureDetail: 'Short $120P / Long $110P', expiration: '2026-09-18', type: 'credit', costOrCredit: 250, maxGain: 250, maxLoss: 750, breakeven: 117.5, probProfit: 68, estimated: true, whyStrikes: '$120 has held four times.', invalidation: 120 },
    ],
    management: { takeProfitPct: 50, cutTrigger: 'Close below $120 on a daily close', timeExit: '21 DTE', sizePct: 2, adjustment: 'Roll the short strike up if SPCX clears $140 with volume.' },
    whatWouldMakeMeWrong: ['A close below $120 invalidates the range.', 'Weak volume on a breakout above $140 would be a trap.'],
    verifyBeforeEntry: ['IV rank versus its own history', 'Bid-ask width on the $140/$160 legs', 'Open interest at both strikes'],
    dataGaps: ['Exact premium and IV need verifying on the live chain.'],
  };
  return { ...base, ...overrides };
}

function mockFetchOnce(jsonPayload, { wrapFences = false, withProse = false } = {}) {
  let text = JSON.stringify(jsonPayload);
  if (wrapFences) text = '```json\n' + text + '\n```';
  if (withProse) text = 'Here is the analysis:\n' + text + '\nLet me know if you need anything else.';
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: 'text', text }] }),
    text: async () => text,
  });
}

beforeEach(() => {
  mockStorage();
  vi.restoreAllMocks();
});

describe('initial render', () => {
  it('mounts on the Analyze tab with no crash and no trades yet', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Drop a ticker, a chart, or both/i)).toBeInTheDocument());
    expect(screen.getByPlaceholderText(/AAPL, TSLA, SPY/i)).toBeInTheDocument();
  });

  it('Journal tab shows the empty state without crashing when no trades exist', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/Drop a ticker/i));
    await user.click(screen.getByRole('button', { name: /journal/i }));
    expect(await screen.findByText(/NO TRADES LOGGED/i)).toBeInTheDocument();
  });
});

describe('full analyze -> log -> journal -> close flow', () => {
  it('runs an analysis and renders every section without runtime errors', async () => {
    mockFetchOnce(mockAnalysisResponse());
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByPlaceholderText(/AAPL, TSLA, SPY/i));
    await user.type(screen.getByPlaceholderText(/AAPL, TSLA, SPY/i), 'SPCX');
    await user.click(screen.getByRole('button', { name: /run analysis/i }));

    await waitFor(() => expect(screen.getByText('SPCX')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(/75\/100/)).toBeInTheDocument();
    expect(screen.getAllByText(/Exp Oct 16, 26/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Stop-loss playbook/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\(est\.\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('$420').length).toBeGreaterThan(0);
    expect(screen.getByText('$144.20')).toBeInTheDocument();
    expect(screen.getAllByText(/Price trigger/).length).toBe(2);
    expect(screen.getAllByText(/\$120\.00/).length).toBeGreaterThan(0);
  });

  it('logs a trade from the analysis and it appears correctly in the journal', async () => {
    mockFetchOnce(mockAnalysisResponse());
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByPlaceholderText(/AAPL, TSLA, SPY/i));
    await user.type(screen.getByPlaceholderText(/AAPL, TSLA, SPY/i), 'SPCX');
    await user.click(screen.getByRole('button', { name: /run analysis/i }));
    await waitFor(() => screen.getByText('SPCX'), { timeout: 3000 });

    const logButtons = screen.getAllByRole('button', { name: /log this trade/i });
    await user.click(logButtons[0]);

    const modal = await screen.findByText(/Log a trade/i);
    expect(modal).toBeInTheDocument();
    expect(screen.getByText(/Pre-filled from your SPCX analysis/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^save trade$/i }));

    await waitFor(() => expect(screen.getByText(/Logged to journal/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^journal/i }));
    const totalCard = (await screen.findByText(/Total trades/i)).parentElement;
    expect(within(totalCard).getByText('1')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it('closing a trade updates stats and never divides by zero or shows NaN', async () => {
    mockFetchOnce(mockAnalysisResponse());
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByPlaceholderText(/AAPL, TSLA, SPY/i));
    await user.type(screen.getByPlaceholderText(/AAPL, TSLA, SPY/i), 'SPCX');
    await user.click(screen.getByRole('button', { name: /run analysis/i }));
    await waitFor(() => screen.getByText('SPCX'), { timeout: 3000 });
    await user.click(screen.getAllByRole('button', { name: /log this trade/i })[0]);
    await screen.findByText(/Log a trade/i);
    await user.click(screen.getByRole('button', { name: /^save trade$/i }));
    await waitFor(() => screen.getByText(/Logged to journal/i));

    await user.click(screen.getByRole('button', { name: /^journal/i }));
    await screen.findByText(/Total trades/i);

    const tradeRow = screen.getByText('SPCX', { selector: 'div' });
    await user.click(tradeRow);
    await user.click(screen.getByRole('button', { name: /close trade/i }));

    const pnlInput = await screen.findByPlaceholderText(/e.g. 240 or -180/i);
    await user.type(pnlInput, '380');
    await user.click(screen.getByRole('button', { name: /save outcome/i }));

    await waitFor(() => expect(screen.getAllByText('$380').length).toBeGreaterThan(0));
    const body = document.body.textContent;
    expect(body).not.toMatch(/NaN/);
    expect(body).not.toMatch(/undefined/);
  });
});

describe('resilience to model output that does not follow the format perfectly', () => {
  it('parses JSON wrapped in markdown fences', async () => {
    mockFetchOnce(mockAnalysisResponse({ ticker: 'AAPL' }), { wrapFences: true });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByPlaceholderText(/AAPL, TSLA, SPY/i));
    await user.type(screen.getByPlaceholderText(/AAPL, TSLA, SPY/i), 'AAPL');
    await user.click(screen.getByRole('button', { name: /run analysis/i }));
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('parses JSON with stray prose before and after it', async () => {
    mockFetchOnce(mockAnalysisResponse({ ticker: 'TSLA' }), { withProse: true });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByPlaceholderText(/AAPL, TSLA, SPY/i));
    await user.type(screen.getByPlaceholderText(/AAPL, TSLA, SPY/i), 'TSLA');
    await user.click(screen.getByRole('button', { name: /run analysis/i }));
    await waitFor(() => expect(screen.getByText('TSLA')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows a labeled error state (not a blank screen) on a non-JSON response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'Sorry, I could not complete that request.' }] }),
      text: async () => 'Sorry, I could not complete that request.',
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByPlaceholderText(/AAPL, TSLA, SPY/i));
    await user.type(screen.getByPlaceholderText(/AAPL, TSLA, SPY/i), 'ZZZZ');
    await user.click(screen.getByRole('button', { name: /run analysis/i }));
    await waitFor(() => expect(screen.getByText(/didn.t come back clean/i)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows a labeled error state on an HTTP failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 529, text: async () => 'overloaded' });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByPlaceholderText(/AAPL, TSLA, SPY/i));
    await user.type(screen.getByPlaceholderText(/AAPL, TSLA, SPY/i), 'ZZZZ');
    await user.click(screen.getByRole('button', { name: /run analysis/i }));
    await waitFor(() => expect(screen.getByText(/529/)).toBeInTheDocument(), { timeout: 3000 });
  });

  it('handles a response with mostly-null structure fields without crashing', async () => {
    mockFetchOnce(mockAnalysisResponse({
      price: null,
      structure: { resistance2: null, resistance1: null, current: null, support1: null, support2: null, rangeLow: null, rangeHigh: null, typicalSwingDollars: null, typicalSwingPercent: null, expectedMove: null },
      trades: [{ name: 'Long Call', bestFit: true, plainEnglish: 'Speculative long call.', structureDetail: 'Long $140C', expiration: '2026-10-16', type: 'debit', costOrCredit: null, maxGain: null, maxLoss: null, breakeven: null, probProfit: null, estimated: true, whyStrikes: 'Chart ceiling.', invalidation: null }],
      dataGaps: [],
    }));
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByPlaceholderText(/AAPL, TSLA, SPY/i));
    await user.type(screen.getByPlaceholderText(/AAPL, TSLA, SPY/i), 'SPCX');
    await user.click(screen.getByRole('button', { name: /run analysis/i }));
    await waitFor(() => expect(screen.getByText('SPCX')).toBeInTheDocument(), { timeout: 3000 });
    expect(document.body.textContent).not.toMatch(/NaN/);
    expect(screen.getByText(/No invalidation price is set/i)).toBeInTheDocument();
  });
});
