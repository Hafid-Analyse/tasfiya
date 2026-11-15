// تصدير الدورة إلى Excel
import { db } from './store.js';
import { compute, round2 } from './calc.js';
import { ASSET_CATEGORIES, accountOf, statusOf, liabilityOf, RATIOS } from './config.js';
import { buildXlsx } from './xlsx.js';
import { download } from './util.js';

export function exportYearXlsx(yearId) {
  const R = compute(yearId);
  const company = db.Companies.find(c => c.id === R.year.companyId) || {};
  const r2 = v => round2(v || 0);
  const pct = v => ({ v: Math.round((v || 0) * 10000) / 10000, pct: true });

  const dist = {
    name: 'التوزيع والزكاة', widths: [6, 24, ...Array(16).fill(15)],
    rows: [['#', 'الشريك', 'رأس المال الافتتاحي', 'السحوبات', 'الإضافات', 'رأس المال الصافي', 'رأس المال المستثمر', 'نسبته',
      'ربح المال', 'نسبة الجهد', 'ربح الجهد', 'تسبيقات الربح', 'المجموع', 'وعاء الزكاة', 'الزكاة', 'سحوبات بعد التوزيع', 'رأس المال الجديد', 'نسبته'],
    ...R.partners.map((x, i) => [i + 1, x.p.name, r2(x.opening), r2(x.withdrawals), r2(x.additions), r2(x.net), r2(x.invested), pct(x.investedRatio),
      r2(x.moneyProfit), pct(x.effortShare / 100), r2(x.effortProfit), r2(x.advances), r2(x.total), r2(x.zakatBase), r2(x.zakat), r2(x.postWithdrawals), r2(x.newCapital), pct(x.newRatio)]),
    [{ v: '', b: true }, { v: 'المجموع', b: true }, ...['opening', 'withdrawals', 'additions', 'net', 'invested'].map(k => ({ v: r2(R.totals[k]), b: true })), '',
      { v: r2(R.totals.moneyProfit), b: true }, '', { v: r2(R.totals.effortProfit), b: true }, { v: r2(R.totals.advances), b: true }, { v: r2(R.totals.total), b: true },
      { v: r2(R.totals.zakatBase), b: true }, { v: r2(R.totals.zakat), b: true }, { v: r2(R.totals.postWithdrawals), b: true }, { v: r2(R.totals.newCapital), b: true }, ''],
    [], ['النتيجة الصافية', r2(R.result.net)], ['الاقتطاعات', r2(R.result.dedTotal)], ['الاحتياط', r2(R.result.reserve)],
    ['نصيب الجهد', r2(R.result.effortPool)], ['نصيب المال', r2(R.result.moneyPool)], ['النصاب', r2(R.zakat.nisab)], ['نسبة الزكاة', pct(R.zakat.rate / 100)]],
  };

  const bal = { name: 'الميزانية', widths: [30, 18, 18, 18], rows: [['الأصول', 'الخام', 'التخفيض', 'الصافي']] };
  ASSET_CATEGORIES.forEach(c => {
    const cat = R.assets.byCat[c.key];
    bal.rows.push([{ v: c.ar, b: true }, { v: r2(cat.gross), b: true }, { v: r2(cat.reduction), b: true }, { v: r2(cat.net), b: true }]);
  });
  bal.rows.push([{ v: 'مجموع الأصول', b: true }, { v: r2(R.assets.gross), b: true }, { v: r2(R.assets.reduction), b: true }, { v: r2(R.assets.net), b: true }], [],
    [{ v: 'الخصوم', b: true }, '', '', { v: 'المبلغ', b: true }],
    ['رأس المال الصافي للشركاء', '', '', r2(R.equity.netCapital)], ['احتياط سابق', '', '', r2(R.equity.prevReserve)],
    ['الديون', '', '', r2(R.liabilities.total)], ['النتيجة الصافية', '', '', r2(R.result.net)],
    [{ v: 'مجموع الخصوم', b: true }, '', '', { v: r2(R.equity.total + R.liabilities.total + R.result.net), b: true }], [],
    [{ v: 'المعدلات المالية', b: true }, { v: 'القيمة', b: true }, { v: 'المقبول', b: true }],
    ...RATIOS.map(r => [r.ar, R.ratios[r.key] === null ? '—' : pct(R.ratios[r.key] / 100), r.norm]));

  const inv = { name: 'الجرد', widths: [14, 24, 30, 16, 16, 10, 16, 16, 24],
    rows: [['الصنف', 'الحساب', 'البيان', 'المبلغ', 'الحالة', 'التخفيض %', 'التخفيض', 'الصافي', 'ملاحظة']] };
  ASSET_CATEGORIES.forEach(c => R.assets.byCat[c.key].rows.forEach(r => {
    const st = statusOf(c.key, r.status);
    inv.rows.push([c.ar, accountOf(c.key, r.account).ar, r.label || '', r2(r.gross), r.auto ? 'تلقائي' : st?.ar || '',
      st?.reduce === 'pct' ? (+r.pct || 0) : st?.reduce === 'all' ? 100 : 0, r2(r.reduction), r2(r.net), r.note || '']);
  }));

  const liab = { name: 'الخصوم', widths: [26, 30, 16, 24], rows: [['الحساب', 'البيان', 'المبلغ', 'ملاحظة'],
    ...R.liabilities.rows.map(l => [liabilityOf(l.account).ar, l.label || '', r2(l.amount), l.note || '']),
    [{ v: 'المجموع', b: true }, '', { v: r2(R.liabilities.total), b: true }, '']] };

  const moves = { name: 'حركة رؤوس الأموال', widths: [24, 10, 14, 16, 10, 16, 24], rows: [['الشريك', 'النوع', 'التاريخ', 'المبلغ', 'الوزن', 'المرجّح', 'ملاحظة']] };
  R.partners.forEach(x => x.moves.forEach(m => moves.rows.push([x.p.name, m.type === 'withdrawal' ? 'سحب' : 'إضافة', m.date || '', r2(m.amount), pct(m.weight), r2(m.weighted), m.note || ''])));

  const pnl = { name: 'تحليل النتيجة', widths: [34, 18, 12], rows: [['البيان', 'المبلغ', '% من رقم الأعمال']] };
  const P = R.pnl;
  [['رقم الأعمال', P.revenue], ['مستهلكات المخزون', P.consumption], ['الهامش الإجمالي', P.gross], ['التكاليف الثابتة', P.fixed],
    ['التكاليف المتغيرة', P.variable], ['تناقص القيمة', P.depreciation], ['نتيجة الحسابات', P.net], ['نتيجة الجرد', R.result.net], ['الفرق', P.diff]]
    .forEach(([l, v]) => pnl.rows.push([l, r2(v), P.hasData ? pct(v / P.revenue) : '']));
  pnl.rows.push([], [{ v: 'التفصيل', b: true }]);
  P.rows.forEach(r => pnl.rows.push([r.label, r2(r.amount), P.hasData ? pct(r.amount / P.revenue) : '']));

  const blob = buildXlsx([dist, bal, inv, liab, moves, pnl]);
  const name = `تصفية-${(company.name || 'شركة').replace(/\s+/g, '-')}-${R.year.label || ''}.xlsx`;
  download(name, blob);
}
