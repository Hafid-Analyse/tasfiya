// كل الحسابات — دوال خالصة لا تعتمد على الواجهة
import { db } from './store.js';
import { ASSET_CATEGORIES, AUTO_ADVANCES, accountOf, statusOf } from './config.js';

const DAY = 86400000;
export const num = v => (v === '' || v === null || v === undefined || isNaN(+v) ? 0 : +v);
export const toDate = s => (s ? new Date(s + 'T00:00:00Z') : null);
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);
export const round2 = v => Math.round(v * 100) / 100;
const clamp01 = v => Math.max(0, Math.min(1, v));
const safeDiv = (a, b) => (b ? a / b : 0);

export function yearDays(year) {
  if (!year?.start || !year?.end) return 0;
  return daysBetween(year.start, year.end) + 1; // شاملة لليومين
}

/** وزن الحركة: السحب يُحسب له ما بقي في الشركة قبل سحبه، والإضافة ما بقيت بعد إدخالها */
export function moveWeight(move, year) {
  const days = yearDays(year);
  if (!days || !move.date) return 0;
  if (move.type === 'withdrawal') return clamp01(daysBetween(year.start, move.date) / days);
  return clamp01((daysBetween(move.date, year.end) + 1) / days);
}

export function assetLine(row) {
  const gross = num(row.gross);
  const dep = row.category === 'invest' ? Math.min(num(row.depreciation), gross) : 0;
  const after = gross - dep;
  const st = statusOf(row.category, row.status);
  let extra = 0;
  if (st?.reduce === 'pct') extra = after * clamp01(num(row.pct) / 100);
  if (st?.reduce === 'all') extra = after;
  const reduction = dep + extra;
  return { ...row, gross, dep, extra, reduction, net: gross - reduction, st };
}

export function compute(yearId) {
  const year = db.Years.find(y => y.id === yearId);
  if (!year) return null;
  const days = yearDays(year);

  // ---------- الشركاء ----------
  const pyOf = pid => db.PartnerYear.find(r => r.yearId === yearId && r.partnerId === pid);
  const partnersAll = db.Partners.filter(p => p.companyId === year.companyId && pyOf(p.id))
    .sort((a, b) => num(a.order) - num(b.order));
  const moves = db.CapitalMoves.filter(m => m.yearId === yearId);

  const partners = partnersAll.map(p => {
    const py = pyOf(p.id);
    const pm = moves.filter(m => m.partnerId === p.id).map(m => {
      const w = moveWeight(m, year);
      return { ...m, amount: num(m.amount), weight: w, weighted: num(m.amount) * w };
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const W = pm.filter(m => m.type === 'withdrawal');
    const A = pm.filter(m => m.type === 'addition');
    const opening = num(py.openingCapital);
    const withdrawals = W.reduce((s, m) => s + m.amount, 0);
    const additions = A.reduce((s, m) => s + m.amount, 0);
    const wWeighted = W.reduce((s, m) => s + m.weighted, 0);
    const aWeighted = A.reduce((s, m) => s + m.weighted, 0);
    return {
      p, py, moves: pm, opening, withdrawals, additions, wWeighted, aWeighted,
      net: opening - withdrawals + additions,
      invested: opening - withdrawals + wWeighted + aWeighted,
      effortShare: num(py.effortShare),
      advances: num(py.profitAdvances),
      postWithdrawals: num(py.postWithdrawals),
    };
  });

  const sumNet = partners.reduce((s, x) => s + x.net, 0);
  const sumInvested = partners.reduce((s, x) => s + x.invested, 0);
  const sumAdvances = partners.reduce((s, x) => s + x.advances, 0);
  const sumOpening = partners.reduce((s, x) => s + x.opening, 0);

  // ---------- الأصول ----------
  const assetRows = db.Assets.filter(a => a.yearId === yearId).map(assetLine);
  const byCat = {};
  ASSET_CATEGORIES.forEach(c => {
    const rows = assetRows.filter(r => r.category === c.key);
    if (c.key === 'receivables' && sumAdvances) {
      rows.push({ id: '__auto_adv', category: 'receivables', account: AUTO_ADVANCES.key, label: 'مجموع تسبيقات الربح',
        gross: sumAdvances, dep: 0, extra: 0, reduction: 0, net: sumAdvances, auto: true, st: statusOf('receivables', 'confirmed') });
    }
    byCat[c.key] = {
      ...c, rows,
      gross: rows.reduce((s, r) => s + r.gross, 0),
      reduction: rows.reduce((s, r) => s + r.reduction, 0),
      net: rows.reduce((s, r) => s + r.net, 0),
    };
  });
  const allAssetRows = Object.values(byCat).flatMap(c => c.rows);
  const assets = {
    byCat,
    gross: allAssetRows.reduce((s, r) => s + r.gross, 0),
    reduction: allAssetRows.reduce((s, r) => s + r.reduction, 0),
    net: allAssetRows.reduce((s, r) => s + r.net, 0),
    nonZakat: allAssetRows.filter(r => accountOf(r.category, r.account).zakat === false).reduce((s, r) => s + r.net, 0),
  };

  // ---------- الخصوم ----------
  const liabRows = db.Liabilities.filter(l => l.yearId === yearId).map(l => ({ ...l, amount: num(l.amount) }));
  const liabilities = { rows: liabRows, total: liabRows.reduce((s, r) => s + r.amount, 0) };

  // ---------- رؤوس الأموال والنتيجة ----------
  const prevReserve = num(year.prevReserve);
  const equity = { netCapital: sumNet, prevReserve, total: sumNet + prevReserve };
  const net = round2(assets.net - liabilities.total - equity.total);
  const isLoss = net < 0;

  const deductions = db.Deductions.filter(d => d.yearId === yearId).map(d => ({
    ...d, pct: num(d.pct), amount: isLoss ? 0 : net * num(d.pct) / 100,
  }));
  const dedTotal = deductions.reduce((s, d) => s + d.amount, 0);
  const afterDed = net - dedTotal;
  const reservePct = num(year.reservePct);
  const reserve = afterDed > 0 ? afterDed * reservePct / 100 : 0;
  const distributable = afterDed - reserve;
  const effortPct = num(year.effortPct);
  // الخسارة على المال وحده بقدر الحصص
  const effortPool = isLoss ? 0 : distributable * effortPct / 100;
  const moneyPool = distributable - effortPool;

  // ---------- الزكاة ----------
  const zakatRate = num(year.zakatRate) || 2.577;
  const nisab = num(year.nisab);

  const ratioBase = sumInvested ? 'invested' : 'net';
  partners.forEach(x => {
    x.netRatio = safeDiv(x.net, sumNet);
    x.investedRatio = ratioBase === 'invested' ? safeDiv(x.invested, sumInvested) : x.netRatio;
    x.moneyProfit = moneyPool * x.investedRatio;
    x.effortProfit = effortPool * x.effortShare / 100;
    x.profit = x.moneyProfit + x.effortProfit;
    x.yieldPct = safeDiv(x.moneyProfit, x.invested) * 100;
    x.total = x.net + x.moneyProfit + x.effortProfit - x.advances;
    x.nonZakatShare = x.netRatio * assets.nonZakat;
    x.zakatBase = x.total > 0 ? Math.max(0, x.total - x.nonZakatShare) : 0;
    x.reachesNisab = x.zakatBase > 0 && x.zakatBase >= nisab;
    x.zakat = x.reachesNisab ? x.zakatBase * zakatRate / 100 : 0;
    x.newCapital = x.total - x.zakat - x.postWithdrawals;
    x.debtor = x.newCapital < 0;
  });
  const sumNew = partners.reduce((s, x) => s + x.newCapital, 0);
  partners.forEach(x => (x.newRatio = safeDiv(x.newCapital, sumNew)));

  const sum = k => partners.reduce((s, x) => s + (x[k] || 0), 0);
  const totals = {
    opening: sumOpening, withdrawals: sum('withdrawals'), additions: sum('additions'), net: sumNet,
    invested: sumInvested, moneyProfit: sum('moneyProfit'), effortProfit: sum('effortProfit'),
    advances: sumAdvances, total: sum('total'), zakatBase: sum('zakatBase'), zakat: sum('zakat'),
    postWithdrawals: sum('postWithdrawals'), newCapital: sumNew,
  };

  // تحقق مستقل: ما وُزّع + الاحتياط + الاقتطاعات = النتيجة
  const distributedCheck = round2(totals.moneyProfit + totals.effortProfit + reserve + dedTotal - net);

  return {
    year, days, partners, assets, liabilities, equity, totals,
    result: { net, isLoss, deductions, dedTotal, afterDed, reservePct, reserve, distributable, effortPct, effortPool, moneyPool },
    zakat: { rate: zakatRate, nisab, total: totals.zakat },
    ratios: financialRatios({ net, moneyPool, sumInvested, assets, liabilities, equity }),
    pnl: computePnL(yearId, assets, net),
    opening: computeOpening({ assets, liabilities, equity, partners, totals, deductions, reserve, sumAdvances }),
    checks: { distributedCheck, distributionOk: Math.abs(distributedCheck) < 0.05 },
  };
}

/** المعدلات المالية من الميزانية الختامية (null = غير قابل للحساب) */
function financialRatios({ net, moneyPool, sumInvested, assets, liabilities, equity }) {
  const pct = (a, b) => (b ? (a / b) * 100 : null);
  const cat = k => assets.byCat[k]?.net || 0;
  const clients = (assets.byCat.receivables?.rows || []).filter(r => r.account === 'clients').reduce((s, r) => s + r.net, 0);
  const eq = equity.total;
  const passif = eq + liabilities.total + net;
  const current = cat('stocks') + cat('receivables') + cat('treasury');
  return {
    projectYield: pct(net, sumInvested),
    financialYield: pct(moneyPool, sumInvested),
    debt: pct(liabilities.total, eq),
    clientRisk: pct(clients, eq),
    stockRisk: pct(cat('stocks'), eq),
    autonomy: pct(eq, passif),
    liquidity: pct(current, liabilities.total),
    immediate: pct(cat('treasury'), liabilities.total),
    investFinancing: pct(cat('invest'), eq),
  };
}

/** تحليل النتيجة: من رقم الأعمال إلى النتيجة، ومقارنتها بنتيجة الجرد */
export function computePnL(yearId, assets, balanceNet) {
  const rows = db.PnL.filter(r => r.yearId === yearId).map(r => ({ ...r, amount: num(r.amount) }))
    .sort((a, b) => num(a.order) - num(b.order));
  const sumK = k => rows.filter(r => r.kind === k).reduce((s, r) => s + r.amount, 0);
  const revenue = sumK('revenue'), consumption = sumK('consumption'), fixed = sumK('fixed'), variable = sumK('variable');
  const depreciation = sumK('depr');
  const gross = revenue - consumption;
  const net = gross - fixed - variable - depreciation;
  const contribution = revenue - consumption - variable;
  const contribRate = safeDiv(contribution, revenue);
  return {
    rows, revenue, consumption, fixed, variable, depreciation, gross, net, contribution, contribRate,
    breakEven: contribRate > 0 ? (fixed + depreciation) / contribRate : null,
    pct: v => safeDiv(v, revenue) * 100,
    diff: rows.length ? round2(net - balanceNet) : 0,
    hasData: revenue > 0,
  };
}

/** الميزانية الافتتاحية للدورة الموالية — تُشتق من الختامية بعد التوزيع */
function computeOpening({ assets, liabilities, equity, partners, totals, deductions, reserve, sumAdvances }) {
  const assetsNet = assets.net - sumAdvances; // تسبيقات الربح خُصمت من حسابات الشركاء
  const extraLiab = [];
  if (totals.zakat) extraLiab.push({ key: 'zakat_due', amount: totals.zakat });
  deductions.filter(d => d.amount > 0).forEach(d => extraLiab.push({ key: 'liab_other', label: d.label, labelFr: d.labelFr, amount: d.amount }));
  if (totals.postWithdrawals) extraLiab.push({ key: 'associes', label: 'سحوبات الشركاء المستحقة', labelFr: 'Retraits dus aux associés', amount: totals.postWithdrawals });
  const liabTotal = liabilities.total + extraLiab.reduce((s, l) => s + l.amount, 0);
  const capital = totals.newCapital;
  const reserves = equity.prevReserve + reserve;
  return {
    assetsNet, extraLiab, liabTotal, capital, reserves,
    equityTotal: capital + reserves,
    balanceGap: round2(assetsNet - liabTotal - capital - reserves),
    partners: partners.map(x => ({ name: x.p.name, capital: x.newCapital, ratio: x.newRatio })),
  };
}
