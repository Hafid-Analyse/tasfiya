// إنشاء الدورات وإقفالها
import { db, upsert, uid, removeMany } from './store.js';
import { compute, num, round2 } from './calc.js';
import { DEFAULT_DEDUCTIONS, DEFAULT_PNL } from './config.js';

export function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

/** إنشاء دورة؛ إن أُعطيت prevId تُنقل منها الأرصدة */
export function createYear(companyId, { label, start, end }, prevId = null) {
  const y = {
    id: uid('y'), companyId, label, start, end, status: 'draft', zakatMode: 'solar', zakatRate: 2.577, nisab: '',
    reservePct: '', effortPct: '', prevReserve: '', notes: '', createdAt: new Date().toISOString(), closedAt: '',
  };
  const prev = prevId && db.Years.find(x => x.id === prevId);
  if (prev) {
    const R = compute(prev.id);
    Object.assign(y, {
      zakatMode: prev.zakatMode, zakatRate: prev.zakatRate, reservePct: prev.reservePct, effortPct: prev.effortPct,
      prevReserve: round2(num(prev.prevReserve) + R.result.reserve) || '',
    });
    upsert('Years', y);
    R.partners.forEach(x => upsert('PartnerYear', {
      id: uid('py'), yearId: y.id, partnerId: x.p.id, openingCapital: round2(x.newCapital),
      effortShare: x.py.effortShare, profitAdvances: '', postWithdrawals: '', notes: '',
    }));
    db.Deductions.filter(d => d.yearId === prev.id).forEach(d => upsert('Deductions', { ...d, id: uid('d'), yearId: y.id }));
    R.opening.extraLiab.forEach(l => upsert('Liabilities', {
      id: uid('l'), yearId: y.id, account: l.key,
      label: l.key === 'zakat_due' ? `زكاة دورة ${prev.label}` : `${l.label} — دورة ${prev.label}`,
      amount: round2(l.amount), note: 'منقول تلقائياً من التوزيع',
    }));
  } else {
    upsert('Years', y);
    DEFAULT_DEDUCTIONS.forEach(d => upsert('Deductions', { id: uid('d'), yearId: y.id, ...d }));
  }
  return y.id;
}

export function seedPnl(yearId) {
  DEFAULT_PNL.forEach(([kind, label, labelFr], i) =>
    upsert('PnL', { id: uid('pl'), yearId, kind, label, labelFr, amount: '', order: i + 1 }));
}

/** الإقفال: لقطة مجمّدة لكل شريك + ملخص الدورة في ورقة Results */
export function closeYear(yearId) {
  const R = compute(yearId);
  const at = new Date().toISOString();
  removeMany('Results', r => r.yearId === yearId);
  R.partners.forEach(x => upsert('Results', {
    id: uid('r'), yearId, partnerId: x.p.id, at,
    data: JSON.stringify({
      name: x.p.name, opening: round2(x.opening), net: round2(x.net), invested: round2(x.invested), moneyProfit: round2(x.moneyProfit),
      effortProfit: round2(x.effortProfit), total: round2(x.total), zakat: round2(x.zakat), newCapital: round2(x.newCapital),
    }),
  }));
  upsert('Results', {
    id: uid('r'), yearId, partnerId: '__year', at,
    data: JSON.stringify({
      assets: round2(R.assets.net), liabilities: round2(R.liabilities.total), result: round2(R.result.net),
      reserve: round2(R.result.reserve), zakat: round2(R.zakat.total), newCapital: round2(R.totals.newCapital),
    }),
  });
  upsert('Years', { id: yearId, status: 'closed', closedAt: at });
}

export function unlockYear(yearId) {
  upsert('Years', { id: yearId, status: 'draft', closedAt: '' });
}
