import React, { useState, useEffect, useMemo, useCallback, useRef, useContext, createContext } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Plus, X, ChevronDown, ChevronUp, Check, Trash2, Image as ImageIcon, Loader2, AlertTriangle, Sparkles, ArrowLeft, Sun, Moon, KeyRound, Eye, EyeOff } from 'lucide-react';

const DARK = {
  bg: '#0B0D10',
  panel: '#14171C',
  panelAlt: '#1A1E24',
  border: '#262B33',
  borderLight: '#343B46',
  text: '#E9E7E1',
  textDim: '#8D93A0',
  textFaint: '#565C67',
  accent: '#C9A961',
  accentSoft: 'rgba(201,169,97,0.12)',
  positive: '#5FAE8E',
  positiveSoft: 'rgba(95,174,142,0.12)',
  negative: '#C0684F',
  negativeSoft: 'rgba(192,104,79,0.12)',
};

const LIGHT = {
  bg: '#F4F2ED',
  panel: '#FFFFFF',
  panelAlt: '#F1EFE9',
  border: '#DDD8CC',
  borderLight: '#C9C2B1',
  text: '#20211F',
  textDim: '#5B5A52',
  textFaint: '#8A887D',
  accent: '#9C7A22',
  accentSoft: 'rgba(156,122,34,0.12)',
  positive: '#2F7A5C',
  positiveSoft: 'rgba(47,122,92,0.12)',
  negative: '#A6452E',
  negativeSoft: 'rgba(166,69,46,0.12)',
};

const ThemeContext = createContext(DARK);

const STRUCTURES = [
  'Long Call', 'Long Put', 'Bull Call Debit Spread', 'Bear Put Debit Spread',
  'Bull Put Credit Spread', 'Bear Call Credit Spread', 'Iron Condor',
  'Broken Wing Butterfly', 'Jade Lizard', 'Calendar / Diagonal',
  'Long Strangle / Straddle', "Poor Man's Covered Call", 'Other',
];

const PILLARS = [
  { key: 'trend', label: 'Trend Structure' },
  { key: 'levelIntegrity', label: 'Level Integrity' },
  { key: 'momentum', label: 'Momentum & Participation' },
  { key: 'volRegime', label: 'Volatility Regime Fit' },
  { key: 'catalyst', label: 'Catalyst Environment' },
];

const GRADE_ORDER = ['A+', 'A', 'B', 'C', 'D'];

const SYSTEM_PROMPT = `You are The Options Architect — an institutional-grade options trading analyst. You read price structure like a desk analyst: support and resistance are load-bearing walls, volume is the foundation, volatility is the weather. You never guess a number you can't verify with web_search, and you never recommend undefined risk (no naked calls, no naked puts, no uncovered short premium).

TASK: given a ticker and/or a chart image, produce one complete trade analysis.

If a ticker is present, use web_search to find: current price, day range, 52-week high/low, key support and resistance from recent months, next earnings date and last earnings reaction, implied volatility or IV rank if reportable, recent news and analyst actions, sector/macro context, and unusual options activity if reported anywhere.

If a chart image is present, read the ticker, timeframe, and price scale off the image. Use it for structure — levels, range, trend. If a ticker is identifiable, also run web_search as above and combine both sources. If no ticker is readable, analyze pure price structure using relative levels and note in dataGaps that naming the ticker unlocks live pricing, IV, and catalysts.

CONVICTION ENGINE: score five pillars 0-20 each — trend, levelIntegrity, momentum, volRegimeFit, catalyst — summing to a 0-100 total. Grade bands: 85-100 A+, 70-84 A, 55-69 B, 40-54 C, below 40 D. Never inflate a score to be encouraging — a mediocre setup gets a mediocre grade.

STRATEGY SELECTION — match direction AND volatility regime, never direction alone:
- Bullish, IV low/falling/compression: bull call debit spread, or long call at 0.60-0.70 delta
- Bullish, IV high: bull put credit spread, short strike at a support level with 3+ touches, ~0.15-0.25 delta
- Bearish: mirror the above — debit spreads or long puts in low IV, credit spreads in high IV
- Neutral, ranging, IV elevated: iron condor, short strikes near 0.15 delta, wings 1-2 strikes wide, expiration clearing any earnings date
- Neutral, tight range, one side has more room: broken wing butterfly or jade lizard
- Neutral, extreme compression, dated catalyst: long strangle/straddle or a calendar spread at the compression price
- Pinned at a level: calendar or diagonal spread at that level
- Earnings inside the expiration window: say so plainly and pick the structure that minimizes IV-crush or gap risk

Strikes come from the chart's proven levels, not a delta table — delta is a sanity check only.

RULES: strikes and the expiration date must be exact and real — never a vague range like "45-60 DTE," pick one specific calendar date. UNITS: costOrCredit, maxGain, and maxLoss are always the TOTAL dollar amount for ONE CONTRACT (100 shares) — a $4.20 per-share debit is costOrCredit: 420, not 4.20. breakeven is a per-share underlying PRICE (e.g. 229.20), same decimal convention as the stock's current price. Give a best-effort ESTIMATE for all of these built from the verified strikes and a reasonable implied-volatility assumption for this name — never leave them null. Mark every trade "estimated": true, since none of this is a live quote, and add a dataGaps entry noting the exact premium needs verifying on the chain before entry. Never invent a strike or an earnings date you can't support. Never guarantee an outcome. Cap every text field at roughly one short sentence — this is data for a compact UI card, not an essay.

OUTPUT: respond with ONLY valid JSON, no markdown fences, no prose before or after, matching exactly this shape:
{
 "ticker": string, "price": number|null, "asOf": "YYYY-MM-DD", "timeframe": string,
 "oneLinerRead": string,
 "structure": {
   "resistance2": {"price": number, "touches": number, "status": string}|null,
   "resistance1": {"price": number, "touches": number, "status": string}|null,
   "current": number|null,
   "support1": {"price": number, "touches": number, "status": string}|null,
   "support2": {"price": number, "touches": number, "status": string}|null,
   "rangeLow": number|null, "rangeHigh": number|null,
   "typicalSwingDollars": number|null, "typicalSwingPercent": number|null,
   "expectedMove": number|null
 },
 "backAnalysis": string,
 "catalysts": {"earningsDate": string|null, "earningsInWindow": boolean, "news": string, "impact": string},
 "conviction": {"trend": number, "levelIntegrity": number, "momentum": number, "volRegimeFit": number, "catalyst": number, "total": number, "grade": "A+|A|B|C|D", "direction": "bullish|bearish|neutral", "volatility": "expanding|contracting|stable", "rationale": string},
 "trades": [{"name": string, "bestFit": boolean, "plainEnglish": string, "structureDetail": string, "expiration": "YYYY-MM-DD", "type": "debit|credit", "costOrCredit": number, "maxGain": number, "maxLoss": number, "breakeven": number, "probProfit": number, "estimated": boolean, "whyStrikes": string, "invalidation": number|null}],
 "management": {"takeProfitPct": number|null, "cutTrigger": string, "timeExit": string, "sizePct": number, "adjustment": string},
 "whatWouldMakeMeWrong": [string], "verifyBeforeEntry": [string], "dataGaps": [string]
}
Include 2-4 trades ranked best-fit first with exactly one bestFit:true, each with a real expiration date and estimated economics. Keep strings short.`;

function gradeFromScore(score) {
  if (score >= 85) return 'A+';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}
function gradeColor(g, C) {
  if (g === 'A+') return '#6FC29B';
  if (g === 'A') return C.positive;
  if (g === 'B') return C.accent;
  if (g === 'C') return '#C08A4A';
  return C.negative;
}
function fmtMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtPrice(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `$${Number(n).toFixed(2)}`;
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}
function computeDTE(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  const a = new Date(fromDate + 'T00:00:00');
  const b = new Date(toDate + 'T00:00:00');
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function loadTrades() {
  try {
    const raw = window.localStorage.getItem('trades');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
async function saveTrades(trades) {
  try {
    window.localStorage.setItem('trades', JSON.stringify(trades));
    return true;
  } catch (e) {
    console.error('Storage error', e);
    return false;
  }
}

function getApiKey() {
  try {
    return window.localStorage.getItem('oa-api-key') || '';
  } catch (e) {
    return '';
  }
}
function setApiKey(key) {
  try {
    if (key) window.localStorage.setItem('oa-api-key', key);
    else window.localStorage.removeItem('oa-api-key');
    return true;
  } catch (e) {
    return false;
  }
}

async function runAnalysis({ ticker, image }) {
  let contentBlocks;
  try {
    contentBlocks = [];
    if (image) {
      contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } });
    }
    let instruction;
    if (ticker && image) {
      instruction = `Ticker: ${ticker}. A chart screenshot is attached for structure. Use web_search for live price, news, earnings, and IV, then output the JSON analysis.`;
    } else if (ticker) {
      instruction = `Ticker: ${ticker}. Use web_search for live price, structure, news, earnings, and IV, then output the JSON analysis.`;
    } else {
      instruction = `A chart screenshot is attached with no ticker given. Read the ticker off the chart if legible and use web_search; otherwise analyze pure price structure and note the ticker gap in dataGaps. Output the JSON analysis.`;
    }
    contentBlocks.push({ type: 'text', text: instruction });
  } catch (e) {
    const err = new Error('Could not prepare the request from your inputs.');
    err.raw = `${e.name}: ${e.message}`;
    throw err;
  }

  let response;
  try {
    const clientKey = getApiKey();
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(clientKey ? { 'x-anthropic-key': clientKey } : {}),
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contentBlocks }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });
  } catch (e) {
    const err = new Error("Couldn't reach the analysis engine — usually a network hiccup, or the screenshot was too large. Try again, or try with just a ticker.");
    err.raw = `${e.name}: ${e.message}`;
    throw err;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const err = new Error(`The analysis engine returned an error (${response.status}).`);
    err.raw = errText;
    throw err;
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    const err = new Error("The response came back in a format that couldn't be read.");
    err.raw = `${e.name}: ${e.message}`;
    throw err;
  }

  let raw;
  try {
    const textBlocks = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text);
    raw = textBlocks.join('\n').trim();
  } catch (e) {
    const err = new Error("Couldn't extract text from the response.");
    err.raw = JSON.stringify(data).slice(0, 2000);
    throw err;
  }

  let cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const err = new Error("Couldn't parse the analysis into structured data — the raw read is below.");
    err.raw = raw;
    throw err;
  }
}

function computeStats(trades) {
  const closed = trades.filter((t) => t.status === 'closed');
  const open = trades.filter((t) => t.status === 'open');
  const wins = closed.filter((t) => (t.pnl || 0) > 0);
  const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  return {
    total: trades.length,
    open: open.length,
    closed: closed.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    totalPnl,
    avgPnl: closed.length ? totalPnl / closed.length : 0,
  };
}
function computeGradeBreakdown(trades) {
  return GRADE_ORDER.map((g) => {
    const inGrade = trades.filter((t) => t.grade === g && t.status === 'closed');
    const wins = inGrade.filter((t) => (t.pnl || 0) > 0).length;
    return {
      grade: g,
      count: inGrade.length,
      winRate: inGrade.length ? (wins / inGrade.length) * 100 : 0,
      avgPnl: inGrade.length ? inGrade.reduce((s, t) => s + (t.pnl || 0), 0) / inGrade.length : 0,
    };
  });
}
function computeStructureBreakdown(trades) {
  const map = {};
  trades.filter((t) => t.status === 'closed').forEach((t) => {
    if (!map[t.structure]) map[t.structure] = { wins: 0, count: 0, pnl: 0 };
    map[t.structure].count++;
    if ((t.pnl || 0) > 0) map[t.structure].wins++;
    map[t.structure].pnl += t.pnl || 0;
  });
  return Object.entries(map)
    .map(([structure, v]) => ({
      structure, count: v.count,
      winRate: v.count ? (v.wins / v.count) * 100 : 0,
      avgPnl: v.count ? v.pnl / v.count : 0,
    }))
    .sort((a, b) => b.avgPnl - a.avgPnl);
}
function computeCumulativePnl(trades) {
  const closed = trades.filter((t) => t.status === 'closed' && t.exitDate)
    .sort((a, b) => new Date(a.exitDate) - new Date(b.exitDate));
  let cum = 0;
  return closed.map((t) => { cum += t.pnl || 0; return { date: fmtDate(t.exitDate), cum }; });
}
function computeInsights(trades) {
  const closed = trades.filter((t) => t.status === 'closed');
  const insights = [];
  if (closed.length < 5) {
    const need = 5 - closed.length;
    insights.push(`Log ${need} more closed trade${need === 1 ? '' : 's'} to unlock calibration insights.`);
    return insights;
  }
  const gradeData = computeGradeBreakdown(trades).filter((g) => g.count > 0);
  if (gradeData.length >= 2) {
    const best = gradeData[0];
    const worst = gradeData[gradeData.length - 1];
    if (best.winRate < worst.winRate) {
      insights.push(`Your ${worst.grade} setups (${worst.winRate.toFixed(0)}% win rate) are outperforming your ${best.grade} setups (${best.winRate.toFixed(0)}%). Worth revisiting how the pillars are weighted.`);
    } else {
      insights.push(`Grading is tracking reality — ${best.grade} setups win ${best.winRate.toFixed(0)}% of the time versus ${worst.winRate.toFixed(0)}% for ${worst.grade}.`);
    }
  }
  const structArr = computeStructureBreakdown(trades).filter((s) => s.count >= 2);
  if (structArr.length) {
    const top = structArr[0];
    insights.push(`${top.structure} has been your strongest structure — ${top.winRate.toFixed(0)}% win rate, average P&L of ${fmtMoney(top.avgPnl)} across ${top.count} trades.`);
    const bottom = structArr[structArr.length - 1];
    if (bottom.avgPnl < 0 && bottom.structure !== top.structure) {
      insights.push(`${bottom.structure} has cost you on average — consider sizing down or skipping it until the pattern changes.`);
    }
  }
  const wins = closed.filter((t) => (t.pnl || 0) > 0);
  const losses = closed.filter((t) => (t.pnl || 0) <= 0);
  if (wins.length >= 2 && losses.length >= 2) {
    let maxDiff = -Infinity, maxPillar = null;
    PILLARS.forEach((p) => {
      const avgWin = wins.reduce((s, t) => s + ((t.pillars && t.pillars[p.key]) || 0), 0) / wins.length;
      const avgLoss = losses.reduce((s, t) => s + ((t.pillars && t.pillars[p.key]) || 0), 0) / losses.length;
      const diff = avgWin - avgLoss;
      if (diff > maxDiff) { maxDiff = diff; maxPillar = p.label; }
    });
    if (maxPillar && maxDiff > 1) {
      insights.push(`${maxPillar} shows the clearest gap between your winners and losers — it's the pillar most worth trusting in your scoring.`);
    }
  }
  if (!insights.length) insights.push('Not enough signal yet to call a pattern — keep logging.');
  return insights;
}

function getInputStyle(C) {
  return {
    background: C.panelAlt, border: `1px solid ${C.borderLight}`, color: C.text,
    borderRadius: 6, padding: '8px 10px', fontSize: 14.5, width: '100%', outline: 'none',
  };
}
function Field({ label, children }) {
  const C = useContext(ThemeContext);
  return (
    <div className="mb-3">
      <div style={{ color: C.textDim, fontSize: 12.5 }} className="mb-1 uppercase tracking-wide">{label}</div>
      {children}
    </div>
  );
}
function PillarSlider({ label, value, onChange }) {
  const C = useContext(ThemeContext);
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span style={{ color: C.textDim, fontSize: 13 }}>{label}</span>
        <span style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{value}/20</span>
      </div>
      <input type="range" min="0" max="20" value={value} onChange={(e) => onChange(Number(e.target.value))} className="oa-slider w-full" style={{ accentColor: C.accent }} />
    </div>
  );
}
function StatCard({ label, value, sub, valueColor }) {
  const C = useContext(ThemeContext);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg px-4 py-3 flex-1 min-w-[130px]">
      <div style={{ color: C.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-1.5">{label}</div>
      <div style={{ color: valueColor || C.text, fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-semibold">{value}</div>
      {sub && <div style={{ color: C.textFaint }} className="text-xs mt-1">{sub}</div>}
    </div>
  );
}
function EmptyState({ onAdd }) {
  const C = useContext(ThemeContext);
  return (
    <div style={{ border: `1px dashed ${C.borderLight}`, borderRadius: 10 }} className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: 2 }} className="mb-3">NO TRADES LOGGED</div>
      <div style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }} className="text-xl mb-2">The journal starts empty on purpose.</div>
      <div style={{ color: C.textDim, maxWidth: 420 }} className="text-sm mb-6">Run an analysis and log a trade straight from it, or add one manually here. Close it out when it resolves and calibration starts building.</div>
      <button onClick={onAdd} style={{ background: C.accent, color: '#14171C' }} className="flex items-center gap-2 px-5 py-2.5 rounded-md font-medium text-sm">
        <Plus size={16} /> Log first trade
      </button>
    </div>
  );
}

function GradeLadder({ data }) {
  const C = useContext(ThemeContext);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-4">
      <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-4">Grade Ladder — win rate by conviction band</div>
      <div className="flex flex-col gap-2.5">
        {data.map((d) => (
          <div key={d.grade} className="flex items-center gap-3">
            <div style={{ color: gradeColor(d.grade, C), fontFamily: "'Space Grotesk', sans-serif", width: 30 }} className="text-sm font-bold text-right">{d.grade}</div>
            <div style={{ background: C.panelAlt, borderRadius: 4 }} className="flex-1 h-6 relative overflow-hidden">
              <div style={{ width: `${d.count ? d.winRate : 0}%`, background: gradeColor(d.grade, C), opacity: d.count ? 0.85 : 0, transition: 'width 0.4s ease' }} className="h-full rounded" />
              <div style={{ color: d.count ? '#0B0D10' : C.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }} className="absolute inset-0 flex items-center px-2">
                {d.count ? `${d.winRate.toFixed(0)}%` : 'no trades yet'}
              </div>
            </div>
            <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, width: 46 }} className="text-right">{d.count} trd</div>
            <div style={{ color: d.avgPnl >= 0 ? C.positive : C.negative, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, width: 64 }} className="text-right">{d.count ? fmtMoney(d.avgPnl) : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function PnlChart({ data }) {
  const C = useContext(ThemeContext);
  if (!data.length) {
    return <div style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.textFaint }} className="rounded-lg p-4 flex items-center justify-center h-[220px] text-sm">Cumulative P&L appears once trades are closed.</div>;
  }
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-4">
      <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-2">Cumulative P&L</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" stroke={C.textFaint} fontSize={10} tickLine={false} axisLine={{ stroke: C.border }} />
          <YAxis stroke={C.textFaint} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => fmtMoney(v)} width={70} />
          <Tooltip contentStyle={{ background: C.panelAlt, border: `1px solid ${C.borderLight}`, borderRadius: 6, fontSize: 12 }} labelStyle={{ color: C.textDim }} formatter={(v) => [fmtMoney(v), 'Cumulative P&L']} />
          <Line type="monotone" dataKey="cum" stroke={C.accent} strokeWidth={2} dot={{ r: 3, fill: C.accent }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
function StructureChart({ data }) {
  const C = useContext(ThemeContext);
  if (!data.length) {
    return <div style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.textFaint }} className="rounded-lg p-4 flex items-center justify-center h-[220px] text-sm">Structure performance appears once trades are closed.</div>;
  }
  const top = data.slice(0, 6);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-4">
      <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-2">Avg P&L by structure</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={top} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid stroke={C.border} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" stroke={C.textFaint} fontSize={10} tickFormatter={(v) => fmtMoney(v)} />
          <YAxis type="category" dataKey="structure" stroke={C.textFaint} fontSize={10} width={140} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: C.panelAlt, border: `1px solid ${C.borderLight}`, borderRadius: 6, fontSize: 12 }} labelStyle={{ color: C.text }} formatter={(v) => [fmtMoney(v), 'Avg P&L']} />
          <Bar dataKey="avgPnl" radius={[0, 3, 3, 0]}>
            {top.map((d, i) => <Cell key={i} fill={d.avgPnl >= 0 ? C.positive : C.negative} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function InsightsPanel({ insights }) {
  const C = useContext(ThemeContext);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-4">
      <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-3">Calibration notes</div>
      <div className="flex flex-col gap-3">
        {insights.map((ins, i) => (
          <div key={i} className="flex gap-2.5 items-start">
            <div style={{ color: C.accent, marginTop: 3, flexShrink: 0 }} className="text-xs">◆</div>
            <div style={{ color: C.text, fontSize: 13.5, lineHeight: 1.5 }}>{ins}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradeRow({ trade, expanded, onToggle, onCloseTrade, onDelete }) {
  const C = useContext(ThemeContext);
  const isOpen = trade.status === 'open';
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <div onClick={onToggle} className="flex items-center gap-2 px-3 py-3 cursor-pointer hover:bg-black/10">
        <div style={{ width: 8, height: 8, borderRadius: 999, background: gradeColor(trade.grade, C), flexShrink: 0 }} />
        <div style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, width: 56 }} className="text-sm">{trade.ticker}</div>
        <div style={{ color: C.textDim }} className="text-xs flex-1 truncate hidden sm:block">{trade.structure}</div>
        <div style={{ color: gradeColor(trade.grade, C), fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs font-bold w-8 text-center">{trade.grade}</div>
        <div style={{ color: C.textFaint, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs w-16 hidden md:block">{fmtDate(trade.dateEntered)}</div>
        {isOpen ? (
          <span style={{ background: C.accentSoft, color: C.accent }} className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide">Open</span>
        ) : (
          <div style={{ color: (trade.pnl || 0) >= 0 ? C.positive : C.negative, fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm font-medium w-20 text-right">{fmtMoney(trade.pnl)}</div>
        )}
        {expanded ? <ChevronUp size={16} color={C.textFaint} /> : <ChevronDown size={16} color={C.textFaint} />}
      </div>
      {expanded && (
        <div style={{ background: C.panelAlt }} className="px-4 pb-4 pt-1 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 mb-3" style={{ color: C.textDim, fontSize: 12.5 }}>
            <div><span style={{ color: C.textFaint }}>Direction </span>{trade.direction}</div>
            <div><span style={{ color: C.textFaint }}>Strikes </span>{trade.strikes || '—'}</div>
            <div><span style={{ color: C.textFaint }}>Expiration </span>{fmtDate(trade.expiration)}</div>
            <div><span style={{ color: C.textFaint }}>Score </span>{trade.convictionScore}/100</div>
            <div><span style={{ color: C.textFaint }}>Cost/credit </span>{fmtMoney(trade.cost)}</div>
            <div><span style={{ color: C.textFaint }}>Max gain </span>{fmtMoney(trade.maxGain)}</div>
            <div><span style={{ color: C.textFaint }}>Max loss </span>{fmtMoney(trade.maxLoss)}</div>
            <div><span style={{ color: C.textFaint }}>Invalidation </span>{trade.invalidation || '—'}</div>
          </div>
          {trade.notes && <div style={{ color: C.text }} className="mb-2"><span style={{ color: C.textFaint }}>Thesis: </span>{trade.notes}</div>}
          {trade.status === 'closed' && trade.postMortem && <div style={{ color: C.text }} className="mb-2"><span style={{ color: C.textFaint }}>Outcome: </span>{trade.postMortem}</div>}
          <div className="flex gap-2 mt-3">
            {isOpen && (
              <button onClick={() => onCloseTrade(trade)} style={{ background: C.accent, color: '#14171C' }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium">
                <Check size={13} /> Close trade
              </button>
            )}
            <button onClick={() => onDelete(trade.id)} style={{ color: C.negative, border: `1px solid ${C.negative}` }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddTradeModal({ onClose, onSave, initial }) {
  const C = useContext(ThemeContext);
  const [ticker, setTicker] = useState(initial?.ticker || '');
  const [direction, setDirection] = useState(initial?.direction || 'bullish');
  const [structure, setStructure] = useState(initial?.structure || STRUCTURES[0]);
  const [strikes, setStrikes] = useState(initial?.strikes || '');
  const [dateEntered, setDateEntered] = useState(new Date().toISOString().slice(0, 10));
  const [expiration, setExpiration] = useState(initial?.expiration || '');
  const [pillars, setPillars] = useState(initial?.pillars || { trend: 10, levelIntegrity: 10, momentum: 10, volRegime: 10, catalyst: 10 });
  const [cost, setCost] = useState(initial?.cost ?? '');
  const [maxGain, setMaxGain] = useState(initial?.maxGain ?? '');
  const [maxLoss, setMaxLoss] = useState(initial?.maxLoss ?? '');
  const [invalidation, setInvalidation] = useState(initial?.invalidation || '');
  const [notes, setNotes] = useState(initial?.notes || '');

  const score = PILLARS.reduce((s, p) => s + (pillars[p.key] || 0), 0);
  const grade = gradeFromScore(score);
  const canSave = ticker.trim().length > 0;
  const inputStyle = getInputStyle(C);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: uid(), ticker: ticker.trim().toUpperCase(), direction, structure: structure.trim(), strikes: strikes.trim(),
      dateEntered, expiration, pillars, convictionScore: score, grade,
      cost: cost === '' ? null : Number(cost), maxGain: maxGain === '' ? null : Number(maxGain), maxLoss: maxLoss === '' ? null : Number(maxLoss),
      invalidation: invalidation.trim(), notes: notes.trim(), status: 'open', exitDate: null, pnl: null, postMortem: '',
    });
  };

  return (
    <div style={{ background: 'rgba(0,0,0,0.6)' }} className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 overflow-y-auto">
      <div style={{ background: C.panel, border: `1px solid ${C.borderLight}`, maxHeight: '92vh' }} className="rounded-xl w-full max-w-lg overflow-y-auto my-4">
        <div style={{ borderBottom: `1px solid ${C.border}`, background: C.panel }} className="flex items-center justify-between px-5 py-4 sticky top-0">
          <div style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }} className="text-lg font-semibold">Log a trade</div>
          <button onClick={onClose} style={{ color: C.textDim }}><X size={20} /></button>
        </div>
        <div className="px-5 py-4">
          {initial && (
            <div style={{ background: C.accentSoft, color: C.accent, fontSize: 12, borderRadius: 6, padding: '8px 10px' }} className="mb-3">
              Pre-filled from your {initial.ticker} analysis — adjust anything before saving.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ticker"><input style={inputStyle} value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL" /></Field>
            <Field label="Direction">
              <select style={inputStyle} value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="bullish">Bullish</option><option value="bearish">Bearish</option><option value="neutral">Neutral</option>
              </select>
            </Field>
          </div>
          <Field label="Structure">
            <input list="oa-structure-list" style={inputStyle} value={structure} onChange={(e) => setStructure(e.target.value)} placeholder="e.g. Bull Call Debit Spread" />
            <datalist id="oa-structure-list">{STRUCTURES.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Strikes"><input style={inputStyle} value={strikes} onChange={(e) => setStrikes(e.target.value)} placeholder="150C / 155C" /></Field>
            <Field label="Expiration"><input type="date" style={inputStyle} value={expiration} onChange={(e) => setExpiration(e.target.value)} /></Field>
          </div>
          <Field label="Date entered"><input type="date" style={inputStyle} value={dateEntered} onChange={(e) => setDateEntered(e.target.value)} /></Field>

          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 14 }}>
            <div className="flex items-center justify-between mb-3">
              <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase">Conviction engine</div>
              <div style={{ color: gradeColor(grade, C), fontFamily: "'Space Grotesk', sans-serif" }} className="text-sm font-bold">{score}/100 · {grade}</div>
            </div>
            {PILLARS.map((p) => <PillarSlider key={p.key} label={p.label} value={pillars[p.key]} onChange={(v) => setPillars({ ...pillars, [p.key]: v })} />)}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-1">
            <Field label="Cost / credit $"><input type="number" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" /></Field>
            <Field label="Max gain $"><input type="number" style={inputStyle} value={maxGain} onChange={(e) => setMaxGain(e.target.value)} placeholder="0" /></Field>
            <Field label="Max loss $"><input type="number" style={inputStyle} value={maxLoss} onChange={(e) => setMaxLoss(e.target.value)} placeholder="0" /></Field>
          </div>
          <Field label="Invalidation price"><input style={inputStyle} value={invalidation} onChange={(e) => setInvalidation(e.target.value)} placeholder="Thesis breaks below $X" /></Field>
          <Field label="Thesis notes"><textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why this trade, in your own words" /></Field>

          <button onClick={handleSave} disabled={!canSave} style={{ background: canSave ? C.accent : C.borderLight, color: canSave ? '#14171C' : C.textFaint }} className="w-full py-2.5 rounded-md font-medium text-sm mt-2">
            Save trade
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseTradeModal({ trade, onClose, onSave }) {
  const C = useContext(ThemeContext);
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));
  const [pnl, setPnl] = useState('');
  const [postMortem, setPostMortem] = useState('');
  const canSave = pnl !== '' && !isNaN(Number(pnl));
  const inputStyle = getInputStyle(C);
  return (
    <div style={{ background: 'rgba(0,0,0,0.6)' }} className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div style={{ background: C.panel, border: `1px solid ${C.borderLight}` }} className="rounded-xl w-full max-w-md">
        <div style={{ borderBottom: `1px solid ${C.border}` }} className="flex items-center justify-between px-5 py-4">
          <div style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }} className="text-lg font-semibold">Close {trade.ticker} · {trade.structure}</div>
          <button onClick={onClose} style={{ color: C.textDim }}><X size={20} /></button>
        </div>
        <div className="px-5 py-4">
          <Field label="Exit date"><input type="date" style={inputStyle} value={exitDate} onChange={(e) => setExitDate(e.target.value)} /></Field>
          <Field label="Realized P&L $ (negative for a loss)"><input type="number" style={inputStyle} value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder="e.g. 240 or -180" /></Field>
          <Field label="What actually happened"><textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={postMortem} onChange={(e) => setPostMortem(e.target.value)} placeholder="Did the thesis play out? What would you change?" /></Field>
          <button onClick={() => canSave && onSave({ exitDate, pnl: Number(pnl), postMortem: postMortem.trim() })} disabled={!canSave} style={{ background: canSave ? C.accent : C.borderLight, color: canSave ? '#14171C' : C.textFaint }} className="w-full py-2.5 rounded-md font-medium text-sm mt-1">
            Save outcome
          </button>
        </div>
      </div>
    </div>
  );
}

function StructureTable({ structure }) {
  const C = useContext(ThemeContext);
  const rows = [
    { label: 'Resistance 2', d: structure.resistance2 },
    { label: 'Resistance 1', d: structure.resistance1 },
    { label: 'Current', d: structure.current != null ? { price: structure.current, touches: null, status: null } : null, isCurrent: true },
    { label: 'Support 1', d: structure.support1 },
    { label: 'Support 2', d: structure.support2 },
  ].filter((r) => r.d && r.d.price !== null && r.d.price !== undefined);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-4">
      <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-3">Structure map</div>
      <div className="flex flex-col gap-1.5 mb-3">
        {rows.map((r, i) => (
          <div key={i} style={{ background: r.isCurrent ? C.accentSoft : 'transparent', borderRadius: 6, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center' }} className="px-2 py-1.5">
            <div style={{ color: r.isCurrent ? C.accent : C.textDim, fontSize: 14.5, fontWeight: r.isCurrent ? 600 : 400 }}>{r.label}</div>
            <div style={{ color: r.isCurrent ? C.accent : C.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 600 }}>${r.d.price}</div>
            <div style={{ color: C.textFaint, fontSize: 12.5 }}>{r.d.touches != null ? `${r.d.touches}x` : r.d.status || ''}</div>
          </div>
        ))}
      </div>
      <div style={{ color: C.textFaint, fontSize: 13, borderTop: `1px solid ${C.border}`, paddingTop: 10 }} className="flex flex-wrap gap-x-4 gap-y-1">
        {structure.rangeLow != null && structure.rangeHigh != null && <span>Range: ${structure.rangeLow}–${structure.rangeHigh}</span>}
        {structure.typicalSwingDollars != null && <span>Typical swing: ${structure.typicalSwingDollars} ({structure.typicalSwingPercent}%)</span>}
        {structure.expectedMove != null && <span>Expected move: ±${structure.expectedMove}</span>}
      </div>
    </div>
  );
}
function ConvictionPillars({ conviction }) {
  const C = useContext(ThemeContext);
  const vals = [
    { label: 'Trend Structure', value: conviction.trend },
    { label: 'Level Integrity', value: conviction.levelIntegrity },
    { label: 'Momentum & Participation', value: conviction.momentum },
    { label: 'Volatility Regime Fit', value: conviction.volRegimeFit },
    { label: 'Catalyst Environment', value: conviction.catalyst },
  ];
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase">Conviction score</div>
        <div style={{ color: gradeColor(conviction.grade, C), fontFamily: "'Space Grotesk', sans-serif" }} className="text-xl font-bold">{conviction.total}/100 · {conviction.grade}</div>
      </div>
      <div className="flex flex-col gap-2 mb-3">
        {vals.map((p) => (
          <div key={p.label} className="flex items-center gap-2.5">
            <div style={{ color: C.textDim, fontSize: 13, width: 160 }} className="flex-shrink-0">{p.label}</div>
            <div style={{ background: C.panelAlt, borderRadius: 3 }} className="flex-1 h-3 overflow-hidden">
              <div style={{ width: `${(p.value / 20) * 100}%`, background: gradeColor(conviction.grade, C) }} className="h-full" />
            </div>
            <div style={{ color: C.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, width: 36 }} className="text-right">{p.value}/20</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-2">
        <span style={{ background: C.accentSoft, color: C.accent }} className="text-[11px] px-2 py-0.5 rounded-full capitalize">{conviction.direction}</span>
        <span style={{ background: C.panelAlt, color: C.textDim }} className="text-[11px] px-2 py-0.5 rounded-full capitalize">Vol: {conviction.volatility}</span>
      </div>
      <div style={{ color: C.text, fontSize: 15 }}>{conviction.rationale}</div>
    </div>
  );
}
function TradeCard({ trade, onLog, logged, asOf }) {
  const C = useContext(ThemeContext);
  const dte = computeDTE(asOf, trade.expiration);
  const estTag = trade.estimated ? ' (est.)' : '';
  return (
    <div style={{ background: C.panel, border: `1px solid ${trade.bestFit ? C.accent : C.border}` }} className="rounded-lg p-4 flex-1 min-w-[260px]">
      <div className="flex items-center justify-between mb-2">
        <div style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }} className="text-base font-semibold">{trade.name}</div>
        {trade.bestFit && <span style={{ background: C.accentSoft, color: C.accent }} className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide">Best fit</span>}
      </div>
      <div style={{ color: C.textDim, fontSize: 15 }} className="mb-2">{trade.plainEnglish}</div>
      <div style={{ color: C.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13.5 }} className="mb-1.5">{trade.structureDetail}</div>
      {trade.expiration && (
        <div style={{ background: C.accentSoft, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }} className="rounded px-2 py-1 mb-3 inline-block">
          Exp {fmtDate(trade.expiration)}{dte != null ? ` · ${dte} DTE` : ''}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mb-3" style={{ fontSize: 14.5 }}>
        <div><span style={{ color: C.textFaint }}>{trade.type === 'credit' ? 'Credit' : 'Cost'}{estTag} </span><span style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(trade.costOrCredit)}</span></div>
        <div><span style={{ color: C.textFaint }}>Prob. profit{estTag} </span><span style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>{trade.probProfit != null ? `${trade.probProfit}%` : '—'}</span></div>
        <div><span style={{ color: C.textFaint }}>Max gain{estTag} </span><span style={{ color: C.positive, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(trade.maxGain)}</span></div>
        <div><span style={{ color: C.textFaint }}>Max loss{estTag} </span><span style={{ color: C.negative, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(trade.maxLoss)}</span></div>
        <div className="col-span-2"><span style={{ color: C.textFaint }}>Breakeven{estTag} </span><span style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtPrice(trade.breakeven)}</span></div>
      </div>
      {trade.whyStrikes && <div style={{ color: C.textDim, fontSize: 14, marginBottom: 8 }}><span style={{ color: C.textFaint }}>Why these strikes: </span>{trade.whyStrikes}</div>}
      {trade.invalidation != null && <div style={{ color: C.textDim, fontSize: 14, marginBottom: 10 }}><span style={{ color: C.textFaint }}>Invalidation: </span>{fmtPrice(trade.invalidation)}</div>}
      <button onClick={() => !logged && onLog()} disabled={logged} style={{ background: logged ? C.positiveSoft : C.accent, color: logged ? C.positive : '#14171C' }} className="w-full py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5">
        {logged ? (<><Check size={13} /> Logged to journal</>) : (<><Plus size={13} /> Log this trade</>)}
      </button>
    </div>
  );
}
function computeStopPlan(trade) {
  const isCredit = trade.type === 'credit';
  const premiumMultiple = isCredit ? 2 : 0.5;
  const premiumTrigger = trade.costOrCredit != null ? +(trade.costOrCredit * premiumMultiple).toFixed(2) : null;
  const premiumRule = isCredit
    ? `Buy back the spread if it costs ${premiumTrigger != null ? fmtMoney(premiumTrigger) : 'roughly 2x the credit received'} or more to close — that's a 100% loss of the credit collected.`
    : `Exit if the position's value falls to ${premiumTrigger != null ? fmtMoney(premiumTrigger) : 'about half the entry cost'} — a 50% loss of the premium paid.`;
  const priceRule = trade.invalidation != null
    ? `Exit if the underlying closes past ${fmtPrice(trade.invalidation)} — the level that breaks this trade's thesis.`
    : 'No invalidation price is set for this trade — pin one from the structure map before entering.';
  return { premiumRule, priceRule };
}

const STOP_LOSS_STEPS = [
  "Write down both triggers before you enter — the price level and the premium level below. Don't rely on remembering it mid-trade.",
  "Most brokers won't reliably fill a true stop order on a multi-leg spread — wide bid-ask spreads cause bad fills. Set a price alert on the underlying at the invalidation level instead of a broker-side stop.",
  "For single-leg trades (a long call or put), a stop-limit order on the option itself works — set the trigger a few cents above your target exit and the limit a few cents below it, so a gap doesn't skip your fill.",
  "When the alert fires, exit at the market. A spread you can't get filled on at your price isn't protecting you — don't wait for a better print once the level breaks.",
  "If you won't be at a screen, size the position so the max loss already shown above is one you can hold to expiration without checking your phone.",
  "Log the exit in the Journal the same day, win or loss — that's what makes next month's Grade Ladder mean something.",
];

function StopLossPlaybook({ trades }) {
  const C = useContext(ThemeContext);
  if (!trades || !trades.length) return null;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-4">
      <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-2">Stop-loss playbook</div>
      <div style={{ color: C.text, fontSize: 15, lineHeight: 1.6 }} className="mb-4">
        Options need two triggers, not one — a price level on the underlying (your thesis breaking) and a premium level on the position itself (decay eating the trade even if price hasn't broken yet). Act on whichever hits first.
      </div>
      <div className="flex flex-col gap-3 mb-4">
        {trades.map((t, i) => {
          const plan = computeStopPlan(t);
          return (
            <div key={i} style={{ background: C.panelAlt, borderRadius: 8 }} className="p-3">
              <div style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }} className="text-sm font-semibold mb-1.5">{t.name}</div>
              <div style={{ color: C.textDim, fontSize: 14, marginBottom: 4 }}><span style={{ color: C.accent }}>Price trigger — </span>{plan.priceRule}</div>
              <div style={{ color: C.textDim, fontSize: 14 }}><span style={{ color: C.accent }}>Premium trigger — </span>{plan.premiumRule}</div>
            </div>
          );
        })}
      </div>
      <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-2">How to actually place it</div>
      <div className="flex flex-col gap-2">
        {STOP_LOSS_STEPS.map((step, i) => (
          <div key={i} className="flex gap-2.5 items-start">
            <div style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, width: 18, flexShrink: 0 }}>{i + 1}.</div>
            <div style={{ color: C.text, fontSize: 14, lineHeight: 1.5 }}>{step}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function ManagementPanel({ management }) {
  const C = useContext(ThemeContext);
  if (!management) return null;
  const rows = [
    ['Take profit at', management.takeProfitPct != null ? `${management.takeProfitPct}% of max` : null],
    ['Cut trigger', management.cutTrigger],
    ['Time exit', management.timeExit],
    ['Suggested size', management.sizePct != null ? `${management.sizePct}% of account` : null],
    ['If it goes against you', management.adjustment],
  ].filter(([, v]) => v);
  if (!rows.length) return null;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-4">
      <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-3">Management plan</div>
      <div className="flex flex-col gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3" style={{ fontSize: 14.5 }}>
            <span style={{ color: C.textFaint }}>{k}</span>
            <span style={{ color: C.text, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function ListPanel({ title, items, color, icon }) {
  const C = useContext(ThemeContext);
  if (!items || !items.length) return null;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-4">
      <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-2.5">{title}</div>
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 items-start" style={{ fontSize: 14.5 }}>
            <span style={{ color, flexShrink: 0 }}>{icon}</span>
            <span style={{ color: C.text }}>{it}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function RiskLists({ wrong, verify, gaps }) {
  const C = useContext(ThemeContext);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ListPanel title="What would make me wrong" items={wrong} color={C.negative} icon="✕" />
        <ListPanel title="Verify before entry" items={verify} color={C.accent} icon="✓" />
      </div>
      {gaps && gaps.length > 0 && <ListPanel title="Data gaps — could not verify" items={gaps} color="#C08A4A" icon="!" />}
    </div>
  );
}

function downscaleImage(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode that image file.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round((height / width) * maxDim); width = maxDim; }
          else { width = Math.round((width / height) * maxDim); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const data = dataUrl.split(',')[1];
        resolve({ mediaType: 'image/jpeg', data, previewUrl: dataUrl });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function AnalyzeInput({ ticker, setTicker, image, setImage, onSubmit, canSubmit }) {
  const C = useContext(ThemeContext);
  const inputStyle = getInputStyle(C);
  const fileRef = useRef(null);
  const [imgErr, setImgErr] = useState('');
  const [processing, setProcessing] = useState(false);
  const handleFile = async (file) => {
    if (!file) return;
    setImgErr('');
    setProcessing(true);
    try {
      const img = await downscaleImage(file);
      setImage(img);
    } catch (e) {
      setImgErr(e.message || 'Could not process that image — try a different screenshot.');
    } finally {
      setProcessing(false);
    }
  };
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-5">
      <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-3">Drop a ticker, a chart, or both</div>
      <div className="mb-4">
        <input style={inputStyle} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="AAPL, TSLA, SPY…" onKeyDown={(e) => e.key === 'Enter' && canSubmit && onSubmit()} />
      </div>
      {image ? (
        <div className="relative mb-4 inline-block">
          <img src={image.previewUrl} alt="chart" style={{ maxHeight: 160, borderRadius: 8, border: `1px solid ${C.borderLight}` }} />
          <button onClick={() => setImage(null)} style={{ background: C.negative, color: '#fff' }} className="absolute -top-2 -right-2 rounded-full w-6 h-6 flex items-center justify-center"><X size={13} /></button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} disabled={processing} style={{ border: `1px dashed ${C.borderLight}`, color: C.textDim }} className="w-full py-6 rounded-lg flex flex-col items-center gap-1.5 text-sm mb-4">
          <ImageIcon size={20} /> {processing ? 'Processing…' : 'Upload a chart screenshot'}
        </button>
      )}
      {imgErr && <div style={{ color: C.negative, fontSize: 12 }} className="mb-3">{imgErr}</div>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <button onClick={onSubmit} disabled={!canSubmit} style={{ background: canSubmit ? C.accent : C.borderLight, color: canSubmit ? '#14171C' : C.textFaint }} className="w-full py-2.5 rounded-md font-medium text-sm flex items-center justify-center gap-2">
        <Sparkles size={15} /> Run analysis
      </button>
    </div>
  );
}
const LOADING_MESSAGES = ['Reading price structure…', 'Pulling live price and range…', 'Checking earnings and news…', 'Scoring conviction…', 'Building trade structures…'];
function LoadingState() {
  const C = useContext(ThemeContext);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % LOADING_MESSAGES.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg py-16 flex flex-col items-center justify-center gap-3">
      <Loader2 className="animate-spin" size={22} color={C.accent} />
      <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }}>{LOADING_MESSAGES[idx]}</div>
    </div>
  );
}
function ErrorState({ error, raw, onRetry }) {
  const C = useContext(ThemeContext);
  const [showRaw, setShowRaw] = useState(true);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.negative}` }} className="rounded-lg p-5">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={16} color={C.negative} />
        <div style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }} className="font-semibold">Analysis didn't come back clean</div>
      </div>
      <div style={{ color: C.textDim, fontSize: 15 }} className="mb-3">{error}</div>
      {raw && <button onClick={() => setShowRaw(!showRaw)} style={{ color: C.accent }} className="text-xs mb-2">{showRaw ? 'Hide' : 'Show'} raw response</button>}
      {showRaw && <pre style={{ background: C.panelAlt, color: C.textDim, fontSize: 11, padding: 10, borderRadius: 6, overflowX: 'auto', maxHeight: 200 }}>{raw}</pre>}
      <button onClick={onRetry} style={{ background: C.accent, color: '#14171C' }} className="px-4 py-2 rounded-md text-sm font-medium mt-2">Try again</button>
    </div>
  );
}
function AnalysisResult({ result, onLogTrade, loggedKeys, onNewAnalysis }) {
  const C = useContext(ThemeContext);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <div style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold">{result.ticker}</div>
            {result.price != null && <div style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }} className="text-lg">${result.price}</div>}
            <div style={{ color: C.textFaint, fontSize: 12 }}>{result.timeframe} · {result.asOf}</div>
          </div>
          <div style={{ color: C.textDim, fontSize: 16 }} className="mt-1">{result.oneLinerRead}</div>
        </div>
        <button onClick={onNewAnalysis} style={{ color: C.textDim, border: `1px solid ${C.border}` }} className="text-xs px-3 py-1.5 rounded-md whitespace-nowrap flex items-center gap-1.5 flex-shrink-0"><ArrowLeft size={13} /> New</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StructureTable structure={result.structure || {}} />
        <ConvictionPillars conviction={result.conviction || {}} />
      </div>

      {result.backAnalysis && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-4">
          <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-2">Back-analysis</div>
          <div style={{ color: C.text, fontSize: 15.5, lineHeight: 1.6 }}>{result.backAnalysis}</div>
        </div>
      )}

      {result.catalysts && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase">Catalysts & news</div>
            <span style={{ background: result.catalysts.earningsInWindow ? C.negativeSoft : C.positiveSoft, color: result.catalysts.earningsInWindow ? C.negative : C.positive }} className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide">
              Earnings {result.catalysts.earningsInWindow ? 'inside window' : 'clear'}
            </span>
          </div>
          <div style={{ color: C.textDim, fontSize: 14.5 }} className="mb-1.5">Next earnings: {result.catalysts.earningsDate || 'unconfirmed'}</div>
          {result.catalysts.news && <div style={{ color: C.text, fontSize: 15 }} className="mb-1.5">{result.catalysts.news}</div>}
          {result.catalysts.impact && <div style={{ color: C.accent, fontSize: 14.5 }}>{result.catalysts.impact}</div>}
        </div>
      )}

      <div>
        <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-2.5">Trade structures</div>
        <div className="flex flex-wrap gap-3">
          {(result.trades || []).map((t, i) => (
            <TradeCard key={i} trade={t} onLog={() => onLogTrade(t, i)} logged={loggedKeys.has(`${result.ticker}-${i}`)} asOf={result.asOf} />
          ))}
        </div>
      </div>

      <StopLossPlaybook trades={result.trades} />

      <ManagementPanel management={result.management} />
      <RiskLists wrong={result.whatWouldMakeMeWrong} verify={result.verifyBeforeEntry} gaps={result.dataGaps} />

      <div style={{ color: C.textFaint, fontSize: 11, textAlign: 'center' }} className="mt-2 mb-4">
        Technical analysis and options education, not financial advice. Options carry real risk of total loss. Every decision is yours.
      </div>
    </div>
  );
}

function AnalyzeView({ onAddTrade }) {
  const [ticker, setTicker] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawText, setRawText] = useState('');
  const [result, setResult] = useState(null);
  const [loggedKeys, setLoggedKeys] = useState(new Set());
  const [addModalInitial, setAddModalInitial] = useState(null);
  const [pendingKey, setPendingKey] = useState(null);

  const canSubmit = (ticker.trim().length > 0 || !!image) && !loading;

  const runIt = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const cleanTicker = ticker.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
      const parsed = await runAnalysis({ ticker: cleanTicker, image });
      setResult(parsed);
      setLoggedKeys(new Set());
    } catch (e) {
      setError(e.message || 'Something went wrong reaching the analysis engine.');
      setRawText(e.raw || `${e.name || 'Error'}: ${e.message || 'no further detail'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestLog = (trade, idx) => {
    setAddModalInitial({
      ticker: result.ticker,
      direction: result.conviction?.direction || 'bullish',
      structure: trade.name,
      strikes: trade.structureDetail || '',
      pillars: {
        trend: result.conviction?.trend ?? 10,
        levelIntegrity: result.conviction?.levelIntegrity ?? 10,
        momentum: result.conviction?.momentum ?? 10,
        volRegime: result.conviction?.volRegimeFit ?? 10,
        catalyst: result.conviction?.catalyst ?? 10,
      },
      cost: trade.costOrCredit ?? '',
      maxGain: trade.maxGain ?? '',
      maxLoss: trade.maxLoss ?? '',
      invalidation: trade.invalidation != null ? String(trade.invalidation) : '',
      expiration: trade.expiration || '',
      notes: [trade.plainEnglish, trade.whyStrikes].filter(Boolean).join(' — '),
    });
    setPendingKey(`${result.ticker}-${idx}`);
  };

  const handleSaveLoggedTrade = (trade) => {
    onAddTrade(trade);
    if (pendingKey) setLoggedKeys((prev) => new Set(prev).add(pendingKey));
    setAddModalInitial(null);
    setPendingKey(null);
  };

  return (
    <div>
      {!result && !loading && !error && <AnalyzeInput ticker={ticker} setTicker={setTicker} image={image} setImage={setImage} onSubmit={runIt} canSubmit={canSubmit} />}
      {loading && <LoadingState />}
      {error && !loading && <ErrorState error={error} raw={rawText} onRetry={() => setError(null)} />}
      {result && !loading && (
        <AnalysisResult result={result} loggedKeys={loggedKeys} onLogTrade={handleRequestLog} onNewAnalysis={() => { setResult(null); setTicker(''); setImage(null); setError(null); }} />
      )}
      {addModalInitial && <AddTradeModal initial={addModalInitial} onClose={() => { setAddModalInitial(null); setPendingKey(null); }} onSave={handleSaveLoggedTrade} />}
    </div>
  );
}

function JournalView({ trades, onAddTrade, onCloseTrade, onDeleteTrade }) {
  const C = useContext(ThemeContext);
  const [showAdd, setShowAdd] = useState(false);
  const [closingTrade, setClosingTrade] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all');

  const stats = useMemo(() => computeStats(trades), [trades]);
  const gradeData = useMemo(() => computeGradeBreakdown(trades), [trades]);
  const structData = useMemo(() => computeStructureBreakdown(trades), [trades]);
  const cumData = useMemo(() => computeCumulativePnl(trades), [trades]);
  const insights = useMemo(() => computeInsights(trades), [trades]);
  const visibleTrades = useMemo(() => {
    const sorted = [...trades].sort((a, b) => new Date(b.dateEntered) - new Date(a.dateEntered));
    if (filter === 'open') return sorted.filter((t) => t.status === 'open');
    if (filter === 'closed') return sorted.filter((t) => t.status === 'closed');
    return sorted;
  }, [trades, filter]);

  if (trades.length === 0) {
    return (
      <>
        <EmptyState onAdd={() => setShowAdd(true)} />
        {showAdd && <AddTradeModal onClose={() => setShowAdd(false)} onSave={(t) => { onAddTrade(t); setShowAdd(false); }} />}
      </>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setShowAdd(true)} style={{ background: C.accent, color: '#14171C' }} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium">
          <Plus size={16} /> Log trade manually
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5 mb-5">
        <StatCard label="Total trades" value={stats.total} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="Win rate" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.closed} closed`} />
        <StatCard label="Total P&L" value={fmtMoney(stats.totalPnl)} valueColor={stats.totalPnl >= 0 ? C.positive : C.negative} />
        <StatCard label="Avg P&L / trade" value={fmtMoney(stats.avgPnl)} valueColor={stats.avgPnl >= 0 ? C.positive : C.negative} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <GradeLadder data={gradeData} />
        <InsightsPanel insights={insights} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PnlChart data={cumData} />
        <StructureChart data={structData} />
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg overflow-hidden">
        <div style={{ borderBottom: `1px solid ${C.border}` }} className="flex items-center justify-between px-4 py-3">
          <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase">Trade log</div>
          <div className="flex gap-1">
            {['all', 'open', 'closed'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? C.accentSoft : 'transparent', color: filter === f ? C.accent : C.textFaint }} className="text-xs px-2.5 py-1 rounded-md capitalize">{f}</button>
            ))}
          </div>
        </div>
        {visibleTrades.map((t) => (
          <TradeRow key={t.id} trade={t} expanded={expandedId === t.id} onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)} onCloseTrade={setClosingTrade} onDelete={onDeleteTrade} />
        ))}
      </div>
      {showAdd && <AddTradeModal onClose={() => setShowAdd(false)} onSave={(t) => { onAddTrade(t); setShowAdd(false); }} />}
      {closingTrade && <CloseTradeModal trade={closingTrade} onClose={() => setClosingTrade(null)} onSave={(outcome) => { onCloseTrade(closingTrade.id, outcome); setClosingTrade(null); }} />}
    </div>
  );
}

function AdminView() {
  const C = useContext(ThemeContext);
  const inputStyle = getInputStyle(C);
  const [key, setKey] = useState(() => getApiKey());
  const [reveal, setReveal] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const hasKey = key.trim().length > 0;
  const masked = key ? `${key.slice(0, 6)}${'•'.repeat(Math.max(0, key.length - 10))}${key.slice(-4)}` : '';

  const handleSave = () => {
    setApiKey(key.trim());
    setSavedMsg(key.trim() ? 'Key saved to this device.' : 'Key cleared.');
    setTimeout(() => setSavedMsg(''), 3000);
  };
  const handleClear = () => {
    setKey('');
    setApiKey('');
    setSavedMsg('Key cleared.');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={16} color={C.accent} />
          <div style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }} className="text-lg font-semibold">Anthropic API key</div>
        </div>
        <div style={{ color: C.textDim, fontSize: 14 }} className="mb-4">
          Paste your Anthropic API key here so "Run analysis" works without editing anything on Vercel. It's stored only in this browser's local storage and sent to this app's own <code style={{ color: C.accent }}>/api/analyze</code> endpoint with each analysis request — it's never exposed to any other site. Get a key at <span style={{ color: C.accent }}>console.anthropic.com</span>.
        </div>

        <Field label="API key">
          <div className="relative">
            <input
              style={{ ...inputStyle, paddingRight: 40 }}
              type={reveal ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? 'Hide key' : 'Reveal key'}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: C.textFaint }}
            >
              {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <div className="flex items-center gap-2 mt-1">
          <button onClick={handleSave} style={{ background: C.accent, color: '#14171C' }} className="px-4 py-2 rounded-md text-sm font-medium">Save key</button>
          {hasKey && <button onClick={handleClear} style={{ color: C.negative, border: `1px solid ${C.negative}` }} className="px-4 py-2 rounded-md text-sm">Clear key</button>}
          {savedMsg && <span style={{ color: C.positive, fontSize: 13 }}>{savedMsg}</span>}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 18, paddingTop: 14 }}>
          <div style={{ color: C.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-2">Current status</div>
          <div style={{ color: C.textDim, fontSize: 14 }}>
            {hasKey ? <>Key on this device: <span style={{ color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>{masked}</span></> : 'No key saved on this device — Run analysis will fall back to the server-side ANTHROPIC_API_KEY, if one is set.'}
          </div>
        </div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-lg p-5">
        <div style={{ color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5 }} className="uppercase mb-2">A note on security</div>
        <div style={{ color: C.textDim, fontSize: 14, lineHeight: 1.6 }}>
          This is the fast path for a single-user tool on your own device — the key lives in this browser's local storage, not in the app's source code or a public URL. For a shared or multi-device deployment, the more robust option is still setting <code style={{ color: C.accent }}>ANTHROPIC_API_KEY</code> as a server-side environment variable in Vercel, which this Admin key will override when present.
        </div>
      </div>
    </div>
  );
}

function Header({ tab, setTab, openCount, theme, toggleTheme }) {
  const C = useContext(ThemeContext);
  return (
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div>
        <div style={{ color: C.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 2 }} className="uppercase">The Options Architect</div>
        <div style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-semibold">Desk & Journal</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          aria-label="Toggle light and dark mode"
          style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.textDim }}
          className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="flex rounded-lg p-1 gap-1">
          <button onClick={() => setTab('analyze')} style={{ background: tab === 'analyze' ? C.accentSoft : 'transparent', color: tab === 'analyze' ? C.accent : C.textDim }} className="px-3.5 py-1.5 rounded-md text-sm font-medium">Analyze</button>
          <button onClick={() => setTab('journal')} style={{ background: tab === 'journal' ? C.accentSoft : 'transparent', color: tab === 'journal' ? C.accent : C.textDim }} className="px-3.5 py-1.5 rounded-md text-sm font-medium">
            Journal{openCount > 0 && <span style={{ background: C.accent, color: '#14171C' }} className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full">{openCount}</span>}
          </button>
          <button onClick={() => setTab('admin')} style={{ background: tab === 'admin' ? C.accentSoft : 'transparent', color: tab === 'admin' ? C.accent : C.textDim }} className="px-3.5 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5">
            <KeyRound size={14} /> Admin
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OptionsArchitectApp() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('analyze');
  const [theme, setTheme] = useState(() => {
    try { return window.localStorage.getItem('oa-theme') === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
  });
  const C = theme === 'dark' ? DARK : LIGHT;
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { window.localStorage.setItem('oa-theme', next); } catch (e) {}
      return next;
    });
  }, []);

  useEffect(() => {
    loadTrades().then((t) => { setTrades(t); setLoading(false); });
  }, []);

  const addTrade = useCallback((trade) => {
    setTrades((prev) => {
      const next = [trade, ...prev];
      saveTrades(next);
      return next;
    });
  }, []);
  const closeTrade = useCallback((id, outcome) => {
    setTrades((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, status: 'closed', ...outcome } : t));
      saveTrades(next);
      return next;
    });
  }, []);
  const deleteTrade = useCallback((id) => {
    setTrades((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveTrades(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={C}>
      <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }} className="p-3 sm:p-6">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
          * { box-sizing: border-box; }
          .oa-slider { -webkit-appearance: none; height: 4px; border-radius: 2px; background: ${C.borderLight}; }
          .oa-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${C.accent}; cursor: pointer; }
          .oa-slider::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: ${C.accent}; border: none; cursor: pointer; }
          ::placeholder { color: ${C.textFaint}; }
        `}</style>
        <div className="max-w-5xl mx-auto">
          <Header tab={tab} setTab={setTab} openCount={trades.filter((t) => t.status === 'open').length} theme={theme} toggleTheme={toggleTheme} />
          {loading ? (
            <div style={{ color: C.textFaint }} className="py-16 text-center text-sm">Loading…</div>
          ) : tab === 'analyze' ? (
            <AnalyzeView onAddTrade={addTrade} />
          ) : tab === 'admin' ? (
            <AdminView />
          ) : (
            <JournalView trades={trades} onAddTrade={addTrade} onCloseTrade={closeTrade} onDeleteTrade={deleteTrade} />
          )}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

export { gradeFromScore, computeStats, computeGradeBreakdown, computeStructureBreakdown, computeCumulativePnl, computeInsights, computeDTE, fmtMoney, fmtPrice, fmtDate, computeStopPlan, runAnalysis };
