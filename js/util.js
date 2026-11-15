// أدوات عامة
const nf = {};
export function fmt(v, d = 2) {
  const n = Number(v) || 0;
  nf[d] ||= new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  return '\u2066' + nf[d].format(Math.abs(n) < 0.005 && d >= 2 ? 0 : n).replace(/[\u202f\u00a0]/g, ' ') + '\u2069';
}
export const fmtPct = (v, d = 2) => fmt(v, d) + ' %';
export const fmtDate = s => (s ? s.split('-').reverse().join('/') : '—');

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms = 400) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function toast(msg, type = 'info') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

export function confirmBox(msg, okLabel = 'تأكيد', danger = true) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal small"><p>${esc(msg)}</p>
      <div class="modal-actions"><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okLabel)}</button>
      <button class="btn ghost" data-no>إلغاء</button></div></div>`;
    document.body.appendChild(wrap);
    const done = v => { wrap.remove(); resolve(v); };
    wrap.querySelector('[data-ok]').onclick = () => done(true);
    wrap.querySelector('[data-no]').onclick = () => done(false);
    wrap.onclick = e => { if (e.target === wrap) done(false); };
  });
}

/** تصغير الشعار إلى 320px وتحويله إلى نص (ليُحفظ في خلية واحدة) */
export function imageToDataURL(file, max = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let url = c.toDataURL('image/png');
      if (url.length > 45000) url = c.toDataURL('image/webp', 0.85);
      if (url.length > 45000) url = c.toDataURL('image/jpeg', 0.75);
      if (url.length > 48000) return reject(new Error('الشعار كبير جداً، جرّب صورة أبسط'));
      resolve(url);
    };
    img.onerror = () => reject(new Error('تعذّر قراءة الصورة'));
    reader.readAsDataURL(file);
  });
}

export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
