// طبقة البيانات: نسخة في الذاكرة + حفظ في Apps Script (أو محلياً للتجربة)

const TABLES = ['Companies', 'Years', 'Partners', 'PartnerYear', 'CapitalMoves', 'Assets',
  'Liabilities', 'Deductions', 'Checklists', 'ChecklistDefs', 'PnL', 'Results'];
const LS_DB = 'tasfiya.db';
const LS_CFG = 'tasfiya.cfg';

export const db = {};
TABLES.forEach(t => (db[t] = []));

let listeners = [];
let status = { state: 'idle', pending: 0, error: null };
const queue = new Map(); // key -> op
let timer = null;
let flushing = false;

export function getConfig() {
  try { return JSON.parse(localStorage.getItem(LS_CFG)) || {}; } catch { return {}; }
}
export function setConfig(cfg) {
  localStorage.setItem(LS_CFG, JSON.stringify(cfg));
}
export function isRemote() {
  const c = getConfig();
  return !!(c.apiUrl && c.apiKey);
}

export function onStatus(fn) { listeners.push(fn); fn(status); }
function setStatus(s) {
  status = { ...status, ...s };
  listeners.forEach(fn => fn(status));
}

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

async function call(action, payload = {}) {
  const c = getConfig();
  const res = await fetch(c.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key: c.apiKey, action, ...payload }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'خطأ في الخادم');
  return data;
}

export async function testConnection(apiUrl, apiKey) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key: apiKey, action: 'ping' }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'فشل الاتصال');
  return true;
}

export async function load() {
  if (isRemote()) {
    setStatus({ state: 'loading' });
    const { data } = await call('bootstrap');
    TABLES.forEach(t => (db[t] = data[t] || []));
    setStatus({ state: 'saved', error: null });
  } else {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_DB) || '{}');
      TABLES.forEach(t => (db[t] = saved[t] || []));
    } catch { /* قاعدة فارغة */ }
    setStatus({ state: 'local' });
  }
}

function persistLocal() {
  localStorage.setItem(LS_DB, JSON.stringify(db));
}

function schedule() {
  if (!isRemote()) { persistLocal(); setStatus({ state: 'local' }); return; }
  setStatus({ state: 'pending', pending: queue.size });
  clearTimeout(timer);
  timer = setTimeout(flush, 700);
}

async function flush() {
  if (flushing || !queue.size) return;
  flushing = true;
  setStatus({ state: 'saving', pending: queue.size });
  // تجميع العمليات حسب الجدول
  const ops = [...queue.entries()];
  queue.clear();
  const upserts = {}, removes = {};
  ops.forEach(([, op]) => {
    if (op.type === 'upsert') (upserts[op.table] ||= []).push(op.row);
    else (removes[op.table] ||= []).push(op.id);
  });
  try {
    for (const t of Object.keys(upserts)) await call('upsertMany', { table: t, rows: upserts[t] });
    for (const t of Object.keys(removes)) await call('remove', { table: t, ids: removes[t] });
    setStatus({ state: queue.size ? 'pending' : 'saved', pending: queue.size, error: null });
  } catch (e) {
    // إعادة العمليات إلى الطابور دون الكتابة فوق الأحدث
    ops.forEach(([k, op]) => { if (!queue.has(k)) queue.set(k, op); });
    setStatus({ state: 'error', pending: queue.size, error: e.message });
    setTimeout(flush, 5000);
  } finally {
    flushing = false;
    if (queue.size && status.state !== 'error') schedule();
  }
}

export function upsert(table, row) {
  const list = db[table];
  const i = list.findIndex(r => r.id === row.id);
  if (i >= 0) list[i] = { ...list[i], ...row };
  else list.push(row);
  queue.set(table + ':' + row.id, { type: 'upsert', table, row: i >= 0 ? list[i] : row });
  schedule();
  return i >= 0 ? list[i] : row;
}

export function remove(table, id) {
  db[table] = db[table].filter(r => r.id !== id);
  queue.set(table + ':' + id, { type: 'remove', table, id });
  schedule();
}

export function removeMany(table, predicate) {
  db[table].filter(predicate).forEach(r => remove(table, r.id));
}

export function hasPending() { return queue.size > 0 || flushing; }

export function exportJSON() {
  return JSON.stringify({ app: 'tasfiya', version: 1, exportedAt: new Date().toISOString(), db }, null, 1);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const src = parsed.db || parsed;
  TABLES.forEach(t => {
    (src[t] || []).forEach(row => upsert(t, row));
  });
}

window.addEventListener('beforeunload', e => {
  if (hasPending()) { e.preventDefault(); e.returnValue = ''; }
});
