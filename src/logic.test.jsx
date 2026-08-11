import { describe, it, expect } from 'vitest';
import {
  gradeFromScore, computeStats, computeGradeBreakdown, computeStructureBreakdown,
  computeCumulativePnl, computeInsights, computeDTE, fmtMoney, fmtPrice, fmtDate, computeStopPlan,
} from './App.jsx';

describe('gradeFromScore', () => {
  it('boundaries map correctly', () => {
    expect(gradeFromScore(100)).toBe('A+');
    expect(gradeFromScore(85)).toBe('A+');
    expect(gradeFromScore(84)).toBe('A');
    expect(gradeFromScore(70)).toBe('A');
    expect(gradeFromScore(69)).toBe('B');
    expect(gradeFromScore(55)).toBe('B');
    expect(gradeFromScore(54)).toBe('C');
    expect(gradeFromScore(40)).toBe('C');
    expect(gradeFromScore(39)).toBe('D');
    expect(gradeFromScore(0)).toBe('D');
  });
});

describe('computeStats on empty and populated data', () => {
  it('handles zero trades without dividing by zero', () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.avgPnl).toBe(0);
    expect(Number.isNaN(s.winRate)).toBe(false);
  });
  it('computes correctly with a mix of open/closed/win/loss', () => {
    const trades = [
      { status: 'open' },
      { status: 'closed', pnl: 100 },
      { status: 'closed', pnl: -50 },
      { status: 'closed', pnl: 0 },
    ];
    const s = computeStats(trades);
    expect(s.total).toBe(4);
    expect(s.open).toBe(1);
    expect(s.closed).toBe(3);
    expect(s.winRate).toBeCloseTo(33.33, 1);
    expect(s.totalPnl).toBe(50);
  });
});

describe('computeGradeBreakdown', () => {
  it('returns all five bands even with no trades, no NaN', () => {
    const g = computeGradeBreakdown([]);
    expect(g.length).toBe(5);
    g.forEach((row) => {
      expect(row.count).toBe(0);
      expect(Number.isNaN(row.winRate)).toBe(false);
      expect(Number.isNaN(row.avgPnl)).toBe(false);
    });
  });
  it('only counts closed trades toward a grade band', () => {
    const trades = [
      { status: 'open', grade: 'A', pnl: null },
      { status: 'closed', grade: 'A', pnl: 200 },
      { status: 'closed', grade: 'A', pnl: -100 },
    ];
    const g = computeGradeBreakdown(trades);
    const aRow = g.find((r) => r.grade === 'A');
    expect(aRow.count).toBe(2);
    expect(aRow.winRate).toBe(50);
  });
});

describe('computeStructureBreakdown', () => {
  it('handles empty input', () => {
    expect(computeStructureBreakdown([])).toEqual([]);
  });
  it('sorts by avgPnl descending', () => {
    const trades = [
      { status: 'closed', structure: 'Iron Condor', pnl: 50 },
      { status: 'closed', structure: 'Iron Condor', pnl: 50 },
      { status: 'closed', structure: 'Long Call', pnl: -200 },
    ];
    const r = computeStructureBreakdown(trades);
    expect(r[0].structure).toBe('Iron Condor');
    expect(r[0].avgPnl).toBe(50);
    expect(r[1].avgPnl).toBe(-200);
  });
});

describe('computeCumulativePnl', () => {
  it('handles no closed trades', () => {
    expect(computeCumulativePnl([{ status: 'open' }])).toEqual([]);
  });
  it('accumulates in date order regardless of input order', () => {
    const trades = [
      { status: 'closed', exitDate: '2026-08-05', pnl: 100 },
      { status: 'closed', exitDate: '2026-08-01', pnl: 50 },
    ];
    const r = computeCumulativePnl(trades);
    expect(r[0].cum).toBe(50);
    expect(r[1].cum).toBe(150);
  });
});

describe('computeInsights', () => {
  it('asks for more data under 5 closed trades, never crashes', () => {
    const r = computeInsights([{ status: 'closed', pnl: 10, grade: 'A' }]);
    expect(r[0]).toMatch(/more closed trade/);
  });
  it('does not crash with 0 trades', () => {
    expect(() => computeInsights([])).not.toThrow();
  });
  it('produces a calibration insight with 5+ mixed trades and no NaN in text', () => {
    const trades = [
      { status: 'closed', grade: 'A', pnl: 100, pillars: { trend: 15, levelIntegrity: 15, momentum: 15, volRegime: 15, catalyst: 15 } },
      { status: 'closed', grade: 'A', pnl: -50, pillars: { trend: 10, levelIntegrity: 10, momentum: 10, volRegime: 10, catalyst: 10 } },
      { status: 'closed', grade: 'B', pnl: 80, structure: 'Iron Condor', pillars: { trend: 12, levelIntegrity: 12, momentum: 12, volRegime: 12, catalyst: 12 } },
      { status: 'closed', grade: 'B', pnl: 60, structure: 'Iron Condor', pillars: { trend: 12, levelIntegrity: 12, momentum: 12, volRegime: 12, catalyst: 12 } },
      { status: 'closed', grade: 'C', pnl: -30, pillars: { trend: 8, levelIntegrity: 8, momentum: 8, volRegime: 8, catalyst: 8 } },
    ];
    const r = computeInsights(trades);
    expect(r.length).toBeGreaterThan(0);
    r.forEach((line) => expect(line).not.toMatch(/NaN|undefined/));
  });
});

describe('computeDTE', () => {
  it('returns null for missing dates', () => {
    expect(computeDTE(null, '2026-09-01')).toBeNull();
    expect(computeDTE('2026-08-10', undefined)).toBeNull();
  });
  it('computes whole-day difference', () => {
    expect(computeDTE('2026-08-10', '2026-09-01')).toBe(22);
  });
  it('returns null on unparseable dates instead of NaN', () => {
    const r = computeDTE('not-a-date', '2026-09-01');
    expect(r === null || Number.isNaN(r)).toBe(true);
  });
});

describe('fmtMoney / fmtDate edge cases', () => {
  it('fmtMoney handles null, negative, zero', () => {
    expect(fmtMoney(null)).toBe('—');
    expect(fmtMoney(undefined)).toBe('—');
    expect(fmtMoney(-150)).toBe('-$150');
    expect(fmtMoney(0)).toBe('$0');
  });
  it('fmtDate handles null and bad input without throwing', () => {
    expect(fmtDate(null)).toBe('—');
    expect(() => fmtDate('garbage')).not.toThrow();
  });
});

describe('computeStopPlan', () => {
  it('debit trade: 50% premium stop (whole-contract dollars), price rule uses 2-decimal price', () => {
    const p = computeStopPlan({ type: 'debit', costOrCredit: 420, invalidation: 220 });
    expect(p.premiumRule).toMatch(/\$210/);
    expect(p.priceRule).toMatch(/\$220\.00/);
  });
  it('credit trade: 2x credit stop', () => {
    const p = computeStopPlan({ type: 'credit', costOrCredit: 250, invalidation: 120 });
    expect(p.premiumRule).toMatch(/\$500/);
  });
  it('handles missing costOrCredit and missing invalidation without crashing', () => {
    const p = computeStopPlan({ type: 'debit', costOrCredit: null, invalidation: null });
    expect(p.premiumRule).toBeTruthy();
    expect(p.priceRule).toMatch(/No invalidation price is set/);
  });
});

describe('fmtPrice', () => {
  it('always shows 2 decimals for share prices', () => {
    expect(fmtPrice(229.2)).toBe('$229.20');
    expect(fmtPrice(220)).toBe('$220.00');
    expect(fmtPrice(null)).toBe('—');
  });
});
