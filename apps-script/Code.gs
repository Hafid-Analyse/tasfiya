/**
 * تطبيق جرد الأعمال وتصفية حساب الشركاء — الخادم (Google Apps Script)
 * ---------------------------------------------------------------
 * الدور: الحفظ والقراءة فقط. كل الحسابات تتم في الواجهة.
 * الشيت كله بالعربية (أسماء الأوراق، رؤوس الأعمدة، والقيم)،
 * وهذا الملف يترجم بينه وبين المفاتيح الداخلية التي تستعملها الواجهة.
 *
 * طريقة التركيب (مرة واحدة):
 *  1) في الشيت: Extensions ← Apps Script، الصق هذا الملف كاملاً واحفظ
 *  2) اختر الدالة setup واضغط Run (وافق على الصلاحيات)
 *     ← تُنشأ الأوراق بالعربية (أو تُحوَّل الأوراق الإنجليزية القديمة)
 *     ← المفتاح السري في ورقة «الإعدادات» وفي قائمة «⚖️ تصفية»
 *  3) Deploy ← New deployment ← Web app
 *       Execute as: Me    |   Who has access: Anyone   ← مهم
 *     عند كل تعديل لاحق: Manage deployments ← ✏️ ← New version
 */

/* ===================== القواميس ===================== */

var ENUMS = {
  bool: { 'true': 'نعم', 'false': 'لا' },
  status: { draft: 'مسودة', closed: 'مقفلة' },
  zakatMode: { solar: 'شمسية', hijri: 'هجرية', custom: 'مخصصة' },
  moveType: { withdrawal: 'سحب', addition: 'إضافة' },
  category: { invest: 'الاستثمارات', stocks: 'المخزونات', receivables: 'الحقوق', treasury: 'الخزينة' },
  account: {
    amenagements: 'مصاريف التهيئة', roulant: 'معدات النقل', outillage: 'معدات وأدوات', equipements: 'التجهيزات',
    invest_other: 'استثمارات أخرى', marchandises: 'بضائع', matieres: 'مواد أولية', produits: 'منتجات تامة',
    stock_other: 'مخزونات أخرى', clients: 'ديون الزبائن', av_fourn: 'تسبيقات الموردين', prets: 'سلف الموظفين',
    av_location: 'تسبيق الكراء', impots: 'ضرائب ورسوم مدفوعة مسبقاً', rec_other: 'حقوق أخرى',
    caisse: 'الصندوق', banque: 'البنك', ccp: 'الحساب البريدي'
  },
  assetStatus: {
    confirmed: 'مؤكَّد', doubtful: 'مشكوك فيه', bad: 'معدوم', unchecked: 'لم يُؤكَّد بعد',
    good: 'سليم', slow: 'راكد', damaged: 'تالف', lost: 'فاقد',
    inuse: 'مستعمل', idle: 'معطّل', scrapped: 'خارج الخدمة',
    verified: 'مطابق', unverified: 'لم يُطابق'
  },
  liabAccount: {
    fournisseurs: 'ديون الموردين', av_clients: 'تسبيقات الزبائن', personnel: 'ديون العمال والمتعاونين',
    impots_ss: 'الضرائب والضمان الاجتماعي', services: 'ديون الخدمات', associes: 'ديون الشركاء',
    location: 'ديون الكراء', zakat_due: 'زكاة مستحقة', liab_other: 'ديون أخرى'
  },
  step: {
    setup: 'الإعداد', partners: 'الشركاء', capital: 'حركة رؤوس الأموال', invest: 'الاستثمارات',
    stocks: 'المخزونات', receivables: 'الحقوق والزبائن', treasury: 'الخزينة', liabilities: 'الخصوم والديون',
    distribution: 'النتيجة والتوزيع والزكاة', analysis: 'تحليل النتيجة والميزانية', reports: 'الكشوفات والإقفال'
  },
  pnlKind: {
    revenue: 'رقم الأعمال', consumption: 'مستهلكات المخزون', fixed: 'تكاليف ثابتة',
    variable: 'تكاليف متغيرة', depr: 'اهتلاكات السنة'
  }
};

// [المفتاح الداخلي، رأس العمود بالعربية، القاموس (اختياري)، رقمي؟]
var TABLES = {
  Companies: { sheet: 'الشركات', cols: [
    ['id', 'المعرّف'], ['name', 'اسم الشركة'], ['nameFr', 'الاسم بالفرنسية'], ['legalForm', 'الشكل القانوني'],
    ['address', 'العنوان'], ['phone', 'الهاتف'], ['logo', 'الشعار'], ['createdAt', 'تاريخ الإنشاء']] },
  Years: { sheet: 'الدورات', cols: [
    ['id', 'المعرّف'], ['companyId', 'معرّف الشركة'], ['label', 'الدورة'], ['start', 'بداية السنة'], ['end', 'نهاية السنة'],
    ['status', 'الحالة', 'status'], ['zakatMode', 'نوع الحول', 'zakatMode'], ['zakatRate', 'نسبة الزكاة %', null, 1],
    ['nisab', 'النصاب', null, 1], ['reservePct', 'نسبة الاحتياط %', null, 1], ['effortPct', 'نسبة الجهد %', null, 1],
    ['prevReserve', 'احتياط سابق', null, 1], ['notes', 'ملاحظات'], ['createdAt', 'تاريخ الإنشاء'], ['closedAt', 'تاريخ الإقفال']] },
  Partners: { sheet: 'الشركاء', cols: [
    ['id', 'المعرّف'], ['companyId', 'معرّف الشركة'], ['name', 'اسم الشريك'], ['order', 'الترتيب', null, 1], ['active', 'نشط', 'bool']] },
  PartnerYear: { sheet: 'رؤوس أموال الشركاء', cols: [
    ['id', 'المعرّف'], ['yearId', 'معرّف الدورة'], ['partnerId', 'معرّف الشريك'],
    ['openingCapital', 'رأس المال الافتتاحي', null, 1], ['effortShare', 'نسبته من الجهد %', null, 1],
    ['profitAdvances', 'تسبيقات الربح', null, 1], ['postWithdrawals', 'السحوبات بعد التوزيع', null, 1], ['notes', 'ملاحظات']] },
  CapitalMoves: { sheet: 'حركة رؤوس الأموال', cols: [
    ['id', 'المعرّف'], ['yearId', 'معرّف الدورة'], ['partnerId', 'معرّف الشريك'], ['type', 'النوع', 'moveType'],
    ['amount', 'المبلغ', null, 1], ['date', 'التاريخ'], ['note', 'ملاحظة']] },
  Assets: { sheet: 'الأصول', cols: [
    ['id', 'المعرّف'], ['yearId', 'معرّف الدورة'], ['category', 'الصنف', 'category'], ['account', 'الحساب', 'account'],
    ['label', 'البيان'], ['gross', 'المبالغ', null, 1], ['depreciation', 'تناقص القيمة', null, 1],
    ['status', 'الحالة', 'assetStatus'], ['pct', 'نسبة التخفيض %', null, 1], ['note', 'ملاحظة']] },
  Liabilities: { sheet: 'الخصوم', cols: [
    ['id', 'المعرّف'], ['yearId', 'معرّف الدورة'], ['account', 'الحساب', 'liabAccount'], ['label', 'البيان'],
    ['amount', 'المبلغ', null, 1], ['note', 'ملاحظة']] },
  Deductions: { sheet: 'الاقتطاعات', cols: [
    ['id', 'المعرّف'], ['yearId', 'معرّف الدورة'], ['label', 'البند'], ['labelFr', 'البند بالفرنسية'], ['pct', 'النسبة %', null, 1]] },
  Checklists: { sheet: 'قوائم التحقق', cols: [
    ['id', 'المعرّف'], ['yearId', 'معرّف الدورة'], ['step', 'الخطوة', 'step'], ['itemId', 'معرّف السؤال'],
    ['checked', 'مؤكَّد', 'bool'], ['at', 'التاريخ']] },
  ChecklistDefs: { sheet: 'أسئلة المرافق', cols: [
    ['id', 'المعرّف'], ['step', 'الخطوة', 'step'], ['text', 'السؤال'], ['order', 'الترتيب', null, 1]] },
  PnL: { sheet: 'تحليل النتيجة', cols: [
    ['id', 'المعرّف'], ['yearId', 'معرّف الدورة'], ['kind', 'النوع', 'pnlKind'], ['label', 'البيان'],
    ['labelFr', 'البيان بالفرنسية'], ['amount', 'المبلغ', null, 1], ['order', 'الترتيب', null, 1]] },
  Results: { sheet: 'النتائج المجمّدة', cols: [
    ['id', 'المعرّف'], ['yearId', 'معرّف الدورة'], ['partnerId', 'معرّف الشريك'], ['data', 'البيانات'], ['at', 'تاريخ الإقفال']] },
  Settings: { sheet: 'الإعدادات', cols: [['key', 'المفتاح'], ['value', 'القيمة']] }
};

var REVERSE = {};
Object.keys(ENUMS).forEach(function (e) {
  REVERSE[e] = {};
  Object.keys(ENUMS[e]).forEach(function (k) { REVERSE[e][ENUMS[e][k]] = k; });
});

function encode_(col, v) {
  if (v === undefined || v === null) return '';
  if (col[2] === 'bool') return (v === true || v === 'true' || v === 'TRUE') ? 'نعم' : 'لا';
  if (col[2] && ENUMS[col[2]][String(v)] !== undefined) return ENUMS[col[2]][String(v)];
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function decode_(col, v) {
  if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (col[2] === 'bool') return v === true || v === 'نعم' || v === 'true' || v === 'TRUE';
  if (col[2]) { var k = REVERSE[col[2]][String(v)]; if (k !== undefined) return k; }
  if (col[3] && v !== '' && v !== null && !isNaN(Number(v))) return Number(v);
  return v;
}

/* ===================== التركيب ===================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚖️ تصفية')
    .addItem('1) تشغيل الإعداد (مرة واحدة)', 'setup')
    .addItem('عرض المفتاح السري', 'showApiKey')
    .addItem('توليد مفتاح سري جديد', 'resetApiKey')
    .addToUi();
}

function showApiKey() {
  var key = PropertiesService.getScriptProperties().getProperty('API_KEY') || setup();
  SpreadsheetApp.getUi().alert('المفتاح السري', key + '\n\nضعه في إعدادات التطبيق مع رابط Web app.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABLES).forEach(function (key) {
    var T = TABLES[key];
    var sh = ss.getSheetByName(T.sheet);
    var legacy = ss.getSheetByName(key);
    if (!sh && legacy) { legacy.setName(T.sheet); sh = legacy; migrateValues_(sh, T); }
    if (!sh) sh = ss.insertSheet(T.sheet);
    ensureHeaders_(sh, T);
    styleSheet_(sh);
  });
  ['Sheet1', 'Feuille 1', 'ورقة1', 'الورقة1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1 && s.getLastRow() === 0) ss.deleteSheet(s);
  });

  seedChecklists_();

  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('API_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty('API_KEY', key);
  }
  setSetting_('المفتاح السري (للعرض فقط)', key);
  Logger.log('المفتاح السري: ' + key);
  return key;
}

function resetApiKey() {
  PropertiesService.getScriptProperties().deleteProperty('API_KEY');
  return setup();
}

/** يحوّل ورقة قديمة بالإنجليزية: رؤوس الأعمدة والقيم */
function migrateValues_(sh, T) {
  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (!lastCol) return;
  var data = sh.getRange(1, 1, Math.max(last, 1), lastCol).getValues();
  var head = data[0];
  var cols = head.map(function (h) {
    for (var i = 0; i < T.cols.length; i++) if (T.cols[i][0] === h || T.cols[i][1] === h) return T.cols[i];
    return null;
  });
  data[0] = head.map(function (h, i) { return cols[i] ? cols[i][1] : h; });
  for (var r = 1; r < data.length; r++) {
    for (var c = 0; c < cols.length; c++) {
      if (cols[c] && cols[c][2]) data[r][c] = encode_(cols[c], decode_(cols[c], data[r][c]));
    }
  }
  sh.getRange(1, 1, data.length, lastCol).setNumberFormat('@').setValues(data);
}

function ensureHeaders_(sh, T) {
  var want = T.cols.map(function (c) { return c[1]; });
  if (sh.getLastColumn() === 0) { sh.getRange(1, 1, 1, want.length).setValues([want]); return; }
  var current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  T.cols.forEach(function (c) {
    if (current.indexOf(c[1]) === -1 && current.indexOf(c[0]) === -1) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(c[1]);
      current.push(c[1]);
    }
  });
}

function styleSheet_(sh) {
  sh.setRightToLeft(true);
  sh.setFrozenRows(1);
  var lastCol = Math.max(sh.getLastColumn(), 1);
  sh.getRange(1, 1, 1, lastCol).setFontWeight('bold').setBackground('#0f4c45').setFontColor('#ffffff').setHorizontalAlignment('center');
  sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).setNumberFormat('@');
}

function seedChecklists_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABLES.ChecklistDefs.sheet);
  if (sh.getLastRow() > 1) return;
  var defs = [
    ['partners', 'هل تأكدت من رأس المال الافتتاحي لكل شريك من محضر السنة السابقة؟'],
    ['partners', 'هل اتفق الشركاء على نسبة الجهد ونسبة كل شريك منها؟'],
    ['capital', 'هل سجّلت كل سحوبات الشركاء خلال السنة بتواريخها؟'],
    ['capital', 'هل سجّلت كل الإضافات (الأموال التي أدخلها الشركاء) بتواريخها؟'],
    ['capital', 'هل فرّقت بين سحب رأس المال وتسبيق الربح؟'],
    ['invest', 'هل جردت الاستثمارات فعلياً (معدات، نقل، تجهيزات)؟'],
    ['invest', 'هل حسبت تناقص القيمة (الاهتلاك) لهذه السنة؟'],
    ['invest', 'هل استبعدت ما بيع أو تلف من المعدات؟'],
    ['stocks', 'هل عددت المخزون فعلياً لا من الدفاتر؟'],
    ['stocks', 'هل فرزت التالف والراكد وخفّضت قيمته؟'],
    ['stocks', 'هل قيّمت المخزون بسعر الشراء (أو السوق إن كان أقل)؟'],
    ['receivables', 'هل أكّدت الديون مع الزبائن (اتصال / كشف موقّع)؟'],
    ['receivables', 'هل استبعدت ما أنت على يقين بأنه لن يدخل؟'],
    ['receivables', 'هل خفّضت ما أنت شاكٌّ في أمره؟'],
    ['receivables', 'هل خصمت التسبيقات التي أخذتها من نفس الزبون؟'],
    ['treasury', 'هل عددت الصندوق نقداً يوم الجرد؟'],
    ['treasury', 'هل يطابق رصيد البنك / CCP الكشف الرسمي؟'],
    ['liabilities', 'هل راجعت كل فواتير الموردين غير المسدّدة؟'],
    ['liabilities', 'هل أدرجت الضرائب والضمان الاجتماعي المستحقة؟'],
    ['liabilities', 'هل أدرجت أجور ومنح العمال غير المدفوعة؟'],
    ['liabilities', 'هل أدرجت الكراء والخدمات (كهرباء، هاتف…) المستحقة؟'],
    ['distribution', 'هل حدّدت النصاب بقيمة 85غ ذهب يوم الحول؟'],
    ['distribution', 'هل راجع الشركاء نسب التوزيع ووافقوا عليها؟'],
    ['analysis', 'هل أدخلت رقم الأعمال والتكاليف من دفاتر السنة؟'],
    ['analysis', 'هل فسّرت الفرق بين نتيجة الجرد ونتيجة الحسابات إن وُجد؟']
  ];
  upsert_('ChecklistDefs', defs.map(function (d, i) { return { id: 'cl' + (i + 1), step: d[0], text: d[1], order: i + 1 }; }));
}

function setSetting_(key, value) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABLES.Settings.sheet);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key || data[i][0] === 'API_KEY (للعرض فقط)') {
      sh.getRange(i + 1, 1, 1, 2).setValues([[key, value]]);
      return;
    }
  }
  sh.appendRow([key, value]);
}

/* ===================== الواجهة البرمجية ===================== */

function doGet() {
  return json_({ ok: true, app: 'tasfiya', msg: 'الخادم يعمل. استعمل POST من الواجهة.' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    var key = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!key) return json_({ ok: false, error: 'لم يُشغَّل الإعداد بعد: شغّل الدالة setup في Apps Script' });
    if (req.key !== key) return json_({ ok: false, error: 'مفتاح سري غير صحيح' });

    switch (req.action) {
      case 'ping':        return json_({ ok: true });
      case 'bootstrap':   return json_({ ok: true, data: bootstrap_() });
      case 'upsert':      return withLock_(function () { upsert_(req.table, [req.row]); return { ok: true }; });
      case 'upsertMany':  return withLock_(function () { upsert_(req.table, req.rows || []); return { ok: true }; });
      case 'remove':      return withLock_(function () { removeIds_(req.table, req.ids || [req.id]); return { ok: true }; });
      case 'removeWhere': return withLock_(function () { removeWhere_(req.table, req.field, req.value); return { ok: true }; });
      default:            return json_({ ok: false, error: 'عملية غير معروفة: ' + req.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return json_(fn()); } finally { lock.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(table) {
  var T = TABLES[table];
  if (!T || table === 'Settings') throw new Error('جدول غير مسموح: ' + table);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(T.sheet);
  if (!sh) throw new Error('الورقة «' + T.sheet + '» غير موجودة، شغّل setup');
  return sh;
}

/** خريطة الأعمدة: رقم العمود ← تعريفه (يقبل الرأس العربي أو المفتاح الإنجليزي) */
function colMap_(sh, table) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var T = TABLES[table];
  return head.map(function (h) {
    for (var i = 0; i < T.cols.length; i++) if (T.cols[i][1] === h || T.cols[i][0] === h) return T.cols[i];
    return null;
  });
}

function bootstrap_() {
  var out = {};
  Object.keys(TABLES).forEach(function (t) {
    if (t === 'Settings') return;
    var sh = sheet_(t);
    var last = sh.getLastRow();
    if (last < 2) { out[t] = []; return; }
    var cols = colMap_(sh, t);
    var vals = sh.getRange(2, 1, last - 1, cols.length).getValues();
    out[t] = vals.filter(function (r) { return r[0] !== ''; }).map(function (r) {
      var o = {};
      cols.forEach(function (c, i) { if (c) o[c[0]] = decode_(c, r[i]); });
      return o;
    });
  });
  return out;
}

function upsert_(table, rows) {
  if (!rows.length) return;
  var sh = sheet_(table);
  var cols = colMap_(sh, table);
  var idCol = cols.findIndex(function (c) { return c && c[0] === 'id'; });
  var last = sh.getLastRow();
  var ids = last > 1 ? sh.getRange(2, idCol + 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var current = last > 1 ? sh.getRange(2, 1, last - 1, cols.length).getValues() : [];
  var appends = [];
  rows.forEach(function (row) {
    if (!row || !row.id) return;
    var idx = ids.indexOf(String(row.id));
    var base = idx >= 0 ? current[idx] : cols.map(function () { return ''; });
    var line = cols.map(function (c, i) {
      if (!c) return base[i];
      return row.hasOwnProperty(c[0]) ? encode_(c, row[c[0]]) : base[i];
    });
    if (idx >= 0) { sh.getRange(idx + 2, 1, 1, cols.length).setNumberFormat('@').setValues([line]); current[idx] = line; }
    else { appends.push(line); ids.push(String(row.id)); current.push(line); }
  });
  if (appends.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appends.length, cols.length).setNumberFormat('@').setValues(appends);
  }
}

function removeIds_(table, idList) {
  var sh = sheet_(table);
  var last = sh.getLastRow();
  if (last < 2) return;
  var cols = colMap_(sh, table);
  var idCol = cols.findIndex(function (c) { return c && c[0] === 'id'; });
  var set = {};
  idList.forEach(function (id) { set[String(id)] = 1; });
  var ids = sh.getRange(2, idCol + 1, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (set[String(ids[i][0])]) sh.deleteRow(i + 2);
  }
}

function removeWhere_(table, field, value) {
  var sh = sheet_(table);
  var last = sh.getLastRow();
  if (last < 2) return;
  var cols = colMap_(sh, table);
  var col = cols.findIndex(function (c) { return c && c[0] === field; });
  if (col < 0) throw new Error('حقل غير موجود: ' + field);
  var vals = sh.getRange(2, col + 1, last - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(decode_(cols[col], vals[i][0])) === String(value)) sh.deleteRow(i + 2);
  }
}
