// التطبيق: التوجيه، الشاشات العامة، الأحداث
import { db, load, upsert, remove, removeMany, uid, onStatus, getConfig, setConfig, isRemote, testConnection, exportJSON, importJSON } from './store.js';
import { compute, num, round2 } from './calc.js';
import { runChecks } from './checks.js';
import { renderYear, headChips, stepper, summaryFor, liveValues, newPartner, newAsset, newLiability, zakatRateFor } from './steps.js';
import { buildReport } from './reports.js';
import { createYear, closeYear, unlockYear, seedPnl, addDays } from './years.js';
import { loadDemo } from './demo.js';
import { exportYearXlsx } from './export.js';
import { DEFAULT_DEDUCTIONS, STEPS, LIABILITY_ACCOUNTS, ASSET_ACCOUNTS } from './config.js';
import { $, $$, esc, fmt, fmtDate, toast, confirmBox, imageToDataURL, download, debounce } from './util.js';

const app = $('#app');
let route = { name: 'home' };

/* ===================== التوجيه ===================== */

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'c' && parts[1]) return { name: 'company', id: parts[1] };
  if (parts[0] === 'y' && parts[1]) return { name: 'year', id: parts[1], step: parts[2] || 'setup' };
  return { name: 'home' };
}

function render(keepScroll = false) {
  const y = window.scrollY;
  route = parseRoute();
  if (route.name === 'home') app.innerHTML = homeView();
  else if (route.name === 'company') app.innerHTML = companyView(route.id);
  else {
    app.innerHTML = renderYear(route.id, route.step);
    $$('.step-body.locked [data-t], .step-body.locked .cl-item input').forEach(el => (el.disabled = true));
  }
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => render());

/* ===================== الرئيسية ===================== */

function homeView() {
  const cos = db.Companies.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  return `
  ${!isRemote() ? `<div class="banner">🧪 <b>وضع التجربة المحلي:</b> البيانات محفوظة في هذا المتصفح فقط. اربط Google Sheets من <a href="#" data-action="openSettings">الإعدادات</a>.</div>` : ''}
  <div class="hero"><h1>جرد الأعمال وتصفية حساب الشركاء</h1>
    <p>اختر شركة أو أضف واحدة جديدة، ثم سِر مع المرافق خطوة خطوة حتى الكشوفات الجاهزة للطباعة.</p></div>
  <div class="cards">
    ${cos.map(c => {
      const years = db.Years.filter(y => y.companyId === c.id);
      return `<a class="co-card" href="#/c/${c.id}">
        <div class="co-logo">${c.logo ? `<img src="${c.logo}" alt="">` : `<span>${esc((c.name || '؟').trim()[0] || '؟')}</span>`}</div>
        <div class="co-txt"><b>${esc(c.name || 'شركة بلا اسم')}</b><small>${years.length} دورة • ${db.Partners.filter(p => p.companyId === c.id).length} شريك</small></div></a>`;
    }).join('')}
    <button class="co-card add" data-action="addCompany"><div class="co-logo"><span>+</span></div><div class="co-txt"><b>شركة جديدة</b><small>ابدأ تصفية جديدة</small></div></button>
  </div>
  <div class="demo-box"><div><b>🎓 جرّب بشركة نموذجية</b><small>شركة تعبئة براغي بثلاثة شركاء: دورة 2024 كاملة ومقفلة، ودورة 2025 قيد الجرد بتنبيهات مفتوحة.</small></div>
    <button class="btn gold" data-action="loadDemo">تحميل الشركة النموذجية</button></div>`;
}

/* ===================== صفحة الشركة ===================== */

function companyView(id) {
  const c = db.Companies.find(x => x.id === id);
  if (!c) return '<div class="empty">الشركة غير موجودة. <a href="#/">رجوع</a></div>';
  const years = db.Years.filter(y => y.companyId === id).sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  const f = (fld, label, ph = '') => `<label>${label}<input data-t="Companies" data-id="${c.id}" data-f="${fld}" value="${esc(c[fld] || '')}" placeholder="${ph}"></label>`;
  return `
  <div class="crumbs"><a href="#/">الشركات</a> ‹ <b>${esc(c.name || 'شركة')}</b></div>
  <div class="co-page">
    <div class="card co-info">
      <div class="logo-box">
        ${c.logo ? `<img src="${c.logo}" alt="الشعار">` : '<div class="logo-ph">الشعار</div>'}
        <label class="btn ghost small">📷 ${c.logo ? 'تغيير' : 'رفع'} الشعار<input type="file" accept="image/*" hidden data-action-file="logo" data-id="${c.id}"></label>
        ${c.logo ? `<button class="btn ghost small" data-action="removeLogo" data-id="${c.id}">إزالة</button>` : ''}
      </div>
      <div class="grid g2 grow">
        ${f('name', 'اسم الشركة (عربي)', 'مثلاً: مؤسسة النور للتجارة')}
        ${f('nameFr', 'اسم الشركة (فرنسي)', 'Ets. Ennour')}
        ${f('legalForm', 'الشكل القانوني', 'شركة تضامن / شخص طبيعي…')}
        ${f('phone', 'الهاتف')}
        <label class="span2">العنوان<input data-t="Companies" data-id="${c.id}" data-f="address" value="${esc(c.address || '')}"></label>
      </div>
    </div>
    <div class="years-head"><h2>الدورات المالية</h2><button class="btn primary" data-action="newYear" data-id="${c.id}">+ دورة جديدة</button></div>
    <div class="years">
      ${years.map(y => {
        const R = compute(y.id);
        const issues = runChecks(R);
        const errs = issues.filter(i => i.level === 'error').length;
        return `<div class="year-card">
          <a href="#/y/${y.id}/setup" class="yc-main"><b>${esc(y.label || 'دورة')}</b><small>${fmtDate(y.start)} ← ${fmtDate(y.end)}</small>
          <div class="yc-nums"><span>${R.partners.length} شريك</span><span class="${R.result.isLoss ? 'neg' : 'pos'}">النتيجة ${fmt(R.result.net)}</span>
          <span class="${errs ? 'neg' : 'pos'}">${errs ? `✖ ${errs} أخطاء` : '✔ سليم'}</span></div></a>
          <button class="icon-btn" data-action="delYear" data-id="${y.id}" title="حذف الدورة">🗑</button></div>`;
      }).join('') || '<div class="empty">لا دورات بعد — أنشئ الأولى</div>'}
    </div>
    ${years.length > 1 ? compareBlock(years.slice().reverse()) : ''}
    <div class="danger-zone"><button class="btn ghost small danger-txt" data-action="delCompany" data-id="${c.id}">حذف الشركة وكل بياناتها</button></div>
  </div>`;
}

/* ===================== المقارنة بين الدورات ===================== */

function compareBlock(years) {
  const Rs = years.map(y => compute(y.id));
  const cols = [
    ['capital', 'رأس المال الصافي', R => R.totals.net],
    ['invested', 'المستثمر', R => R.totals.invested],
    ['result', 'النتيجة', R => R.result.net],
    ['zakat', 'الزكاة', R => R.zakat.total],
    ['newCap', 'رأس المال الجديد', R => R.totals.newCapital],
  ];
  const max = {};
  cols.forEach(([k, , f]) => (max[k] = Math.max(1, ...Rs.map(R => Math.abs(f(R))))));
  const bar = (k, v) => `<div class="dbar ${v < 0 ? 'neg' : ''} ${k}"><i style="width:${Math.round(Math.abs(v) / max[k] * 100)}%"></i><span>${fmt(v, 0)}</span></div>`;
  const delta = (R, i) => {
    if (!i) return '';
    const a = Rs[i - 1].result.net, b = R.result.net;
    if (!a) return '';
    const d = (b - a) / Math.abs(a) * 100;
    return `<small class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '▲' : '▼'} ${fmt(Math.abs(d), 0)}%</small>`;
  };
  return `<div class="card compare"><h3>📊 تطور الشركة عبر الدورات</h3>
    <table class="tbl cmp"><thead><tr><th>الدورة</th>${cols.map(c => `<th>${c[1]}</th>`).join('')}<th>مردودية المشروع</th></tr></thead><tbody>
    ${Rs.map((R, i) => `<tr><td><b>${esc(R.year.label)}</b> ${R.year.status === 'closed' ? '🔒' : ''}</td>
      ${cols.map(([k, , f]) => `<td>${bar(k, f(R))}${k === 'result' ? delta(R, i) : ''}</td>`).join('')}
      <td class="calc">${R.ratios.projectYield === null ? '—' : fmt(R.ratios.projectYield, 1) + ' %'}</td></tr>`).join('')}
    </tbody></table></div>`;
}

/* ===================== إنشاء دورة ===================== */

function newYearModal(companyId) {
  const prev = db.Years.filter(y => y.companyId === companyId).sort((a, b) => (b.end || '').localeCompare(a.end || ''))[0];
  const start = prev?.end ? addDays(prev.end, 1) : `${new Date().getFullYear() - 1}-01-01`;
  const end = addDays(start.replace(/^(\d{4})/, (m, y) => String(+y + 1)), -1);
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal"><h3>دورة مالية جديدة</h3>
    <div class="grid g3"><label>الاسم<input id="ny-label" value="${start.slice(0, 4)}"></label>
    <label>البداية<input type="date" id="ny-start" value="${start}"></label><label>النهاية<input type="date" id="ny-end" value="${end}"></label></div>
    ${prev ? `<label class="check"><input type="checkbox" id="ny-carry" checked> نقل الشركاء ورأس المال الجديد والإعدادات من دورة «${esc(prev.label)}»</label>
      <p class="hint">رأس المال الجديد لكل شريك يصبح رأس ماله الافتتاحي، والاحتياط يُجمع، وديون الزكاة والاقتطاعات والسحوبات المستحقة تُنقل إلى الخصوم.
      ${prev.status !== 'closed' ? '<br><b>تنبيه:</b> الدورة السابقة لم تُقفل بعد — أي تعديل فيها لاحقاً لن ينعكس هنا.' : ''}</p>` : ''}
    <div class="modal-actions"><button class="btn primary" data-ok>إنشاء</button><button class="btn ghost" data-no>إلغاء</button></div></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('[data-no]').onclick = () => wrap.remove();
  wrap.querySelector('[data-ok]').onclick = () => {
    const carry = prev && wrap.querySelector('#ny-carry')?.checked;
    const id = createYear(companyId, { label: $('#ny-label', wrap).value, start: $('#ny-start', wrap).value, end: $('#ny-end', wrap).value }, carry ? prev.id : null);
    wrap.remove();
    location.hash = `#/y/${id}/setup`;
  };
}

/* ===================== الإعدادات ===================== */

function settingsModal() {
  const c = getConfig();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal"><h3>⚙️ الإعدادات</h3>
    <p class="hint">الوضع الحالي: <b>${isRemote() ? '🟢 متصل بـ Google Sheets' : '🧪 محلي (هذا المتصفح فقط)'}</b></p>
    <label>رابط Apps Script (Web app URL)<input id="s-url" dir="ltr" value="${esc(c.apiUrl || '')}" placeholder="https://script.google.com/macros/s/.../exec"></label>
    <label>المفتاح السري<input id="s-key" dir="ltr" value="${esc(c.apiKey || '')}" placeholder="من ورقة Settings"></label>
    <div class="row-actions"><button class="btn ghost small" data-test>اختبار الاتصال</button><span id="s-msg"></span></div>
    <hr>
    <h4>نسخة احتياطية</h4>
    <div class="row-actions"><button class="btn ghost small" data-export>⬇ تصدير كل البيانات (JSON)</button>
      <label class="btn ghost small">⬆ استيراد<input type="file" accept=".json" hidden data-import></label></div>
    <p class="hint">الاستيراد يضيف البيانات أو يحدّثها في الوضع الحالي، ولا يحذف شيئاً. مفيد لنقل تجاربك المحلية إلى Google Sheets.</p>
    <div class="modal-actions"><button class="btn primary" data-ok>حفظ وإعادة التحميل</button>
      ${isRemote() ? '<button class="btn ghost" data-local>الرجوع للوضع المحلي</button>' : ''}<button class="btn ghost" data-no>إغلاق</button></div></div>`;
  document.body.appendChild(wrap);
  const msg = $('#s-msg', wrap);
  wrap.querySelector('[data-no]').onclick = () => wrap.remove();
  wrap.querySelector('[data-test]').onclick = async () => {
    msg.textContent = '…'; msg.className = '';
    try { await testConnection($('#s-url', wrap).value.trim(), $('#s-key', wrap).value.trim()); msg.textContent = '✔ الاتصال ناجح'; msg.className = 'pos'; }
    catch (e) { msg.textContent = '✖ ' + e.message; msg.className = 'neg'; }
  };
  wrap.querySelector('[data-ok]').onclick = () => {
    setConfig({ ...c, apiUrl: $('#s-url', wrap).value.trim(), apiKey: $('#s-key', wrap).value.trim() });
    location.reload();
  };
  wrap.querySelector('[data-local]')?.addEventListener('click', () => { setConfig({}); location.reload(); });
  wrap.querySelector('[data-export]').onclick = () => download(`tasfiya-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJSON());
  wrap.querySelector('[data-import]').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try { importJSON(await file.text()); toast('تم الاستيراد', 'ok'); wrap.remove(); render(); }
    catch (err) { toast('ملف غير صالح: ' + err.message, 'err'); }
  };
}

/* ===================== لوحة التحقق ===================== */

function checksDrawer() {
  const R = compute(route.id);
  const issues = runChecks(R);
  const wrap = document.createElement('div');
  wrap.className = 'drawer-wrap';
  const icon = { error: '✖', warn: '⚠', info: 'ℹ', check: '☐' };
  wrap.innerHTML = `<aside class="drawer"><div class="drawer-head"><h3>🧭 لوحة التحقق</h3><button class="icon-btn" data-close>✕</button></div>
    ${issues.length ? STEPS.map(s => {
      const mine = issues.filter(i => i.step === s.key);
      if (!mine.length) return '';
      return `<div class="dr-group"><h4>${s.icon} ${s.ar}</h4>${mine.map(i => `<a class="issue ${i.level}" href="#/y/${route.id}/${s.key}" data-ref="${esc(i.ref || '')}">
        <span>${icon[i.level]}</span> ${esc(i.msg)}</a>`).join('')}</div>`;
    }).join('') : '<div class="empty">✔ لا تنبيهات. كل شيء سليم.</div>'}</aside>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector('[data-close]').onclick = close;
  wrap.onclick = e => {
    if (e.target === wrap) return close();
    const a = e.target.closest('a.issue');
    if (a) { close(); const ref = a.dataset.ref; if (ref) setTimeout(() => focusRef(ref), 120); }
  };
}

function focusRef(ref) {
  const el = document.querySelector(`[data-ref="${CSS.escape(ref)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1800);
  el.querySelector('input')?.focus({ preventScroll: true });
}

/* ===================== لصق قائمة ===================== */

function pasteModal(kind, cat) {
  const accounts = kind === 'asset' ? ASSET_ACCOUNTS[cat] : LIABILITY_ACCOUNTS;
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal"><h3>📋 لصق قائمة من Excel</h3>
    <p class="hint">انسخ عمودين من Excel أو Sheets: <b>الاسم</b> ثم <b>المبلغ</b> (عمود ثالث اختياري للملاحظة)، والصقهما هنا.</p>
    <label>الحساب<select id="pm-acc">${accounts.map(a => `<option value="${a.key}">${a.ar}</option>`).join('')}</select></label>
    <textarea id="pm-text" rows="10" placeholder="زبون 1\t150000\nزبون 2\t48000,50"></textarea>
    <div class="modal-actions"><button class="btn primary" data-ok>إضافة</button><button class="btn ghost" data-no>إلغاء</button></div></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('[data-no]').onclick = () => wrap.remove();
  wrap.querySelector('[data-ok]').onclick = () => {
    const acc = $('#pm-acc', wrap).value;
    const lines = $('#pm-text', wrap).value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let n = 0;
    lines.forEach(l => {
      const parts = l.split(/\t|;/);
      const label = (parts[0] || '').trim();
      const amount = parseAmount(parts[1]);
      if (!label && !amount) return;
      if (kind === 'asset') newAsset(route.id, cat, { account: acc, label, gross: amount, note: (parts[2] || '').trim() });
      else newLiability(route.id, { account: acc, label, amount, note: (parts[2] || '').trim() });
      n++;
    });
    wrap.remove();
    toast(`أُضيف ${n} بنداً`, 'ok');
    render(true);
  };
}

function parseAmount(s) {
  if (s === undefined || s === null) return '';
  let t = String(s).replace(/[\s\u00a0\u202f\u2066-\u2069]/g, '').replace(/دج|DA|DZD/gi, '');
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else t = t.replace(',', '.');
  const n = parseFloat(t);
  return isNaN(n) ? '' : n;
}

/* ===================== المعاينة والطباعة ===================== */

function printOpts() {
  return {
    lang: $('#p-lang')?.value || 'arfr',
    logo: $('#p-logo')?.checked ?? true,
    sign: $('#p-sign')?.checked ?? true,
    partner: $('#p-partner')?.value || 'all',
  };
}

function doPrint(rep) {
  const root = $('#print-root');
  root.innerHTML = buildReport(route.id, rep, printOpts());
  document.body.classList.add('printing');
  const imgs = $$('img', root);
  Promise.all(imgs.map(i => (i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })))).then(() => {
    setTimeout(() => window.print(), 50);
  });
}
window.addEventListener('afterprint', () => { document.body.classList.remove('printing'); $('#print-root').innerHTML = ''; });

function preview(rep) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap preview-wrap';
  wrap.innerHTML = `<div class="preview"><div class="pv-bar"><b>معاينة</b><div><button class="btn primary small" data-print>🖨 طباعة</button>
    <button class="btn ghost small" data-no>إغلاق</button></div></div><div class="pv-pages">${buildReport(route.id, rep, printOpts())}</div></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('[data-no]').onclick = () => wrap.remove();
  wrap.querySelector('[data-print]').onclick = () => { wrap.remove(); doPrint(rep); };
  wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };
}

/* ===================== التحديث الحيّ ===================== */

const liveRefresh = debounce(() => {
  if (route.name !== 'year') return;
  const R = compute(route.id);
  if (!R) return;
  const issues = runChecks(R);
  const vals = liveValues(R);
  $$('[data-calc]').forEach(el => { const v = vals[el.dataset.calc]; if (v !== undefined) el.textContent = v; });
  const sum = $('#summary');
  if (sum) sum.innerHTML = summaryFor(sum.dataset.step, R);
  const chips = $('#head-chips'); if (chips) chips.innerHTML = headChips(R, issues);
  const st = $('#stepper'); if (st) st.innerHTML = stepper(route.id, route.step, issues);
}, 250);

/* ===================== الأحداث ===================== */

app.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.actionInput === 'filterRows') {
    const q = el.value.trim();
    $$('#rows-tbl tbody tr').forEach(tr => {
      const txt = $$('input', tr).map(i => i.value).join(' ') + tr.textContent;
      tr.style.display = !q || txt.includes(q) ? '' : 'none';
    });
    return;
  }
  if (!el.dataset.t || el.dataset.full !== undefined || el.tagName === 'SELECT') return;
  saveField(el);
  if (route.name === 'year') liveRefresh();
});

app.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.actionFile === 'logo') {
    const file = el.files[0]; if (!file) return;
    try { upsert('Companies', { id: el.dataset.id, logo: await imageToDataURL(file) }); toast('تم حفظ الشعار', 'ok'); render(true); }
    catch (err) { toast(err.message, 'err'); }
    return;
  }
  if (el.dataset.action === 'toggleCheck') {
    const yearId = route.id, itemId = el.dataset.item;
    const ex = db.Checklists.find(c => c.yearId === yearId && c.itemId === itemId);
    upsert('Checklists', { id: ex?.id || uid('ck'), yearId, step: el.dataset.step, itemId, checked: el.checked, at: new Date().toISOString() });
    render(true);
    return;
  }
  if (!el.dataset.t) return;
  if (el.tagName === 'SELECT' || el.dataset.full !== undefined) {
    saveField(el);
    if (el.dataset.t === 'Years' && el.dataset.f === 'zakatMode') {
      const y = db.Years.find(x => x.id === el.dataset.id);
      upsert('Years', { id: y.id, zakatRate: zakatRateFor(el.value, y.zakatRate) });
    }
    render(true);
  } else if (route.name !== 'year') {
    render(true);
  }
});

function saveField(el) {
  let v = el.value;
  if (el.dataset.num !== undefined) { v = parseAmount(v); }
  upsert(el.dataset.t, { id: el.dataset.id, [el.dataset.f]: v });
}

// تنسيق المبالغ عند مغادرة الخانة
app.addEventListener('focusout', e => {
  const el = e.target;
  if (el.classList?.contains('money') && el.value !== '') {
    const n = parseAmount(el.value);
    if (n !== '') el.value = fmt(n);
  }
});
app.addEventListener('focusin', e => {
  const el = e.target;
  if (el.classList?.contains('money') && el.value !== '') {
    const n = parseAmount(el.value);
    if (n !== '') el.value = String(n).replace('.', ',');
  }
});

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action]');
  if (!b || b.tagName === 'INPUT') return;
  const a = b.dataset.action;
  const year = route.name === 'year' ? db.Years.find(y => y.id === route.id) : null;
  const go = () => render(true);

  switch (a) {
    case 'openSettings': e.preventDefault(); settingsModal(); break;
    case 'openChecks': checksDrawer(); break;
    case 'focusRef': focusRef(b.dataset.ref); break;

    case 'addCompany': {
      const id = uid('c');
      upsert('Companies', { id, name: '', nameFr: '', legalForm: '', address: '', phone: '', logo: '', createdAt: new Date().toISOString() });
      location.hash = `#/c/${id}`;
      setTimeout(() => $('input[data-f="name"]')?.focus(), 50);
      break;
    }
    case 'removeLogo': upsert('Companies', { id: b.dataset.id, logo: '' }); go(); break;
    case 'newYear': newYearModal(b.dataset.id); break;
    case 'delYear': {
      if (!(await confirmBox('حذف هذه الدورة وكل بياناتها نهائياً؟', 'حذف'))) return;
      const id = b.dataset.id;
      ['PartnerYear', 'CapitalMoves', 'Assets', 'Liabilities', 'Deductions', 'Checklists', 'Results'].forEach(t => removeMany(t, r => r.yearId === id));
      remove('Years', id); go(); break;
    }
    case 'delCompany': {
      if (!(await confirmBox('حذف الشركة وكل دوراتها وشركائها نهائياً؟', 'حذف الكل'))) return;
      const id = b.dataset.id;
      db.Years.filter(y => y.companyId === id).forEach(y => {
        ['PartnerYear', 'CapitalMoves', 'Assets', 'Liabilities', 'Deductions', 'Checklists', 'Results'].forEach(t => removeMany(t, r => r.yearId === y.id));
        remove('Years', y.id);
      });
      removeMany('Partners', p => p.companyId === id);
      remove('Companies', id);
      location.hash = '#/'; break;
    }

    case 'addDeduction': upsert('Deductions', { id: uid('d'), yearId: year.id, label: '', labelFr: '', pct: '' }); go(); break;
    case 'del': {
      remove(b.dataset.t, b.dataset.id); go(); break;
    }
    case 'calcNisab': {
      const g = parseAmount($('#goldPrice')?.value);
      if (!g) return toast('أدخل سعر غرام الذهب أولاً', 'err');
      upsert('Years', { id: year.id, nisab: round2(g * 85) }); toast(`النصاب = ${fmt(g * 85)} دج`, 'ok'); go(); break;
    }

    case 'addPartner': {
      const pid = newPartner(year); go();
      setTimeout(() => focusRef(pid), 60); break;
    }
    case 'addExistingPartner': {
      const pid = $('#existingPartner')?.value; if (!pid) return;
      newPartner(year, pid); go(); break;
    }
    case 'removePartner': {
      if (!(await confirmBox('حذف هذا الشريك من هذه الدورة مع حركاته؟', 'حذف'))) return;
      const pid = b.dataset.id;
      removeMany('PartnerYear', r => r.yearId === year.id && r.partnerId === pid);
      removeMany('CapitalMoves', r => r.yearId === year.id && r.partnerId === pid);
      if (!db.PartnerYear.some(r => r.partnerId === pid)) remove('Partners', pid);
      go(); break;
    }
    case 'addMove': {
      const id = uid('m');
      upsert('CapitalMoves', { id, yearId: year.id, partnerId: b.dataset.pid, type: b.dataset.type, amount: '', date: '', note: '' });
      go(); setTimeout(() => focusRef(id), 60); break;
    }
    case 'addAsset': { const id = newAsset(year.id, b.dataset.cat); go(); setTimeout(() => focusRef(id), 60); break; }
    case 'addLiability': { const id = newLiability(year.id); go(); setTimeout(() => focusRef(id), 60); break; }
    case 'pasteRows': pasteModal(b.dataset.kind, b.dataset.cat); break;

    case 'nextStep': {
      const R = compute(year.id);
      const open = runChecks(R).filter(i => i.step === b.dataset.step && (i.level === 'error' || i.level === 'check'));
      if (open.length) {
        const msg = open.map(i => '• ' + i.msg).join('\n');
        const ok = await confirmBox(`بقيت نقاط مفتوحة في هذه الخطوة:\n${msg}\n\nهل تريد المتابعة رغم ذلك؟`, 'أعلم، تابع', false);
        if (!ok) return;
      }
      location.hash = `#/y/${year.id}/${b.dataset.next}`; break;
    }

    case 'loadDemo': {
      const cid = loadDemo(); toast('تم تحميل الشركة النموذجية', 'ok'); location.hash = `#/c/${cid}`; break;
    }
    case 'seedPnl': seedPnl(year.id); go(); break;
    case 'addPnl': {
      const id = uid('pl');
      upsert('PnL', { id, yearId: year.id, kind: b.dataset.kind, label: '', labelFr: '', amount: '', order: db.PnL.length + 1 });
      go(); setTimeout(() => focusRef(id), 60); break;
    }
    case 'exportXlsx': exportYearXlsx(year.id); toast('تم تجهيز ملف Excel', 'ok'); break;
    case 'closeYear': {
      const errs = runChecks(compute(year.id)).filter(i => i.level === 'error');
      const msg = errs.length ? `توجد ${errs.length} أخطاء مفتوحة. هل تريد الإقفال رغم ذلك؟` : 'إقفال الدورة وتجميد نتائجها؟ يمكنك فتحها لاحقاً عند الحاجة.';
      if (!(await confirmBox(msg, '🔒 إقفال', false))) return;
      closeYear(year.id); toast('أُقفلت الدورة وحُفظت النتائج', 'ok'); go(); break;
    }
    case 'unlockYear': {
      if (!(await confirmBox('فتح الدورة للتعديل؟ ستُعاد كتابة النتائج المجمّدة عند الإقفال القادم.', 'فتح', false))) return;
      unlockYear(year.id); go(); break;
    }
    case 'preview': preview(b.dataset.rep); break;
    case 'print': doPrint(b.dataset.rep); break;
  }
});

$('#btn-settings').onclick = settingsModal;
$('#btn-home').onclick = () => (location.hash = '#/');

/* ===================== حالة الحفظ ===================== */

onStatus(s => {
  const el = $('#sync');
  const map = {
    idle: ['', ''], local: ['🧪 محلي', 'local'], loading: ['⏳ تحميل…', 'busy'], pending: ['● تعديلات…', 'busy'],
    saving: ['⏳ حفظ…', 'busy'], saved: ['✔ محفوظ', 'ok'], error: ['✖ لم يُحفظ — إعادة المحاولة', 'err'],
  };
  const [txt, cls] = map[s.state] || ['', ''];
  el.textContent = txt; el.className = 'sync ' + cls;
  el.title = s.error || '';
});

/* ===================== البدء ===================== */

(async () => {
  try { await load(); }
  catch (e) {
    app.innerHTML = `<div class="empty">تعذّر الاتصال بالخادم: ${esc(e.message)}<br><br>
      <button class="btn primary" data-action="openSettings">فتح الإعدادات</button></div>`;
    return;
  }
  render();
})();
