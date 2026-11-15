// الشركة النموذجية: دورة 2024 مقفلة + دورة 2025 قيد الجرد
import { db, upsert, uid } from './store.js';
import { createYear, closeYear, seedPnl } from './years.js';
import { checklistDefs } from './checks.js';

function drawLogo() {
  const c = document.createElement('canvas');
  c.width = c.height = 240;
  const g = c.getContext('2d');
  g.fillStyle = '#0f4c45';
  g.beginPath(); g.roundRect(0, 0, 240, 240, 48); g.fill();
  // صامولة سداسية
  g.save(); g.translate(120, 104);
  g.fillStyle = '#d9b25f';
  g.beginPath();
  for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; g.lineTo(Math.cos(a) * 62, Math.sin(a) * 62); }
  g.closePath(); g.fill();
  g.fillStyle = '#0f4c45'; g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = '#ffffff'; g.font = 'bold 40px Cairo, sans-serif'; g.textAlign = 'center';
  g.fillText('النور', 120, 212);
  return c.toDataURL('image/png');
}

const A = (yearId, category, account, label, gross, status, extra = {}) =>
  upsert('Assets', { id: uid('a'), yearId, category, account, label, gross, depreciation: '', status, pct: '', note: '', ...extra });
const L = (yearId, account, label, amount, note = '') => upsert('Liabilities', { id: uid('l'), yearId, account, label, amount, note });
const M = (yearId, partnerId, type, amount, date, note = '') => upsert('CapitalMoves', { id: uid('m'), yearId, partnerId, type, amount, date, note });

function checkAll(yearId, steps) {
  checklistDefs().filter(d => !steps || steps.includes(d.step)).forEach(d =>
    upsert('Checklists', { id: uid('ck'), yearId, step: d.step, itemId: d.id, checked: true, at: new Date().toISOString() }));
}

function fillPnl(yearId, values) {
  seedPnl(yearId);
  db.PnL.filter(r => r.yearId === yearId).forEach(r => {
    if (values[r.label] !== undefined) upsert('PnL', { id: r.id, amount: values[r.label] });
  });
}

export function loadDemo() {
  const cid = uid('c');
  upsert('Companies', {
    id: cid, name: 'مؤسسة النور لتعبئة البراغي', nameFr: 'Ets Ennour — Conditionnement de visserie', legalForm: 'شركة تضامن',
    address: 'حي ثنية المخزن، غرداية', phone: '029 00 00 00', logo: drawLogo(), createdAt: new Date().toISOString(),
  });
  const partners = [['عبد السلام عمر', 2400000, 50], ['بوسعدة سعيد', 1500000, 30], ['بن عمر يوسف', 900000, 20]]
    .map(([name, cap, eff], i) => { const id = uid('p'); upsert('Partners', { id, companyId: cid, name, order: i + 1, active: true }); return { id, cap, eff }; });
  const [P1, P2, P3] = partners;

  /* ---------------- دورة 2024 ---------------- */
  const y1 = createYear(cid, { label: '2024', start: '2024-01-01', end: '2024-12-31' });
  upsert('Years', { id: y1, effortPct: 30, reservePct: 10, nisab: 1088000, zakatMode: 'solar', zakatRate: 2.577 });
  db.Deductions.filter(d => d.yearId === y1).forEach(d => upsert('Deductions', { id: d.id, pct: d.label.includes('العمال') ? 3 : 5 }));
  partners.forEach(p => upsert('PartnerYear', {
    id: uid('py'), yearId: y1, partnerId: p.id, openingCapital: p.cap, effortShare: p.eff,
    profitAdvances: p === P1 ? 60000 : '', postWithdrawals: p === P3 ? 50000 : '', notes: '',
  }));
  M(y1, P1.id, 'withdrawal', 300000, '2024-04-15', 'سحب لشراء سكن');
  M(y1, P2.id, 'addition', 400000, '2024-06-01', 'تمويل شراء آلة التعبئة');
  M(y1, P3.id, 'addition', 250000, '2024-09-10');
  M(y1, P3.id, 'withdrawal', 100000, '2024-11-20');

  A(y1, 'invest', 'outillage', 'آلة تعبئة أوتوماتيكية', 1800000, 'inuse', { depreciation: 540000 });
  A(y1, 'invest', 'roulant', 'شاحنة صغيرة للتوزيع', 2200000, 'inuse', { depreciation: 880000 });
  A(y1, 'invest', 'equipements', 'ميزان إلكتروني ورفوف المستودع', 350000, 'inuse', { depreciation: 140000 });
  A(y1, 'invest', 'outillage', 'آلة لحام أكياس قديمة', 120000, 'idle', { depreciation: 90000, pct: 50, note: 'معطلة منذ أوت' });
  A(y1, 'stocks', 'marchandises', 'براغي مختلفة المقاسات', 1450000, 'good');
  A(y1, 'stocks', 'matieres', 'أكياس وعلب تغليف', 320000, 'good');
  A(y1, 'stocks', 'marchandises', 'براغي صدئة (رطوبة المستودع)', 180000, 'damaged', { pct: 60 });
  A(y1, 'stocks', 'marchandises', 'براغي مقاس نادر', 140000, 'slow', { pct: 30 });
  A(y1, 'stocks', 'matieres', 'علب مفقودة عند العدّ', 25000, 'lost');
  A(y1, 'receivables', 'clients', 'شركة البناء الحديث', 420000, 'confirmed', { note: 'كشف موقّع 28/12' });
  A(y1, 'receivables', 'clients', 'محل الأمانة للعتاد', 185000, 'confirmed');
  A(y1, 'receivables', 'clients', 'مقاولة بن داود', 260000, 'doubtful', { pct: 50, note: 'وعد بالدفع على أقساط' });
  A(y1, 'receivables', 'clients', 'محل السلام (أغلق)', 95000, 'bad');
  A(y1, 'receivables', 'av_fourn', 'مورد الأكياس — تسبيق', 80000, 'confirmed');
  A(y1, 'receivables', 'av_location', 'تسبيق كراء المستودع (3 أشهر)', 120000, 'confirmed');
  A(y1, 'receivables', 'prets', 'سلفة العامل محمد', 30000, 'confirmed');
  A(y1, 'treasury', 'caisse', 'الصندوق', 185000, 'verified');
  A(y1, 'treasury', 'banque', 'بنك BADR', 940000, 'verified');
  A(y1, 'treasury', 'ccp', 'الحساب البريدي', 65000, 'verified');
  L(y1, 'fournisseurs', 'مستورد البراغي — العاصمة', 610000);
  L(y1, 'fournisseurs', 'مورد الكرتون', 95000);
  L(y1, 'av_clients', 'تسبيق زبون: ورشة الإخلاص', 50000);
  L(y1, 'personnel', 'أجور ديسمبر', 180000);
  L(y1, 'impots_ss', 'الضمان الاجتماعي — الثلاثي الرابع', 72000);
  L(y1, 'services', 'كهرباء وهاتف', 18000);
  L(y1, 'location', 'كراء ديسمبر', 40000);
  fillPnl(y1, {
    'رقم الأعمال': 11680000, 'مستهلكات المخزون': 6830000, 'الأجور': 1440000, 'المنح الثابتة': 120000, 'الكراء': 480000,
    'الإطعام': 90000, 'الهاتف / الكهرباء / الماء / الغاز': 165000, 'الإشهار': 40000, 'الضرائب': 210000, 'الضمان الاجتماعي': 300000,
    'لوازم ومستهلكات أخرى': 85000, 'تنقلات': 70000, 'نقل': 160000, 'منح متغيرة': 60000, 'صيانة': 95000,
    'اهتلاك المعدات ووسائل النقل': 690000,
  });
  checkAll(y1);
  closeYear(y1);

  /* ---------------- دورة 2025 (قيد الجرد) ---------------- */
  const y2 = createYear(cid, { label: '2025', start: '2025-01-01', end: '2025-12-31' }, y1);
  upsert('Years', { id: y2, nisab: 1360000 });
  const py = pid => db.PartnerYear.find(r => r.yearId === y2 && r.partnerId === pid);
  upsert('PartnerYear', { id: py(P3.id).id, profitAdvances: 40000 });
  M(y2, P2.id, 'withdrawal', 200000, '2025-03-10');
  M(y2, P1.id, 'addition', 500000, '2025-05-20', 'توسعة خط التعبئة');
  A(y2, 'invest', 'outillage', 'آلة تعبئة أوتوماتيكية', 1800000, 'inuse', { depreciation: 900000 });
  A(y2, 'invest', 'roulant', 'شاحنة صغيرة للتوزيع', 2200000, 'inuse', { depreciation: 1320000 });
  A(y2, 'invest', 'equipements', 'ميزان إلكتروني ورفوف المستودع', 350000, 'inuse', { depreciation: 210000 });
  A(y2, 'invest', 'outillage', 'آلة تعبئة ثانية (جديدة)', 950000, 'inuse', { depreciation: 95000 });
  A(y2, 'stocks', 'marchandises', 'براغي مختلفة المقاسات', 1980000, 'good');
  A(y2, 'stocks', 'matieres', 'أكياس وعلب تغليف', 410000, 'good');
  A(y2, 'stocks', 'marchandises', 'براغي مقاس نادر', 120000, 'slow', { pct: 40 });
  A(y2, 'receivables', 'clients', 'شركة البناء الحديث', 380000, 'confirmed');
  A(y2, 'receivables', 'clients', 'مقاولة بن داود', 210000, 'doubtful', { pct: 50 });
  A(y2, 'receivables', 'clients', 'محل الأمانة للعتاد', 160000, 'unchecked');
  A(y2, 'receivables', 'clients', 'ورشة الإخلاص', 245000, 'unchecked');
  A(y2, 'receivables', 'clients', 'مؤسسة الواحات للبناء', 520000, 'confirmed');
  A(y2, 'receivables', 'av_location', 'تسبيق كراء المستودع', 120000, 'confirmed');
  A(y2, 'treasury', 'caisse', 'الصندوق', 210000, 'verified');
  A(y2, 'treasury', 'banque', 'بنك BADR', 1180000, 'unverified');
  L(y2, 'fournisseurs', 'مستورد البراغي — العاصمة', 740000);
  L(y2, 'personnel', 'أجور ديسمبر', 210000);
  L(y2, 'impots_ss', 'الضمان الاجتماعي — الثلاثي الرابع', 84000);
  checkAll(y2, ['partners', 'capital', 'invest']);
  return cid;
}
