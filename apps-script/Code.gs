/**
 * تطبيق جرد الأعمال وتصفية حساب الشركاء — الخادم (Google Apps Script)
 * ---------------------------------------------------------------
 * الدور: الحفظ والقراءة فقط. كل الحسابات تتم في الواجهة.
 *
 * طريقة التركيب (مرة واحدة):
 *  1) أنشئ Google Sheet جديداً فارغاً ← Extensions ← Apps Script
 *  2) الصق هذا الملف كاملاً مكان الكود الموجود واحفظ
 *  3) اختر الدالة setup من القائمة واضغط Run (وافق على الصلاحيات)
 *     ← ستجد المفتاح السري في السجل (Execution log) وفي ورقة Settings
 *  4) Deploy ← New deployment ← Web app
 *       Execute as: Me    |   Who has access: Anyone
 *     انسخ رابط Web app وضعه مع المفتاح السري في إعدادات الواجهة
 */

var SCHEMA = {
  Companies:     ['id', 'name', 'nameFr', 'legalForm', 'address', 'phone', 'logo', 'createdAt'],
  Years:         ['id', 'companyId', 'label', 'start', 'end', 'status', 'zakatMode', 'zakatRate', 'nisab',
                  'reservePct', 'effortPct', 'prevReserve', 'notes', 'createdAt', 'closedAt'],
  Partners:      ['id', 'companyId', 'name', 'order', 'active'],
  PartnerYear:   ['id', 'yearId', 'partnerId', 'openingCapital', 'effortShare', 'profitAdvances',
                  'postWithdrawals', 'notes'],
  CapitalMoves:  ['id', 'yearId', 'partnerId', 'type', 'amount', 'date', 'note'],
  Assets:        ['id', 'yearId', 'category', 'account', 'label', 'gross', 'depreciation', 'status', 'pct', 'note'],
  Liabilities:   ['id', 'yearId', 'account', 'label', 'amount', 'note'],
  Deductions:    ['id', 'yearId', 'label', 'labelFr', 'pct'],
  Checklists:    ['id', 'yearId', 'step', 'itemId', 'checked', 'at'],
  ChecklistDefs: ['id', 'step', 'text', 'order'],
  PnL:           ['id', 'yearId', 'kind', 'label', 'labelFr', 'amount', 'order'],
  Results:       ['id', 'yearId', 'partnerId', 'data', 'at'],
  Settings:      ['key', 'value']
};

var NUMERIC = {
  openingCapital: 1, effortShare: 1, profitAdvances: 1, postWithdrawals: 1, amount: 1, gross: 1,
  depreciation: 1, pct: 1, zakatRate: 1, nisab: 1, reservePct: 1, effortPct: 1, prevReserve: 1, order: 1
};

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
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = SCHEMA[name];
    if (sh.getLastColumn() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      var current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      headers.forEach(function (h) {
        if (current.indexOf(h) === -1) {
          sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
          current.push(h);
        }
      });
    }
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#0f4c45').setFontColor('#ffffff');
    // نص خام لتفادي تحويل التواريخ والأرقام تلقائياً
    sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).setNumberFormat('@');
  });

  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Feuille 1') || ss.getSheetByName('ورقة1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);

  seedChecklists_();

  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('API_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty('API_KEY', key);
  }
  setSetting_('API_KEY (للعرض فقط)', key);
  Logger.log('المفتاح السري: ' + key);
  return key;
}

/** لتغيير المفتاح السري عند الحاجة */
function resetApiKey() {
  PropertiesService.getScriptProperties().deleteProperty('API_KEY');
  return setup();
}

function seedChecklists_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ChecklistDefs');
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
  var rows = defs.map(function (d, i) { return ['cl' + (i + 1), d[0], d[1], String(i + 1)]; });
  sh.getRange(2, 1, rows.length, 4).setValues(rows);
}

function setSetting_(key, value) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) { sh.getRange(i + 1, 2).setValue(value); return; }
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
    if (!key || req.key !== key) return json_({ ok: false, error: 'مفتاح سري غير صحيح' });

    switch (req.action) {
      case 'ping':      return json_({ ok: true });
      case 'bootstrap': return json_({ ok: true, data: bootstrap_() });
      case 'upsert':    return withLock_(function () { upsert_(req.table, [req.row]); return { ok: true }; });
      case 'upsertMany':return withLock_(function () { upsert_(req.table, req.rows || []); return { ok: true }; });
      case 'remove':    return withLock_(function () { removeIds_(req.table, req.ids || [req.id]); return { ok: true }; });
      case 'removeWhere': return withLock_(function () { removeWhere_(req.table, req.field, req.value); return { ok: true }; });
      default:          return json_({ ok: false, error: 'عملية غير معروفة: ' + req.action });
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
  if (!SCHEMA[table] || table === 'Settings') throw new Error('جدول غير مسموح: ' + table);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table);
  if (!sh) throw new Error('الورقة غير موجودة، شغّل setup: ' + table);
  return sh;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function bootstrap_() {
  var out = {};
  Object.keys(SCHEMA).forEach(function (t) {
    if (t === 'Settings') return;
    var sh = sheet_(t);
    var last = sh.getLastRow();
    if (last < 2) { out[t] = []; return; }
    var h = headers_(sh);
    var vals = sh.getRange(2, 1, last - 1, h.length).getValues();
    out[t] = vals.filter(function (r) { return r[0] !== ''; }).map(function (r) {
      var o = {};
      h.forEach(function (k, i) {
        var v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (NUMERIC[k] && v !== '' && v !== null) v = Number(v);
        if (k === 'checked' || k === 'active') v = (v === true || v === 'true' || v === 'TRUE');
        o[k] = v;
      });
      return o;
    });
  });
  return out;
}

function upsert_(table, rows) {
  if (!rows.length) return;
  var sh = sheet_(table);
  var h = headers_(sh);
  var last = sh.getLastRow();
  var ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var appends = [];
  rows.forEach(function (row) {
    if (!row || !row.id) return;
    var line = h.map(function (k) {
      var v = row[k];
      if (v === undefined || v === null) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    });
    var idx = ids.indexOf(String(row.id));
    if (idx >= 0) sh.getRange(idx + 2, 1, 1, h.length).setValues([line]);
    else { appends.push(line); ids.push(String(row.id)); }
  });
  if (appends.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appends.length, h.length).setNumberFormat('@').setValues(appends);
  }
}

function removeIds_(table, idList) {
  var sh = sheet_(table);
  var last = sh.getLastRow();
  if (last < 2) return;
  var set = {};
  idList.forEach(function (id) { set[String(id)] = 1; });
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (set[String(ids[i][0])]) sh.deleteRow(i + 2);
  }
}

function removeWhere_(table, field, value) {
  var sh = sheet_(table);
  var last = sh.getLastRow();
  if (last < 2) return;
  var h = headers_(sh);
  var col = h.indexOf(field);
  if (col < 0) throw new Error('حقل غير موجود: ' + field);
  var vals = sh.getRange(2, col + 1, last - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === String(value)) sh.deleteRow(i + 2);
  }
}
