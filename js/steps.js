// شاشات خطوات السنة
import { db, upsert, uid } from './store.js';
import { compute, num, yearDays } from './calc.js';
import { runChecks, stepState, checklistState } from './checks.js';
import {
  STEPS, STEP_DESC, PNL_KINDS, RATIOS, ASSET_ACCOUNTS, LIABILITY_ACCOUNTS, STATUSES, ZAKAT_MODES, statusOf, accountOf, liabilityOf,
} from './config.js';
import { fmt, fmtPct, fmtDate, esc } from './util.js';

const STATE_ICON = { ok: '✔', warn: '⚠', error: '✖' };
const LEVEL_ICON = { error: '✖', warn: '⚠', info: 'ℹ', check: '☐' };

const inp = (t, id, f, v, o = {}) => `<input class="${o.cls || ''}" type="${o.type || 'text'}" ${o.num ? 'inputmode="decimal" data-num' : ''}
  data-t="${t}" data-id="${esc(id)}" data-f="${f}" value="${esc(v ?? '')}" placeholder="${esc(o.ph || '')}"
  ${o.min ? `min="${o.min}"` : ''} ${o.max ? `max="${o.max}"` : ''} ${o.step ? `step="${o.step}"` : ''} ${o.disabled ? 'disabled' : ''} ${o.full ? 'data-full' : ''}>`;
const money = (t, id, f, v, o = {}) => inp(t, id, f, v === 0 || v ? fmt(v) : '', { ...o, num: true, cls: 'money ' + (o.cls || ''), ph: o.ph || '0,00' });
const sel = (t, id, f, v, opts, o = {}) => `<select data-t="${t}" data-id="${esc(id)}" data-f="${f}" ${o.full !== false ? 'data-full' : ''}>
  ${opts.map(x => `<option value="${esc(x.key)}" ${x.key === v ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;

/* ===================== الهيكل ===================== */

export function renderYear(yearId, step) {
  const R = compute(yearId);
  if (!R) return '<div class="empty">السنة غير موجودة</div>';
  const company = db.Companies.find(c => c.id === R.year.companyId) || {};
  const issues = runChecks(R);
  const S = STEPS.find(s => s.key === step) || STEPS[0];
  const locked = R.year.status === 'closed';
  return `
  ${locked ? `<div class="locked-banner">🔒 هذه الدورة <b>مقفلة</b> منذ ${fmtDate((R.year.closedAt || '').slice(0, 10))} — العرض والطباعة فقط. <button class="btn ghost small" data-action="unlockYear">فتح الإقفال للتعديل</button></div>` : ''}
  <div class="year-head">
    <div class="crumbs"><a href="#/">الشركات</a> ‹ <a href="#/c/${company.id}">${esc(company.name)}</a> ‹ <b>${esc(R.year.label || 'سنة')}</b></div>
    <div class="chips" id="head-chips">${headChips(R, issues)}</div>
  </div>
  <div class="workspace">
    <aside class="stepper" id="stepper">${stepper(yearId, step, issues)}</aside>
    <section class="step-body ${locked ? 'locked' : ''}">
      <div class="step-title"><span class="step-ico">${S.icon}</span><div><h2>${S.ar}</h2><p>${STEP_DESC[S.key] || ''}</p></div></div>
      ${STEP_RENDER[S.key](R, S)}
      ${S.key !== 'reports' && S.key !== 'setup' ? checklistBlock(R.year.id, S.key) : ''}
      ${stepIssues(issues, S.key)}
      ${navButtons(yearId, S.key)}
    </section>
  </div>`;
}

export function headChips(R, issues) {
  const errs = issues.filter(i => i.level === 'error').length;
  const warns = issues.filter(i => i.level === 'warn' || i.level === 'check').length;
  return `
    <span class="chip"><small>صافي الأصول</small><b>${fmt(R.assets.net)}</b></span>
    <span class="chip"><small>الديون</small><b>${fmt(R.liabilities.total)}</b></span>
    <span class="chip ${R.result.isLoss ? 'neg' : 'pos'}"><small>النتيجة</small><b>${fmt(R.result.net)}</b></span>
    <span class="chip gold"><small>الزكاة</small><b>${fmt(R.zakat.total)}</b></span>
    <button class="chip check-btn ${errs ? 'has-err' : warns ? 'has-warn' : 'all-ok'}" data-action="openChecks">
      ${errs ? `✖ ${errs}` : ''} ${warns ? `⚠ ${warns}` : ''} ${!errs && !warns ? '✔ كل شيء سليم' : 'لوحة التحقق'}</button>`;
}

export function stepper(yearId, current, issues) {
  const keys = STEPS.filter(s => s.key !== 'reports').map(s => s.key);
  const okN = keys.filter(k => stepState(issues, k) === 'ok').length;
  const pct = Math.round(okN / keys.length * 100);
  return `<div class="progress"><div class="pr-top"><span>اكتمال الجرد</span><b>${pct}%</b></div><div class="pr-bar"><i style="width:${pct}%"></i></div></div>` + STEPS.map((s, i) => {
    const st = s.key === 'reports' ? '' : stepState(issues, s.key);
    return `<a href="#/y/${yearId}/${s.key}" class="st ${s.key === current ? 'active' : ''} ${st}">
      <span class="n">${i}</span><span class="lbl">${s.icon} ${s.ar}</span>
      ${st ? `<span class="state">${STATE_ICON[st]}</span>` : ''}</a>`;
  }).join('');
}

function stepIssues(issues, step) {
  const mine = issues.filter(i => i.step === step && i.level !== 'check');
  if (!mine.length) return '';
  return `<div class="issues">${mine.map(i => `<div class="issue ${i.level}" ${i.ref ? `data-action="focusRef" data-ref="${esc(i.ref)}"` : ''}>
    <span>${LEVEL_ICON[i.level]}</span> ${esc(i.msg)}</div>`).join('')}</div>`;
}

function navButtons(yearId, step) {
  const i = STEPS.findIndex(s => s.key === step);
  const prev = STEPS[i - 1], next = STEPS[i + 1];
  return `<div class="step-nav">
    ${prev ? `<a class="btn ghost" href="#/y/${yearId}/${prev.key}">→ ${prev.ar}</a>` : '<span></span>'}
    ${next ? `<button class="btn primary" data-action="nextStep" data-step="${step}" data-next="${next.key}">إنهاء الخطوة: ${next.ar} ←</button>` : ''}
  </div>`;
}

function checklistBlock(yearId, step) {
  const s = checklistState(yearId, step);
  if (!s.total) return '';
  const isDone = id => db.Checklists.some(c => c.yearId === yearId && c.itemId === id && c.checked);
  return `<div class="checklist ${s.done === s.total ? 'complete' : ''}">
    <div class="cl-head"><b>🧭 المرافق: قبل أن تنتقل</b><span>${s.done}/${s.total}</span></div>
    ${s.defs.map(d => `<label class="cl-item"><input type="checkbox" data-action="toggleCheck" data-item="${d.id}" data-step="${step}" ${isDone(d.id) ? 'checked' : ''}>
      <span>${esc(d.text)}</span></label>`).join('')}
  </div>`;
}

/* ===================== قيم محسوبة حيّة ===================== */

export function liveValues(R) {
  const map = {};
  Object.values(R.assets.byCat).forEach(c => {
    c.rows.forEach(r => { map['a-red:' + r.id] = fmt(r.reduction); map['a-net:' + r.id] = fmt(r.net); });
  });
  R.partners.forEach(x => {
    x.moves.forEach(m => { map['m-w:' + m.id] = fmtPct(m.weight * 100); map['m-wd:' + m.id] = fmt(m.weighted); });
    ['net', 'invested', 'opening', 'withdrawals', 'additions'].forEach(k => (map[`p-${k}:${x.p.id}`] = fmt(x[k])));
  });
  map['year-days'] = String(R.days || '—');
  map['money-pct'] = fmtPct(100 - num(R.year.effortPct), 0);
  return map;
}

/* ===================== ملخّص كل خطوة ===================== */

export function summaryFor(step, R) {
  const box = (label, v, cls = '') => `<div class="sum ${cls}"><small>${label}</small><b>${v}</b></div>`;
  const cat = R.assets.byCat[step];
  if (cat) {
    let extra = '';
    if (STATUSES[step]) {
      extra = STATUSES[step].map(s => {
        const rows = cat.rows.filter(r => !r.auto && (r.status || STATUSES[step][0].key) === s.key);
        return rows.length ? box(`${s.icon} ${s.ar} (${rows.length})`, fmt(rows.reduce((a, r) => a + r.gross, 0))) : '';
      }).join('');
    }
    return box('المبلغ الخام', fmt(cat.gross)) + box('التخفيض', fmt(cat.reduction), 'neg') + box('الصافي', fmt(cat.net), 'pos') + extra;
  }
  switch (step) {
    case 'partners': {
      const eff = R.partners.reduce((s, x) => s + x.effortShare, 0);
      return box('عدد الشركاء', R.partners.length) + box('رأس المال الافتتاحي', fmt(R.totals.opening)) +
        box('مجموع نسب الجهد', fmtPct(eff), Math.abs(eff - 100) < 0.01 || !num(R.year.effortPct) ? 'pos' : 'neg') +
        box('تسبيقات الربح', fmt(R.totals.advances));
    }
    case 'capital':
      return box('السحوبات', fmt(R.totals.withdrawals), 'neg') + box('الإضافات', fmt(R.totals.additions), 'pos') +
        box('رأس المال الصافي', fmt(R.totals.net)) + box('رأس المال المستثمر (المرجّح)', fmt(R.totals.invested), 'gold');
    case 'liabilities':
      return box('عدد الديون', R.liabilities.rows.length) + box('مجموع الديون', fmt(R.liabilities.total), 'neg');
    case 'analysis':
      return box('رقم الأعمال', fmt(R.pnl.revenue)) + box('الهامش الإجمالي', fmt(R.pnl.gross)) +
        box('نتيجة الحسابات', fmt(R.pnl.net), R.pnl.net < 0 ? 'neg' : 'pos') +
        box('الفرق مع الجرد', fmt(R.pnl.diff), Math.abs(R.pnl.diff) > 1 && R.pnl.hasData ? 'neg' : '');
    case 'distribution':
      return box('النتيجة الصافية', fmt(R.result.net), R.result.isLoss ? 'neg' : 'pos') +
        box('بعد الاقتطاعات', fmt(R.result.afterDed)) + box('الاحتياط', fmt(R.result.reserve)) +
        box('الزكاة', fmt(R.zakat.total), 'gold');
    default: return '';
  }
}
const summaryBlock = (step, R) => `<div class="summary" id="summary" data-step="${step}">${summaryFor(step, R)}</div>`;

/* ===================== 0. الإعداد ===================== */

function stepSetup(R) {
  const y = R.year;
  const deds = db.Deductions.filter(d => d.yearId === y.id);
  const zm = y.zakatMode || 'solar';
  return `
  <div class="card">
    <h3>الدورة المالية</h3>
    <div class="grid g4">
      <label>اسم الدورة ${inp('Years', y.id, 'label', y.label, { ph: 'مثلاً: 2025' })}</label>
      <label>بداية السنة ${inp('Years', y.id, 'start', y.start, { type: 'date' })}</label>
      <label>نهاية السنة ${inp('Years', y.id, 'end', y.end, { type: 'date' })}</label>
      <label>عدد الأيام <div class="ro" data-calc="year-days">${R.days || '—'}</div></label>
    </div>
  </div>
  <div class="card">
    <h3>توزيع الربح</h3>
    <div class="grid g4">
      <label>نصيب الجهد من الربح % ${inp('Years', y.id, 'effortPct', y.effortPct, { num: true, ph: '0' })}</label>
      <label>نصيب المال من الربح % <div class="ro" data-calc="money-pct">${fmtPct(100 - num(y.effortPct), 0)}</div></label>
      <label>نسبة الاحتياط % ${inp('Years', y.id, 'reservePct', y.reservePct, { num: true, ph: '0' })}</label>
      <label>احتياط السنوات السابقة ${money('Years', y.id, 'prevReserve', y.prevReserve)}</label>
    </div>
    <p class="hint">نصيب المال يُحسب تلقائياً (100% − الجهد) فلا يمكن أن يختل المجموع. وفي حال الخسارة تُحمَّل كلها على المال بقدر الحصص.</p>
  </div>
  <div class="card">
    <h3>الزكاة</h3>
    <div class="grid g4">
      <label>نوع الحول ${sel('Years', y.id, 'zakatMode', zm, ZAKAT_MODES.map(m => ({ key: m.key, label: m.ar })))}</label>
      <label>نسبة الزكاة % ${inp('Years', y.id, 'zakatRate', y.zakatRate || (ZAKAT_MODES.find(m => m.key === zm)?.rate ?? ''), { num: true, disabled: zm !== 'custom' })}</label>
      <label>النصاب (دج) ${money('Years', y.id, 'nisab', y.nisab)}</label>
      <label>حاسبة النصاب: سعر غرام الذهب
        <div class="inline"><input type="text" inputmode="decimal" id="goldPrice" placeholder="سعر 1غ"><button class="btn small" data-action="calcNisab">× 85غ</button></div></label>
    </div>
  </div>
  <div class="card">
    <h3>الاقتطاعات من النتيجة (قبل التوزيع)</h3>
    <table class="tbl"><thead><tr><th>البند (عربي)</th><th>البند (فرنسي)</th><th>النسبة %</th><th></th></tr></thead><tbody>
    ${deds.map(d => `<tr data-ref="${d.id}"><td>${inp('Deductions', d.id, 'label', d.label)}</td><td>${inp('Deductions', d.id, 'labelFr', d.labelFr)}</td>
      <td class="w120">${inp('Deductions', d.id, 'pct', d.pct, { num: true })}</td>
      <td class="w40"><button class="icon-btn" data-action="del" data-t="Deductions" data-id="${d.id}" title="حذف">🗑</button></td></tr>`).join('')}
    </tbody></table>
    <button class="btn ghost small" data-action="addDeduction">+ اقتطاع</button>
    <p class="hint">تُحسب نسبةً من النتيجة الصافية، ولا تُقتطع إطلاقاً إذا كانت النتيجة خسارة.</p>
  </div>`;
}

/* ===================== 1. الشركاء ===================== */

function stepPartners(R) {
  const y = R.year;
  return `${summaryBlock('partners', R)}
  <div class="card">
    <table class="tbl"><thead><tr><th class="w40">#</th><th>الشريك</th><th>رأس المال الافتتاحي</th><th>نسبته من الجهد %</th>
      <th>تسبيقات الربح</th><th>سحوبات بعد التوزيع</th><th>ملاحظات</th><th></th></tr></thead><tbody>
    ${R.partners.map((x, i) => `<tr data-ref="${x.p.id}">
      <td class="muted">${i + 1}</td>
      <td>${inp('Partners', x.p.id, 'name', x.p.name, { ph: 'اسم الشريك' })}</td>
      <td>${money('PartnerYear', x.py.id, 'openingCapital', x.py.openingCapital)}</td>
      <td class="w120">${inp('PartnerYear', x.py.id, 'effortShare', x.py.effortShare, { num: true, ph: '0', disabled: !num(y.effortPct) })}</td>
      <td>${money('PartnerYear', x.py.id, 'profitAdvances', x.py.profitAdvances)}</td>
      <td>${money('PartnerYear', x.py.id, 'postWithdrawals', x.py.postWithdrawals)}</td>
      <td>${inp('PartnerYear', x.py.id, 'notes', x.py.notes)}</td>
      <td class="w40"><button class="icon-btn" data-action="removePartner" data-id="${x.p.id}" title="حذف من هذه السنة">🗑</button></td>
    </tr>`).join('') || '<tr><td colspan="8" class="empty">أضف الشريك الأول</td></tr>'}
    </tbody></table>
    <div class="row-actions"><button class="btn primary small" data-action="addPartner">+ شريك</button>
    ${otherPartners(y).length ? `<select id="existingPartner"><option value="">— شريك من سنوات سابقة —</option>
      ${otherPartners(y).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
      <button class="btn ghost small" data-action="addExistingPartner">إضافة</button>` : ''}</div>
    <p class="hint"><b>تسبيقات الربح:</b> ما أخذه الشريك من الربح مسبقاً خلال السنة؛ يُضاف تلقائياً إلى الأصول (تسبيقات الشركاء) ويُخصم من نصيبه.
    <b>سحوبات بعد التوزيع:</b> ما سيسحبه من رصيده الجديد بعد التصفية.</p>
  </div>`;
}
const otherPartners = y => db.Partners.filter(p => p.companyId === y.companyId &&
  !db.PartnerYear.some(r => r.yearId === y.id && r.partnerId === p.id));

/* ===================== 2. حركة رؤوس الأموال ===================== */

function stepCapital(R) {
  const y = R.year;
  if (!R.partners.length) return '<div class="empty">أضف الشركاء أولاً</div>';
  const types = [{ key: 'withdrawal', label: '⬆ سحب' }, { key: 'addition', label: '⬇ إضافة' }];
  return `${summaryBlock('capital', R)}
  <p class="hint">كل حركة تُرجَّح بعدد الأيام: <b>السحب</b> يُحسب له ما بقي في الشركة قبل سحبه، و<b>الإضافة</b> يُحسب لها ما بقيت بعد إدخالها. هكذا يُوزَّع الربح على المال والزمن معاً.</p>
  ${R.partners.map(x => `
  <div class="card partner-card" data-ref="${x.p.id}">
    <div class="pc-head"><h3>${esc(x.p.name || 'شريك')}</h3>
      <div class="pc-nums"><span>الافتتاحي <b data-calc="p-opening:${x.p.id}">${fmt(x.opening)}</b></span>
      <span>الصافي <b data-calc="p-net:${x.p.id}">${fmt(x.net)}</b></span>
      <span class="gold">المستثمر <b data-calc="p-invested:${x.p.id}">${fmt(x.invested)}</b></span></div></div>
    ${x.moves.length ? `<table class="tbl"><thead><tr><th>النوع</th><th>التاريخ</th><th>المبلغ</th><th>الوزن</th><th>المبلغ المرجّح</th><th>ملاحظة</th><th></th></tr></thead><tbody>
    ${x.moves.map(m => `<tr data-ref="${m.id}" class="${m.type}">
      <td class="w120">${sel('CapitalMoves', m.id, 'type', m.type, types)}</td>
      <td class="w160">${inp('CapitalMoves', m.id, 'date', m.date, { type: 'date', min: y.start, max: y.end, full: true })}</td>
      <td>${money('CapitalMoves', m.id, 'amount', m.amount)}</td>
      <td class="calc" data-calc="m-w:${m.id}">${fmtPct(m.weight * 100)}</td>
      <td class="calc" data-calc="m-wd:${m.id}">${fmt(m.weighted)}</td>
      <td>${inp('CapitalMoves', m.id, 'note', m.note)}</td>
      <td class="w40"><button class="icon-btn" data-action="del" data-t="CapitalMoves" data-id="${m.id}">🗑</button></td></tr>`).join('')}
    </tbody></table>` : '<p class="muted">لا حركات — رأس ماله بقي ثابتاً طوال السنة</p>'}
    <div class="row-actions"><button class="btn ghost small" data-action="addMove" data-pid="${x.p.id}" data-type="withdrawal">+ سحب</button>
    <button class="btn ghost small" data-action="addMove" data-pid="${x.p.id}" data-type="addition">+ إضافة</button></div>
  </div>`).join('')}`;
}

/* ===================== 3-6. الأصول ===================== */

const ASSET_HINTS = {
  invest: 'سجّل كل استثمار بقيمته الأصلية، ثم تناقص القيمة المتراكم. الاستثمارات أموال غير زكوية وتُطرح من الوعاء.',
  stocks: 'سجّل المخزون بعد العدّ الفعلي. السليم بقيمته، والراكد والتالف بنسبة تخفيض، والفاقد يُستبعد.',
  receivables: 'لكل زبون حالة: ✅ مؤكَّد بقيمته • 🟡 مشكوك فيه بنسبة تخفيض • ❌ معدوم يُستبعد • ⏳ لم يُؤكَّد بعد (تنبيه مفتوح).',
  treasury: 'الصندوق يُعدّ نقداً يوم الجرد، والبنك والبريد يُطابقان مع الكشف الرسمي.',
};

function stepAssets(R, S) {
  const catKey = S.cat;
  const cat = R.assets.byCat[catKey];
  const accounts = ASSET_ACCOUNTS[catKey];
  const statuses = STATUSES[catKey];
  const isInv = catKey === 'invest';
  const rows = cat.rows;
  return `${summaryBlock(catKey, R)}
  <p class="hint">${ASSET_HINTS[catKey]}</p>
  <div class="card">
    ${rows.length > 8 ? `<input type="search" class="filter" data-action-input="filterRows" placeholder="🔍 بحث في البنود…">` : ''}
    <table class="tbl" id="rows-tbl"><thead><tr><th>الحساب</th><th>البيان / الاسم</th><th>المبلغ</th>
      ${isInv ? '<th>تناقص القيمة</th>' : ''}<th>الحالة</th><th>التخفيض %</th><th>الصافي</th><th>ملاحظة</th><th></th></tr></thead><tbody>
    ${rows.map(r => {
      if (r.auto) return `<tr class="auto"><td>${esc(accountOf(catKey, r.account).ar)}</td><td>${esc(r.label)} <small class="muted">(تلقائي من صفحة الشركاء)</small></td>
        <td class="calc">${fmt(r.gross)}</td>${isInv ? '<td></td>' : ''}<td>✅</td><td></td><td class="calc">${fmt(r.net)}</td><td></td><td></td></tr>`;
      const st = statusOf(catKey, r.status);
      return `<tr data-ref="${r.id}" class="st-${st.key}">
      <td class="w160">${sel('Assets', r.id, 'account', r.account, accounts.map(a => ({ key: a.key, label: a.ar })), { full: false })}</td>
      <td>${inp('Assets', r.id, 'label', r.label, { ph: catKey === 'receivables' ? 'اسم الزبون' : 'البيان' })}</td>
      <td>${money('Assets', r.id, 'gross', r.gross)}</td>
      ${isInv ? `<td>${money('Assets', r.id, 'depreciation', r.depreciation)}</td>` : ''}
      <td class="w160">${sel('Assets', r.id, 'status', st.key, statuses.map(s => ({ key: s.key, label: `${s.icon} ${s.ar}` })))}</td>
      <td class="w90">${st.reduce === 'pct' ? inp('Assets', r.id, 'pct', r.pct, { num: true, ph: '%' }) : `<span class="muted">${st.reduce === 'all' ? '100%' : '—'}</span>`}</td>
      <td class="calc" data-calc="a-net:${r.id}">${fmt(r.net)}</td>
      <td>${inp('Assets', r.id, 'note', r.note)}</td>
      <td class="w40"><button class="icon-btn" data-action="del" data-t="Assets" data-id="${r.id}">🗑</button></td></tr>`;
    }).join('') || `<tr><td colspan="9" class="empty">لا بنود بعد</td></tr>`}
    </tbody></table>
    <div class="row-actions">
      <button class="btn primary small" data-action="addAsset" data-cat="${catKey}">+ بند</button>
      <button class="btn ghost small" data-action="pasteRows" data-kind="asset" data-cat="${catKey}">📋 لصق قائمة من Excel</button>
    </div>
  </div>`;
}

/* ===================== 7. الخصوم ===================== */

function stepLiabilities(R) {
  return `${summaryBlock('liabilities', R)}
  <p class="hint">كل ما على الشركة للغير يوم الجرد: موردون، تسبيقات زبائن، أجور، ضرائب، كراء، خدمات…</p>
  <div class="card">
    <table class="tbl" id="rows-tbl"><thead><tr><th>الحساب</th><th>البيان / الدائن</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr></thead><tbody>
    ${R.liabilities.rows.map(l => `<tr data-ref="${l.id}">
      <td class="w200">${sel('Liabilities', l.id, 'account', l.account, LIABILITY_ACCOUNTS.map(a => ({ key: a.key, label: a.ar })), { full: false })}</td>
      <td>${inp('Liabilities', l.id, 'label', l.label, { ph: 'اسم الدائن / البيان' })}</td>
      <td>${money('Liabilities', l.id, 'amount', l.amount)}</td>
      <td>${inp('Liabilities', l.id, 'note', l.note)}</td>
      <td class="w40"><button class="icon-btn" data-action="del" data-t="Liabilities" data-id="${l.id}">🗑</button></td></tr>`).join('')
      || '<tr><td colspan="5" class="empty">لا ديون بعد</td></tr>'}
    </tbody></table>
    <div class="row-actions">
      <button class="btn primary small" data-action="addLiability">+ دين</button>
      <button class="btn ghost small" data-action="pasteRows" data-kind="liability">📋 لصق قائمة من Excel</button>
    </div>
  </div>`;
}

/* ===================== 8. التوزيع ===================== */

function stepDistribution(R) {
  const r = R.result;
  const line = (label, v, cls = '', sign = '') => `<div class="cl ${cls}"><span>${label}</span><b>${sign}${fmt(v)}</b></div>`;
  return `${summaryBlock('distribution', R)}
  <div class="grid g2">
    <div class="card cascade">
      <h3>من الأصول إلى النتيجة</h3>
      ${line('صافي الأصول', R.assets.net)}
      ${line('− الديون', R.liabilities.total, 'minus')}
      ${line('− رؤوس الأموال الصافية', R.equity.netCapital, 'minus')}
      ${R.equity.prevReserve ? line('− احتياط سابق', R.equity.prevReserve, 'minus') : ''}
      ${line('= النتيجة الصافية', r.net, 'total ' + (r.isLoss ? 'neg' : 'pos'))}
      ${r.deductions.map(d => line(`− ${esc(d.label)} (${fmtPct(d.pct, 1)})`, d.amount, 'minus')).join('')}
      ${r.deductions.length ? line('= بعد الاقتطاعات', r.afterDed, 'sub') : ''}
      ${line(`− الاحتياط (${fmtPct(r.reservePct, 1)})`, r.reserve, 'minus')}
      ${line('= القابل للتوزيع', r.distributable, 'total')}
      ${line(`نصيب الجهد (${fmtPct(r.effortPct, 1)})`, r.effortPool, 'part')}
      ${line(`نصيب المال (${fmtPct(r.isLoss ? 100 : 100 - r.effortPct, 1)})`, r.moneyPool, 'part')}
    </div>
    <div class="card cascade">
      <h3>الزكاة</h3>
      ${line('الأموال غير الزكوية (تُطرح)', R.assets.nonZakat)}
      <div class="cl"><span>النصاب</span><b>${R.zakat.nisab ? fmt(R.zakat.nisab) : '<span class="neg">غير محدد</span>'}</b></div>
      <div class="cl"><span>نسبة الزكاة</span><b>${fmtPct(R.zakat.rate, 3)}</b></div>
      ${line('مجموع أوعية الزكاة', R.totals.zakatBase)}
      ${line('مجموع الزكاة', R.zakat.total, 'total gold')}
      <h3 class="mt">المردودية</h3>
      <div class="cl"><span>مردودية المشروع (النتيجة ÷ المستثمر)</span><b>${fmtPct(R.ratios.projectYield)}</b></div>
      <div class="cl"><span>المردودية المالية (ربح المال ÷ المستثمر)</span><b>${fmtPct(R.ratios.financialYield)}</b></div>
    </div>
  </div>
  <div class="card scroll-x">
    <h3>جدول تصفية حسابات الشركاء</h3>
    ${distributionTable(R)}
  </div>`;
}

export function distributionTable(R, opts = {}) {
  const cols = [
    ['opening', 'رأس المال الافتتاحي'], ['withdrawals', 'السحوبات'], ['additions', 'الإضافات'], ['net', 'رأس المال الصافي'],
    ['invested', 'رأس المال المستثمر'], ['investedRatio', 'نسبته', 'pct'], ['moneyProfit', 'ربح المال'],
    ['effortShare', 'نسبة الجهد', 'rawpct'], ['effortProfit', 'ربح الجهد'], ['advances', 'تسبيقات الربح'], ['total', 'المجموع'],
    ['zakatBase', 'وعاء الزكاة'], ['zakat', 'الزكاة'], ['postWithdrawals', 'سحوبات بعد التوزيع'], ['newCapital', 'رأس المال الجديد'], ['newRatio', 'نسبته', 'pct'],
  ];
  const cell = (x, [k, , t]) => {
    if (t === 'pct') return fmtPct((x[k] || 0) * 100);
    if (t === 'rawpct') return fmtPct(x[k] || 0);
    return fmt(x[k]);
  };
  const totals = { ...R.totals, investedRatio: R.partners.length ? 1 : 0, newRatio: R.partners.length ? 1 : 0,
    effortShare: R.partners.reduce((s, x) => s + x.effortShare, 0) };
  return `<table class="tbl dist ${opts.print ? 'print-tbl' : ''}"><thead><tr><th>#</th><th>الشريك</th>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>
    ${R.partners.map((x, i) => `<tr class="${x.debtor ? 'debtor' : ''}"><td>${i + 1}</td><td class="nm">${esc(x.p.name)}</td>
      ${cols.map(c => `<td class="${c[0] === 'zakat' ? 'gold' : ''} ${c[0] === 'newCapital' ? 'strong' : ''}">${cell(x, c)}</td>`).join('')}</tr>`).join('')}
  </tbody><tfoot><tr><td></td><td>المجموع</td>${cols.map(c => `<td>${cell(totals, c)}</td>`).join('')}</tr></tfoot></table>`;
}

/* ===================== 9. التحليل ===================== */

export function ratioRows(R) {
  return RATIOS.map(r => {
    const v = R.ratios[r.key];
    const st = v === null ? 'na' : r.ok ? (r.ok(v) ? 'good' : 'bad') : 'neutral';
    return { ...r, v, st };
  });
}

function stepAnalysis(R) {
  const P = R.pnl;
  const kindRows = k => P.rows.filter(r => r.kind === k);
  const line = (label, v, cls = '') => `<div class="cl ${cls}"><span>${label}</span><b>${fmt(v)}</b><em>${P.hasData ? fmtPct(P.pct(v), 1) : ''}</em></div>`;
  return `${summaryBlock('analysis', R)}
  <div class="grid g2 analysis">
    <div class="card">
      <h3>بنود الحسابات</h3>
      ${P.rows.length ? PNL_KINDS.map(k => `<div class="pnl-group"><h4>${k.ar}</h4>
        <table class="tbl"><tbody>${kindRows(k.key).map(r => `<tr data-ref="${r.id}">
          <td>${inp('PnL', r.id, 'label', r.label)}</td><td class="w160">${money('PnL', r.id, 'amount', r.amount)}</td>
          <td class="w40"><button class="icon-btn" data-action="del" data-t="PnL" data-id="${r.id}">🗑</button></td></tr>`).join('')}</tbody></table>
        <button class="btn ghost small" data-action="addPnl" data-kind="${k.key}">+ بند</button></div>`).join('')
      : `<div class="empty">لا بنود بعد<br><br><button class="btn primary" data-action="seedPnl">إضافة البنود الأساسية</button></div>`}
    </div>
    <div>
      <div class="card cascade">
        <h3>من رقم الأعمال إلى النتيجة</h3>
        ${line('رقم الأعمال', P.revenue, 'total')}
        ${line('− مستهلكات المخزون', P.consumption, 'minus')}
        ${line('= الهامش الإجمالي', P.gross, 'sub')}
        ${line('− التكاليف الثابتة', P.fixed, 'minus')}
        ${line('− التكاليف المتغيرة', P.variable, 'minus')}
        ${line('− اهتلاكات السنة', P.depreciation, 'minus')}
        ${line('= نتيجة الحسابات', P.net, 'total ' + (P.net < 0 ? 'neg' : 'pos'))}
        <div class="cl"><span>نتيجة الجرد (الميزانية)</span><b>${fmt(R.result.net)}</b><em></em></div>
        <div class="cl ${Math.abs(P.diff) > 1 && P.hasData ? 'neg' : 'pos'}"><span>الفرق</span><b>${fmt(P.diff)}</b><em></em></div>
        ${P.breakEven !== null ? `<div class="cl part"><span>عتبة المردودية (رقم الأعمال الأدنى لتغطية التكاليف)</span><b>${fmt(P.breakEven)}</b><em></em></div>` : ''}
      </div>
      <p class="hint">الفرق بين النتيجتين طبيعي إن كانت الحسابات غير كاملة، لكنه يدل غالباً على: مخزون لم يُعدّ، دين نُسي، أو مصروف لم يُسجّل.</p>
    </div>
  </div>
  <div class="card">
    <h3>المعدلات المالية (من الميزانية الختامية)</h3>
    <div class="ratios">${ratioRows(R).map(r => `<div class="ratio ${r.st}">
      <div class="rt-top"><b>${r.ar}</b><span class="rt-v">${r.v === null ? '—' : fmtPct(r.v, 1)}</span></div>
      <small>${r.desc}</small><div class="rt-norm">${r.st === 'good' ? '✔' : r.st === 'bad' ? '✖' : '•'} المقبول: ${r.norm}</div></div>`).join('')}</div>
  </div>`;
}

/* ===================== 10. الكشوفات ===================== */

function stepReports(R) {
  const company = db.Companies.find(c => c.id === R.year.companyId) || {};
  const reps = [
    ['balance', '📊', 'الميزانية الختامية', 'الأصول والخصوم والنتيجة'],
    ['distribution', '⚖️', 'جدول تصفية حسابات الشركاء', 'التوزيع والزكاة ورأس المال الجديد (صفحة أفقية)'],
    ['statements', '👤', 'كشف حساب الشريك', 'صفحة مستقلة لكل شريك'],
    ['capital', '🔁', 'حركة رؤوس الأموال', 'السحوبات والإضافات المرجّحة لكل شريك'],
    ['inventory', '📝', 'محضر الجرد', 'ما أُكّد وما خُفّض وما استُبعد'],
    ['analysis', '📈', 'التحليل المالي وتحليل النتيجة', 'المعدلات مقارنة بالمقبول، ومن رقم الأعمال إلى النتيجة'],
    ['opening', '🌱', 'الميزانية الافتتاحية للدورة الموالية', 'بعد التوزيع والزكاة والاقتطاعات'],
  ];
  const locked = R.year.status === 'closed';
  const errs = runChecks(R).filter(i => i.level === 'error').length;
  return `
  <div class="card print-opts">
    <h3>خيارات الطباعة</h3>
    <div class="grid g4">
      <label>اللغة <select id="p-lang"><option value="arfr" selected>عربية + فرنسية</option><option value="ar">عربية فقط</option></select></label>
      <label>الشريك (للكشف) <select id="p-partner"><option value="all">كل الشركاء</option>
        ${R.partners.map(x => `<option value="${x.p.id}">${esc(x.p.name)}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="p-logo" ${company.logo ? 'checked' : 'disabled'}> إظهار الشعار ${company.logo ? '' : '<small class="muted">(لا شعار — أضفه من صفحة الشركة)</small>'}</label>
      <label class="check"><input type="checkbox" id="p-sign" checked> خانات التوقيع</label>
    </div>
  </div>
  <div class="reports">
    ${reps.map(([k, ico, t, d]) => `<div class="rep-card">
      <div class="rep-ico">${ico}</div><div class="rep-txt"><b>${t}</b><small>${d}</small></div>
      <div class="rep-btns"><button class="btn ghost small" data-action="preview" data-rep="${k}">معاينة</button>
      <button class="btn primary small" data-action="print" data-rep="${k}">🖨 طباعة</button></div></div>`).join('')}
    <div class="rep-card all"><div class="rep-ico">📚</div><div class="rep-txt"><b>الحزمة الكاملة</b><small>كل الكشوفات دفعة واحدة</small></div>
      <div class="rep-btns"><button class="btn gold small" data-action="print" data-rep="all">🖨 طباعة الكل</button></div></div>
  </div>
  <p class="hint">في نافذة الطباعة اختر «حفظ بصيغة PDF» إن أردت ملفاً بدل الورق. وفعّل «رسومات الخلفية» لتظهر الألوان.</p>
  <div class="grid g2 mt">
    <div class="card action-card">
      <div class="ac-ico">📗</div><div><h3>تصدير إلى Excel</h3><p class="muted">ملف ‎.xlsx‎ فيه: التوزيع، الميزانية، الجرد، حركة رؤوس الأموال، الخصوم.</p>
      <button class="btn ghost" data-action="exportXlsx">⬇ تحميل ملف Excel</button></div>
    </div>
    <div class="card action-card ${locked ? 'closed' : ''}">
      <div class="ac-ico">${locked ? '🔒' : '🔐'}</div><div><h3>${locked ? 'الدورة مقفلة' : 'إقفال الدورة'}</h3>
      <p class="muted">${locked ? 'النتائج مجمّدة في الشيت (ورقة Results). يمكنك الفتح للتعديل ثم الإقفال من جديد.'
        : 'يجمّد النتائج ويحفظ لقطة لكل شريك، ويمنع التعديل غير المقصود. أنشئ بعدها الدورة الموالية من صفحة الشركة.'}</p>
      ${locked ? '<button class="btn ghost" data-action="unlockYear">فتح الإقفال</button>'
        : `<button class="btn ${errs ? 'ghost' : 'primary'}" data-action="closeYear">🔒 إقفال الدورة ${errs ? `(${errs} أخطاء مفتوحة)` : ''}</button>`}</div>
    </div>
  </div>`;
}

const STEP_RENDER = {
  setup: stepSetup, partners: stepPartners, capital: stepCapital,
  invest: stepAssets, stocks: stepAssets, receivables: stepAssets, treasury: stepAssets,
  liabilities: stepLiabilities, distribution: stepDistribution, analysis: stepAnalysis, reports: stepReports,
};

/* ===================== عمليات الإضافة ===================== */

export function newPartner(year, existingId) {
  let pid = existingId;
  if (!pid) {
    const order = db.Partners.filter(p => p.companyId === year.companyId).length + 1;
    pid = uid('p');
    upsert('Partners', { id: pid, companyId: year.companyId, name: '', order, active: true });
  }
  upsert('PartnerYear', { id: uid('py'), yearId: year.id, partnerId: pid, openingCapital: '', effortShare: '', profitAdvances: '', postWithdrawals: '', notes: '' });
  return pid;
}

export function newAsset(yearId, cat, extra = {}) {
  const r = { id: uid('a'), yearId, category: cat, account: ASSET_ACCOUNTS[cat][0].key, label: '', gross: '', depreciation: '',
    status: STATUSES[cat][0].key, pct: '', note: '', ...extra };
  if (cat === 'receivables' && !extra.status) r.status = 'unchecked';
  if (cat === 'treasury' && !extra.status) r.status = 'unverified';
  upsert('Assets', r);
  return r.id;
}

export function newLiability(yearId, extra = {}) {
  const r = { id: uid('l'), yearId, account: LIABILITY_ACCOUNTS[0].key, label: '', amount: '', note: '', ...extra };
  upsert('Liabilities', r);
  return r.id;
}

export function zakatRateFor(mode, current) {
  const m = ZAKAT_MODES.find(z => z.key === mode);
  return m && m.rate !== null ? m.rate : current;
}

export { yearDays, liabilityOf };
