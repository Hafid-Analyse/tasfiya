// المرافق: يفحص البيانات ويُرجع قائمة تنبيهات مرتبطة بالخطوات
import { db } from './store.js';
import { num, toDate } from './calc.js';
import { DEFAULT_CHECKLISTS } from './config.js';
import { fmt } from './util.js';

export function checklistDefs() {
  return (db.ChecklistDefs.length ? db.ChecklistDefs : DEFAULT_CHECKLISTS)
    .slice().sort((a, b) => num(a.order) - num(b.order));
}

export function checklistState(yearId, step) {
  const defs = checklistDefs().filter(d => d.step === step);
  const done = defs.filter(d => db.Checklists.some(c => c.yearId === yearId && c.itemId === d.id && c.checked));
  return { defs, done: done.length, total: defs.length };
}

export function runChecks(R) {
  const out = [];
  const add = (level, step, msg, ref) => out.push({ level, step, msg, ref });
  if (!R) return out;
  const { year, partners } = R;

  // ---- الإعداد ----
  if (!year.start || !year.end) add('error', 'setup', 'تاريخ بداية السنة أو نهايتها غير محدد');
  else if (toDate(year.end) <= toDate(year.start)) add('error', 'setup', 'تاريخ النهاية قبل تاريخ البداية');
  else if (R.days < 360 || R.days > 367) add('info', 'setup', `مدة الدورة ${R.days} يوماً (ليست سنة كاملة) — تأكد أن هذا مقصود`);
  if (num(year.effortPct) < 0 || num(year.effortPct) > 100) add('error', 'setup', 'نسبة الجهد يجب أن تكون بين 0 و100');
  if (num(year.reservePct) < 0 || num(year.reservePct) > 100) add('error', 'setup', 'نسبة الاحتياط يجب أن تكون بين 0 و100');

  // ---- الشركاء ----
  if (!partners.length) add('error', 'partners', 'لا يوجد أي شريك بعد');
  partners.forEach(x => {
    if (x.opening <= 0 && x.additions <= 0) add('warn', 'partners', `${x.p.name}: رأس المال الافتتاحي صفر`, x.p.id);
  });
  const effortSum = partners.reduce((s, x) => s + x.effortShare, 0);
  if (num(year.effortPct) > 0 && Math.abs(effortSum - 100) > 0.01)
    add('error', 'partners', `مجموع نسب الجهد بين الشركاء = ${fmt(effortSum, 2)}% (يجب أن يساوي 100%)`);
  if (num(year.effortPct) === 0 && effortSum > 0)
    add('info', 'partners', 'وزّعت نسب الجهد بين الشركاء لكن نسبة الجهد من الربح في الإعداد = 0%');

  // ---- حركة رؤوس الأموال ----
  partners.forEach(x => {
    let balance = x.opening;
    x.moves.forEach(m => {
      if (!m.date) add('error', 'capital', `${x.p.name}: حركة بدون تاريخ`, m.id);
      else if (year.start && year.end && (m.date < year.start || m.date > year.end))
        add('error', 'capital', `${x.p.name}: التاريخ ${m.date} خارج السنة المالية`, m.id);
      if (m.amount <= 0) add('error', 'capital', `${x.p.name}: مبلغ الحركة صفر أو سالب`, m.id);
      balance += m.type === 'addition' ? m.amount : -m.amount;
      if (m.type === 'withdrawal' && balance < -0.01)
        add('warn', 'capital', `${x.p.name}: السحب بتاريخ ${m.date || '؟'} يتجاوز رصيده (الرصيد بعده ${fmt(balance)})`, m.id);
    });
  });

  // ---- الأصول ----
  Object.values(R.assets.byCat).forEach(cat => {
    const rows = cat.rows.filter(r => !r.auto);
    rows.forEach(r => {
      const name = r.label || 'بند بلا اسم';
      if (!r.label) add('warn', cat.key, 'يوجد بند بلا اسم', r.id);
      if (r.gross < 0) add('error', cat.key, `${name}: مبلغ سالب`, r.id);
      if (r.gross === 0) add('warn', cat.key, `${name}: المبلغ صفر`, r.id);
      if (cat.key === 'invest' && num(r.depreciation) > r.gross) add('error', cat.key, `${name}: تناقص القيمة أكبر من المبلغ`, r.id);
      if (r.st?.reduce === 'pct') {
        if (num(r.pct) <= 0) add('warn', cat.key, `${name}: حالته «${r.st.ar}» لكن نسبة التخفيض 0%`, r.id);
        if (num(r.pct) > 100) add('error', cat.key, `${name}: نسبة التخفيض أكبر من 100%`, r.id);
      }
      if (r.status === 'unchecked') add('warn', cat.key, `${name}: الدين لم يُؤكَّد بعد مع الزبون`, r.id);
      if (r.status === 'unverified') add('warn', cat.key, `${name}: الرصيد لم يُطابق بعد`, r.id);
    });
    if (cat.key === 'invest' && rows.length && rows.every(r => !num(r.depreciation)))
      add('info', 'invest', 'لا يوجد أي تناقص قيمة في الاستثمارات — هل نسيت الاهتلاك؟');
    if (cat.key === 'treasury' && !rows.length) add('warn', 'treasury', 'لم تُدخل أي رصيد للخزينة (صندوق / بنك)');
  });

  // ---- الخصوم ----
  R.liabilities.rows.forEach(l => {
    if (!l.label) add('warn', 'liabilities', 'يوجد دين بلا اسم', l.id);
    if (l.amount < 0) add('error', 'liabilities', `${l.label || 'دين'}: مبلغ سالب`, l.id);
    if (l.amount === 0) add('warn', 'liabilities', `${l.label || 'دين'}: المبلغ صفر`, l.id);
  });

  // ---- التوزيع ----
  const dedPct = R.result.deductions.reduce((s, d) => s + d.pct, 0);
  if (dedPct > 100) add('error', 'distribution', 'مجموع نسب الاقتطاعات أكبر من 100%');
  if (!num(year.nisab)) add('warn', 'distribution', 'النصاب غير محدد — ستُحسب الزكاة على كل وعاء موجب');
  if (R.result.isLoss) add('info', 'distribution', `النتيجة خسارة (${fmt(R.result.net)}) — تُوزّع على المال وحده، ولا اقتطاعات ولا احتياط ولا نصيب جهد`);
  partners.filter(x => x.debtor).forEach(x =>
    add('warn', 'distribution', `${x.p.name}: أصبح مديناً للشركة بـ ${fmt(-x.newCapital)}`, x.p.id));
  if (!R.checks.distributionOk) add('error', 'distribution', `خلل في التوزيع: فرق ${fmt(R.checks.distributedCheck)} — راجع نسب الشركاء`);

  // ---- التحليل ----
  if (!R.pnl.hasData) add('info', 'analysis', 'لم تُدخل رقم الأعمال بعد — تحليل النتيجة اختياري لكنه مفيد');
  else if (Math.abs(R.pnl.diff) > 1)
    add('warn', 'analysis', `نتيجة الحسابات (${fmt(R.pnl.net)}) تختلف عن نتيجة الجرد (${fmt(R.result.net)}) بفارق ${fmt(R.pnl.diff)} — ابحث عن السبب`);
  if (Math.abs(R.opening.balanceGap) > 0.05) add('error', 'analysis', `الميزانية الافتتاحية غير متوازنة بفارق ${fmt(R.opening.balanceGap)}`);

  // ---- قوائم التحقق ----
  ['partners', 'capital', 'invest', 'stocks', 'receivables', 'treasury', 'liabilities', 'distribution', 'analysis'].forEach(step => {
    const s = checklistState(year.id, step);
    if (s.total && s.done < s.total) add('check', step, `قائمة التحقق: ${s.done} من ${s.total} مؤكَّدة`);
  });

  return out;
}

export function stepState(issues, step) {
  const mine = issues.filter(i => i.step === step);
  if (mine.some(i => i.level === 'error')) return 'error';
  if (mine.some(i => i.level === 'warn' || i.level === 'check')) return 'warn';
  return 'ok';
}
