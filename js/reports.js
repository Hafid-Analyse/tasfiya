// الكشوفات القابلة للطباعة (A4، عربية أو عربية + فرنسية، مع الشعار)
import { db } from './store.js';
import { compute } from './calc.js';
import { ASSET_CATEGORIES, ASSET_ACCOUNTS, AUTO_ADVANCES, LIABILITY_ACCOUNTS, STATUSES, accountOf, statusOf } from './config.js';
import { checklistDefs } from './checks.js';
import { distributionTable, ratioRows } from './steps.js';
import { fmt, fmtPct, fmtDate, esc } from './util.js';

let O = { lang: 'arfr', logo: true, sign: true, partner: 'all' };
const T = (ar, fr) => (O.lang === 'arfr' && fr ? `${ar}<span class="fr">${esc(fr)}</span>` : ar);

function header(R, company, titleAr, titleFr) {
  return `<header class="r-head">
    <div class="r-co">${O.logo && company.logo ? `<img src="${company.logo}" alt="">` : ''}
      <div><b>${esc(company.name || '')}</b>${O.lang === 'arfr' && company.nameFr ? `<small class="fr">${esc(company.nameFr)}</small>` : ''}
      ${company.address ? `<small>${esc(company.address)}</small>` : ''}</div></div>
    <div class="r-title"><h1>${titleAr}</h1>${O.lang === 'arfr' && titleFr ? `<div class="fr">${titleFr}</div>` : ''}</div>
    <div class="r-date"><span>${T('الدورة', 'Exercice')}: <b>${esc(R.year.label || '')}</b></span>
      <span>${fmtDate(R.year.start)} ← ${fmtDate(R.year.end)}</span></div>
  </header>`;
}

function signatures(names) {
  if (!O.sign) return '';
  return `<footer class="r-sign">${names.map(n => `<div><span>${n}</span><i></i></div>`).join('')}</footer>`;
}

const page = (inner, cls = '') => `<section class="page ${cls}">${inner}<div class="r-foot">${T('أُعِدّ بتطبيق تصفية حساب الشركاء', '')} — ${new Date().toLocaleDateString('fr-FR')}</div></section>`;

/* ---------- الميزانية الختامية ---------- */
function balance(R, company) {
  const actif = ASSET_CATEGORIES.map(c => {
    const cat = R.assets.byCat[c.key];
    const accs = [...ASSET_ACCOUNTS[c.key], ...(c.key === 'receivables' ? [AUTO_ADVANCES] : [])].map(a => {
      const rows = cat.rows.filter(r => r.account === a.key);
      return { a, gross: rows.reduce((s, r) => s + r.gross, 0), red: rows.reduce((s, r) => s + r.reduction, 0), net: rows.reduce((s, r) => s + r.net, 0), n: rows.length };
    }).filter(x => x.n);
    return `<tr class="grp"><td>${c.code}</td><td>${T(c.ar, c.fr)}</td><td>${fmt(cat.gross)}</td><td>${fmt(cat.reduction)}</td><td>${fmt(cat.net)}</td><td>${fmtPct(R.assets.net ? cat.net / R.assets.net * 100 : 0, 1)}</td></tr>
      ${accs.map(x => `<tr><td></td><td class="ind">${T(x.a.ar, x.a.fr)}</td><td>${fmt(x.gross)}</td><td>${fmt(x.red)}</td><td>${fmt(x.net)}</td><td></td></tr>`).join('')}`;
  }).join('');

  const liabAccs = LIABILITY_ACCOUNTS.map(a => {
    const rows = R.liabilities.rows.filter(l => l.account === a.key);
    return { a, v: rows.reduce((s, r) => s + r.amount, 0), n: rows.length };
  }).filter(x => x.n);
  const totalPassif = R.equity.total + R.liabilities.total + R.result.net;
  const pc = v => fmtPct(totalPassif ? v / totalPassif * 100 : 0, 1);

  return page(`${header(R, company, 'الميزانية الختامية', 'Bilan de clôture')}
  <div class="bal">
    <table class="rt"><thead><tr><th colspan="6" class="side">${T('الأصول', 'Actif')}</th></tr>
      <tr><th></th><th>${T('الحسابات', 'Comptes')}</th><th>${T('المبالغ', 'Brut')}</th><th>${T('تناقص القيمة', 'Amort./Prov.')}</th><th>${T('الصافي', 'Net')}</th><th>%</th></tr></thead>
      <tbody>${actif}</tbody>
      <tfoot><tr><td></td><td>${T('مجموع الأصول', 'Total actif')}</td><td>${fmt(R.assets.gross)}</td><td>${fmt(R.assets.reduction)}</td><td>${fmt(R.assets.net)}</td><td>100 %</td></tr></tfoot></table>
    <table class="rt"><thead><tr><th colspan="3" class="side">${T('الخصوم', 'Passif')}</th></tr>
      <tr><th>${T('الحسابات', 'Comptes')}</th><th>${T('المبالغ', 'Montants')}</th><th>%</th></tr></thead>
      <tbody>
        <tr class="grp"><td>${T('رؤوس الأموال', 'Capitaux propres')}</td><td>${fmt(R.equity.total)}</td><td>${pc(R.equity.total)}</td></tr>
        <tr><td class="ind">${T('رأس المال الصافي للشركاء', 'Capital net des associés')}</td><td>${fmt(R.equity.netCapital)}</td><td></td></tr>
        ${R.equity.prevReserve ? `<tr><td class="ind">${T('احتياط سابق', 'Réserves antérieures')}</td><td>${fmt(R.equity.prevReserve)}</td><td></td></tr>` : ''}
        <tr class="grp"><td>${T('الديون', 'Dettes')}</td><td>${fmt(R.liabilities.total)}</td><td>${pc(R.liabilities.total)}</td></tr>
        ${liabAccs.map(x => `<tr><td class="ind">${T(x.a.ar, x.a.fr)}</td><td>${fmt(x.v)}</td><td></td></tr>`).join('')}
        <tr class="grp ${R.result.isLoss ? 'neg' : ''}"><td>${T('النتيجة الصافية', 'Résultat net')}</td><td>${fmt(R.result.net)}</td><td>${pc(R.result.net)}</td></tr>
        ${R.result.deductions.filter(d => d.amount).map(d => `<tr><td class="ind">${T(esc(d.label), d.labelFr)} (${fmtPct(d.pct, 1)})</td><td>${fmt(d.amount)}</td><td></td></tr>`).join('')}
        ${R.result.dedTotal ? `<tr><td class="ind"><b>${T('النتيجة بعد الاقتطاعات', 'Résultat après prélèvements')}</b></td><td><b>${fmt(R.result.afterDed)}</b></td><td></td></tr>` : ''}
      </tbody>
      <tfoot><tr><td>${T('مجموع الخصوم', 'Total passif')}</td><td>${fmt(totalPassif)}</td><td>100 %</td></tr></tfoot></table>
  </div>
  ${signatures([T('المحاسب', 'Le comptable'), T('المسيّر', 'Le gérant')])}`);
}

/* ---------- جدول التوزيع ---------- */
function distribution(R, company) {
  const r = R.result;
  const kv = (l, v, cls = '') => `<div class="${cls}"><span>${l}</span><b>${v}</b></div>`;
  return page(`${header(R, company, 'تصفية حسابات الشركاء', 'Répartition des résultats')}
  <div class="kv">
    ${kv(T('النتيجة الصافية', 'Résultat net'), fmt(r.net))}
    ${kv(T('بعد الاقتطاعات', 'Après prélèvements'), fmt(r.afterDed))}
    ${kv(T('الاحتياط', 'Réserve') + ` (${fmtPct(r.reservePct, 1)})`, fmt(r.reserve))}
    ${kv(T('نصيب الجهد', 'Part travail') + ` (${fmtPct(r.effortPct, 1)})`, fmt(r.effortPool))}
    ${kv(T('نصيب المال', 'Part capital'), fmt(r.moneyPool))}
    ${kv(T('الأموال غير الزكوية', 'Biens non zakatables'), fmt(R.assets.nonZakat))}
    ${kv(T('النصاب', 'Nissab'), R.zakat.nisab ? fmt(R.zakat.nisab) : '—')}
    ${kv(T('نسبة الزكاة', 'Taux zakat'), fmtPct(R.zakat.rate, 3))}
    ${kv(T('مجموع الزكاة', 'Total zakat'), fmt(R.zakat.total), 'gold')}
  </div>
  ${distributionTable(R, { print: true })}
  ${r.isLoss ? `<p class="note">${T('النتيجة خسارة: وُزّعت على رؤوس الأموال وحدها بقدر الحصص، دون اقتطاعات ولا احتياط ولا نصيب جهد.', '')}</p>` : ''}
  ${signatures(R.partners.slice(0, 6).map(x => esc(x.p.name)))}`, 'landscape');
}

/* ---------- كشف حساب الشريك ---------- */
function statement(R, company, x) {
  const L = (ar, fr, v, cls = '') => `<tr class="${cls}"><td>${T(ar, fr)}</td><td>${v}</td></tr>`;
  return page(`${header(R, company, 'كشف حساب الشريك', 'Relevé de compte associé')}
  <div class="who"><span>${T('السيد(ة)', 'M./Mme')}:</span> <b>${esc(x.p.name)}</b> <span class="sep">•</span>
    <span>${T('التاريخ', 'Date')}: ${fmtDate(R.year.end)}</span></div>
  <table class="rt stmt"><tbody>
    ${L('رأس المال الافتتاحي', 'Capital initial', fmt(x.opening))}
    ${L('السحوبات', 'Retraits', fmt(x.withdrawals))}
    ${L('الإضافات', 'Apports', fmt(x.additions))}
    ${L('رأس المال الصافي', 'Capital net', fmt(x.net), 'sub')}
    ${L('رأس المال المستثمر (المرجّح بالأيام)', 'Capital investi (pondéré)', fmt(x.invested))}
    ${L('نسبته من مجموع المستثمر', 'Quote-part', fmtPct(x.investedRatio * 100))}
    ${L('ربح المال', 'Bénéfice du capital', fmt(x.moneyProfit))}
    ${L('المردودية المالية', 'Rentabilité financière', fmtPct(x.yieldPct))}
    ${x.effortShare || x.effortProfit ? L(`ربح الجهد (${fmtPct(x.effortShare, 1)})`, 'Bénéfice du travail', fmt(x.effortProfit)) : ''}
    ${x.advances ? L('تسبيقات الربح', 'Avances sur bénéfices', '− ' + fmt(x.advances)) : ''}
    ${L('المجموع', 'Total', fmt(x.total), 'sub')}
    ${L('وعاء الزكاة', 'Assiette zakat', fmt(x.zakatBase))}
    ${L(`الزكاة (${fmtPct(R.zakat.rate, 3)})`, 'Zakat', x.reachesNisab ? fmt(x.zakat) : T('لم يبلغ النصاب', 'Sous le nissab'), 'gold')}
    ${x.postWithdrawals ? L('سحوبات بعد التوزيع', 'Retraits après répartition', '− ' + fmt(x.postWithdrawals)) : ''}
    ${L('رأس المال الجديد', 'Nouveau capital', fmt(x.newCapital), 'total ' + (x.debtor ? 'neg' : ''))}
    ${L('نسبته في السنة الجديدة', 'Nouvelle quote-part', fmtPct(x.newRatio * 100))}
  </tbody></table>
  ${x.debtor ? `<p class="note neg">${T('الشريك مدين للشركة بمبلغ', 'Associé débiteur de')} ${fmt(-x.newCapital)}</p>` : ''}
  ${x.py.notes ? `<p class="note">${T('ملاحظات', 'Notes')}: ${esc(x.py.notes)}</p>` : ''}
  ${x.moves.length ? `<h3 class="r-sub">${T('حركة رأس المال خلال السنة', 'Mouvements du capital')}</h3>${movesTable(x)}` : ''}
  ${signatures([T('الشريك', "L'associé"), T('المسيّر', 'Le gérant')])}`);
}

function movesTable(x) {
  return `<table class="rt small"><thead><tr><th>${T('التاريخ', 'Date')}</th><th>${T('النوع', 'Type')}</th><th>${T('المبلغ', 'Montant')}</th>
    <th>${T('الوزن', 'Poids')}</th><th>${T('المبلغ المرجّح', 'Pondéré')}</th><th>${T('ملاحظة', 'Note')}</th></tr></thead><tbody>
    ${x.moves.map(m => `<tr><td>${fmtDate(m.date)}</td><td>${m.type === 'withdrawal' ? T('سحب', 'Retrait') : T('إضافة', 'Apport')}</td>
      <td>${fmt(m.amount)}</td><td>${fmtPct(m.weight * 100, 1)}</td><td>${fmt(m.weighted)}</td><td>${esc(m.note || '')}</td></tr>`).join('')}
  </tbody></table>`;
}

/* ---------- حركة رؤوس الأموال ---------- */
function capital(R, company) {
  return page(`${header(R, company, 'حركة رؤوس الأموال', 'Mouvements des capitaux')}
  <p class="note">${T('عدد أيام الدورة', 'Nombre de jours')}: <b>${R.days}</b> — ${T('السحب يُرجَّح بالأيام التي بقي فيها قبل سحبه، والإضافة بالأيام التي بقيت فيها بعد إدخالها.', '')}</p>
  ${R.partners.map(x => `<div class="cap-block">
    <h3 class="r-sub">${esc(x.p.name)}</h3>
    <div class="kv small">
      <div><span>${T('الافتتاحي', 'Initial')}</span><b>${fmt(x.opening)}</b></div>
      <div><span>${T('السحوبات', 'Retraits')}</span><b>${fmt(x.withdrawals)}</b></div>
      <div><span>${T('الإضافات', 'Apports')}</span><b>${fmt(x.additions)}</b></div>
      <div><span>${T('الصافي', 'Net')}</span><b>${fmt(x.net)}</b></div>
      <div class="gold"><span>${T('المستثمر', 'Investi')}</span><b>${fmt(x.invested)}</b></div>
    </div>
    ${x.moves.length ? movesTable(x) : `<p class="muted">${T('لا حركات خلال السنة', 'Aucun mouvement')}</p>`}
  </div>`).join('')}`);
}

/* ---------- محضر الجرد ---------- */
function inventory(R, company) {
  const yearId = R.year.id;
  const blocks = ASSET_CATEGORIES.map(c => {
    const rows = R.assets.byCat[c.key].rows.filter(r => !r.auto);
    if (!rows.length) return '';
    const counts = (STATUSES[c.key] || []).map(s => {
      const rs = rows.filter(r => (r.status || STATUSES[c.key][0].key) === s.key);
      return rs.length ? `<span>${s.icon} ${s.ar}: ${rs.length} (${fmt(rs.reduce((a, r) => a + r.gross, 0))})</span>` : '';
    }).join('');
    return `<h3 class="r-sub">${T(c.ar, c.fr)}</h3><div class="counts">${counts}</div>
    <table class="rt small"><thead><tr><th>${T('الحساب', 'Compte')}</th><th>${T('البيان', 'Libellé')}</th><th>${T('الحالة', 'État')}</th>
      <th>${T('المبلغ', 'Brut')}</th><th>${T('التخفيض', 'Réduction')}</th><th>${T('الصافي', 'Net')}</th><th>${T('ملاحظة', 'Note')}</th></tr></thead><tbody>
      ${rows.map(r => { const st = statusOf(c.key, r.status); const a = accountOf(c.key, r.account);
        return `<tr class="st-${st.key}"><td>${T(a.ar, a.fr)}</td><td>${esc(r.label)}</td><td>${st.icon} ${st.ar}${st.reduce === 'pct' ? ` ${fmtPct(r.pct, 0)}` : ''}</td>
        <td>${fmt(r.gross)}</td><td>${fmt(r.reduction)}</td><td>${fmt(r.net)}</td><td>${esc(r.note || '')}</td></tr>`; }).join('')}
    </tbody><tfoot><tr><td colspan="3">${T('المجموع', 'Total')}</td><td>${fmt(R.assets.byCat[c.key].gross)}</td><td>${fmt(R.assets.byCat[c.key].reduction)}</td><td>${fmt(R.assets.byCat[c.key].net)}</td><td></td></tr></tfoot></table>`;
  }).join('');

  const defs = checklistDefs();
  const checks = defs.map(d => {
    const ok = db.Checklists.some(c => c.yearId === yearId && c.itemId === d.id && c.checked);
    return `<li class="${ok ? 'ok' : 'no'}">${ok ? '☑' : '☐'} ${esc(d.text)}</li>`;
  }).join('');

  return page(`${header(R, company, 'محضر الجرد', 'Procès-verbal d\'inventaire')}
  ${blocks || `<p class="muted">${T('لا بنود', '')}</p>`}
  <h3 class="r-sub">${T('قائمة التحقق', 'Points de contrôle')}</h3><ul class="checks-list">${checks}</ul>
  ${signatures([T('القائم بالجرد', "L'inventoriste"), T('المسيّر', 'Le gérant'), T('عن الشركاء', 'Pour les associés')])}`);
}

/* ---------- التحليل المالي وتحليل النتيجة ---------- */
function analysis(R, company) {
  const P = R.pnl;
  const pc = v => (P.hasData ? fmtPct(P.pct(v), 1) : '');
  const L = (ar, fr, v, cls = '') => `<tr class="${cls}"><td>${T(ar, fr)}</td><td>${fmt(v)}</td><td>${pc(v)}</td></tr>`;
  const groups = [['fixed', 'التكاليف الثابتة', 'Charges fixes'], ['variable', 'التكاليف المتغيرة', 'Charges variables']];
  return page(`${header(R, company, 'التحليل المالي وتحليل النتيجة', 'Analyse financière et du résultat')}
  <h3 class="r-sub">${T('المعدلات المالية', 'Ratios financiers')}</h3>
  <table class="rt small ratios-t"><thead><tr><th>${T('المعدل', 'Ratio')}</th><th>${T('طريقة الحساب', 'Formule')}</th><th>${T('القيمة', 'Valeur')}</th><th>${T('المقبول', 'Norme')}</th><th></th></tr></thead><tbody>
    ${ratioRows(R).map(r => `<tr class="r-${r.st}"><td><b>${T(r.ar, r.fr)}</b></td><td>${r.desc}</td><td>${r.v === null ? '—' : fmtPct(r.v, 1)}</td><td>${r.norm}</td>
      <td>${r.st === 'good' ? '✔' : r.st === 'bad' ? '✖' : ''}</td></tr>`).join('')}
  </tbody></table>
  <h3 class="r-sub">${T('تحليل النتيجة', 'Analyse du résultat')}</h3>
  ${P.rows.length ? `<div class="bal two">
    <table class="rt small stmt-like"><thead><tr><th>${T('البيان', 'Libellé')}</th><th>${T('المبلغ', 'Montant')}</th><th>%</th></tr></thead><tbody>
      ${L('رقم الأعمال', "Chiffre d'affaires", P.revenue, 'grp')}
      ${L('مستهلكات المخزون', 'Consommations', P.consumption)}
      ${L('الهامش الإجمالي', 'Marge brute', P.gross, 'grp')}
      ${L('التكاليف الثابتة', 'Charges fixes', P.fixed)}
      ${L('التكاليف المتغيرة', 'Charges variables', P.variable)}
      ${L('اهتلاكات السنة', 'Dotations', P.depreciation)}
      ${L('نتيجة الحسابات', 'Résultat comptable', P.net, 'grp')}
      <tr><td>${T('نتيجة الجرد', "Résultat d'inventaire")}</td><td>${fmt(R.result.net)}</td><td></td></tr>
      <tr class="${Math.abs(P.diff) > 1 ? 'r-bad' : ''}"><td>${T('الفرق', 'Écart')}</td><td>${fmt(P.diff)}</td><td></td></tr>
      ${P.breakEven !== null ? `<tr><td>${T('عتبة المردودية', 'Seuil de rentabilité')}</td><td>${fmt(P.breakEven)}</td><td></td></tr>` : ''}
    </tbody></table>
    <table class="rt small"><thead><tr><th>${T('تفصيل التكاليف', 'Détail des charges')}</th><th>${T('المبلغ', 'Montant')}</th><th>%</th></tr></thead><tbody>
      ${groups.map(([k, ar, fr]) => `<tr class="grp"><td>${T(ar, fr)}</td><td>${fmt(P[k])}</td><td>${fmtPct(P[k] ? 100 : 0, 0)}</td></tr>
        ${P.rows.filter(r => r.kind === k && r.amount).map(r => `<tr><td class="ind">${esc(r.label)}</td><td>${fmt(r.amount)}</td><td>${fmtPct(P[k] ? r.amount / P[k] * 100 : 0, 1)}</td></tr>`).join('')}`).join('')}
    </tbody></table></div>` : `<p class="muted">${T('لم تُدخل بنود الحسابات لهذه الدورة', '')}</p>`}`);
}

/* ---------- الميزانية الافتتاحية ---------- */
function opening(R, company) {
  const O2 = R.opening;
  const actif = ASSET_CATEGORIES.map(c => {
    const net = R.assets.byCat[c.key].net - (c.key === 'receivables' ? R.totals.advances : 0);
    return `<tr><td>${c.code}</td><td>${T(c.ar, c.fr)}</td><td>${fmt(net)}</td></tr>`;
  }).join('');
  const liabAccs = LIABILITY_ACCOUNTS.map(a => {
    const v = R.liabilities.rows.filter(l => l.account === a.key).reduce((s, r) => s + r.amount, 0);
    return v ? `<tr><td class="ind">${T(a.ar, a.fr)}</td><td>${fmt(v)}</td></tr>` : '';
  }).join('');
  const extra = O2.extraLiab.map(l => {
    const a = LIABILITY_ACCOUNTS.find(x => x.key === l.key) || {};
    return `<tr><td class="ind">${T(esc(l.label || a.ar), l.labelFr || a.fr)} <small>(${T('من التوزيع', '')})</small></td><td>${fmt(l.amount)}</td></tr>`;
  }).join('');
  return page(`${header(R, company, 'الميزانية الافتتاحية', "Bilan d'ouverture")}
  <p class="note">${T('للدورة التي تبدأ بعد', 'Exercice suivant le')} ${fmtDate(R.year.end)} — ${T('بعد توزيع الأرباح ودفع الزكاة والاقتطاعات.', '')}</p>
  <div class="bal">
    <table class="rt"><thead><tr><th colspan="3" class="side">${T('الأصول', 'Actif')}</th></tr>
      <tr><th></th><th>${T('الحسابات', 'Comptes')}</th><th>${T('المبالغ', 'Montants')}</th></tr></thead>
      <tbody>${actif}</tbody>
      <tfoot><tr><td></td><td>${T('مجموع الأصول', 'Total actif')}</td><td>${fmt(O2.assetsNet)}</td></tr></tfoot></table>
    <table class="rt"><thead><tr><th colspan="2" class="side">${T('الخصوم', 'Passif')}</th></tr>
      <tr><th>${T('الحسابات', 'Comptes')}</th><th>${T('المبالغ', 'Montants')}</th></tr></thead>
      <tbody>
        <tr class="grp"><td>${T('رؤوس الأموال', 'Capitaux propres')}</td><td>${fmt(O2.equityTotal)}</td></tr>
        ${O2.partners.map(p => `<tr><td class="ind">${esc(p.name)} (${fmtPct(p.ratio * 100, 1)})</td><td>${fmt(p.capital)}</td></tr>`).join('')}
        ${O2.reserves ? `<tr><td class="ind">${T('الاحتياط', 'Réserves')}</td><td>${fmt(O2.reserves)}</td></tr>` : ''}
        <tr class="grp"><td>${T('الديون', 'Dettes')}</td><td>${fmt(O2.liabTotal)}</td></tr>
        ${liabAccs}${extra}
      </tbody>
      <tfoot><tr><td>${T('مجموع الخصوم', 'Total passif')}</td><td>${fmt(O2.equityTotal + O2.liabTotal)}</td></tr></tfoot></table>
  </div>
  ${Math.abs(O2.balanceGap) > 0.05 ? `<p class="note neg">${T('تنبيه: فارق في التوازن', 'Écart')} ${fmt(O2.balanceGap)}</p>` : ''}
  ${signatures([T('المحاسب', 'Le comptable'), T('المسيّر', 'Le gérant')])}`);
}

/* ---------- التجميع ---------- */
export function buildReport(yearId, rep, opts) {
  O = { ...O, ...opts };
  const R = compute(yearId);
  const company = db.Companies.find(c => c.id === R.year.companyId) || {};
  const stmts = () => R.partners.filter(x => O.partner === 'all' || x.p.id === O.partner).map(x => statement(R, company, x)).join('');
  const map = {
    balance: () => balance(R, company),
    distribution: () => distribution(R, company),
    statements: stmts,
    capital: () => capital(R, company),
    inventory: () => inventory(R, company),
    analysis: () => analysis(R, company),
    opening: () => opening(R, company),
  };
  if (rep === 'all') return map.balance() + map.distribution() + map.inventory() + map.capital() + map.analysis() + map.opening() + stmts();
  return map[rep]();
}
