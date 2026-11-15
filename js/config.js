// الحسابات والقوائم الثابتة (عربي + فرنسي)

export const ASSET_CATEGORIES = [
  { key: 'invest', ar: 'الاستثمارات', fr: 'Investissements', code: 2 },
  { key: 'stocks', ar: 'المخزونات', fr: 'Stocks', code: 3 },
  { key: 'receivables', ar: 'الحقوق', fr: 'Créances', code: 4 },
  { key: 'treasury', ar: 'الخزينة', fr: 'Trésorerie', code: 5 },
];

// zakat:false = أصل غير زكوي (يُطرح من وعاء الزكاة)
export const ASSET_ACCOUNTS = {
  invest: [
    { key: 'amenagements', ar: 'مصاريف التهيئة', fr: 'Aménagements', zakat: false },
    { key: 'roulant', ar: 'معدات النقل', fr: 'Matériels roulants', zakat: false },
    { key: 'outillage', ar: 'معدات وأدوات', fr: 'Matériels & outillages', zakat: false },
    { key: 'equipements', ar: 'التجهيزات', fr: 'Équipements', zakat: false },
    { key: 'invest_other', ar: 'استثمارات أخرى', fr: 'Autres investissements', zakat: false },
  ],
  stocks: [
    { key: 'marchandises', ar: 'بضائع', fr: 'Marchandises', zakat: true },
    { key: 'matieres', ar: 'مواد أولية', fr: 'Matières premières', zakat: true },
    { key: 'produits', ar: 'منتجات تامة', fr: 'Produits finis', zakat: true },
    { key: 'stock_other', ar: 'مخزونات أخرى', fr: 'Autres stocks', zakat: true },
  ],
  receivables: [
    { key: 'clients', ar: 'ديون الزبائن', fr: 'Créances clients', zakat: true },
    { key: 'av_fourn', ar: 'تسبيقات الموردين', fr: 'Avances aux fournisseurs', zakat: true },
    { key: 'prets', ar: 'سلف الموظفين', fr: 'Prêts sociaux', zakat: true },
    { key: 'av_location', ar: 'تسبيق الكراء', fr: 'Avances location', zakat: false },
    { key: 'impots', ar: 'ضرائب ورسوم مدفوعة مسبقاً', fr: 'Impôts et taxes', zakat: true },
    { key: 'rec_other', ar: 'حقوق أخرى', fr: 'Autres créances', zakat: true },
  ],
  treasury: [
    { key: 'caisse', ar: 'الصندوق', fr: 'Caisse', zakat: true },
    { key: 'banque', ar: 'البنك', fr: 'Banque', zakat: true },
    { key: 'ccp', ar: 'الحساب البريدي', fr: 'CCP', zakat: true },
  ],
};

// تسبيقات الشركاء تُحسب تلقائياً من تسبيقات الربح لكل شريك
export const AUTO_ADVANCES = { key: 'av_associes', ar: 'تسبيقات الشركاء (على الربح)', fr: 'Avances associés', zakat: true };

export const LIABILITY_ACCOUNTS = [
  { key: 'fournisseurs', ar: 'ديون الموردين', fr: 'Dettes fournisseurs' },
  { key: 'av_clients', ar: 'تسبيقات الزبائن', fr: 'Avances clients' },
  { key: 'personnel', ar: 'ديون العمال والمتعاونين', fr: 'Dettes personnel' },
  { key: 'impots_ss', ar: 'الضرائب والضمان الاجتماعي', fr: 'Impôts et S/sociale' },
  { key: 'services', ar: 'ديون الخدمات', fr: 'Dettes services' },
  { key: 'associes', ar: 'ديون الشركاء (قروض)', fr: 'Dettes associés' },
  { key: 'location', ar: 'ديون الكراء', fr: 'Dettes location' },
  { key: 'zakat_due', ar: 'زكاة مستحقة غير مدفوعة', fr: 'Zakat à payer' },
  { key: 'liab_other', ar: 'ديون أخرى', fr: 'Autres dettes' },
];

// حالات الأصول حسب الصنف — reduce: نوع التخفيض
export const STATUSES = {
  receivables: [
    { key: 'confirmed', ar: 'مؤكَّد', icon: '✅', reduce: 'none', hint: 'اتصلت به أو عندك كشف موقّع' },
    { key: 'doubtful', ar: 'مشكوك فيه', icon: '🟡', reduce: 'pct', hint: 'قد يدفع وقد لا يدفع — حدّد نسبة التخفيض' },
    { key: 'bad', ar: 'معدوم', icon: '❌', reduce: 'all', hint: 'على يقين أنه لن يدخل — يُستبعد من الأصول' },
    { key: 'unchecked', ar: 'لم يُؤكَّد بعد', icon: '⏳', reduce: 'none', hint: 'يدخل بقيمته، لكنه يبقى تنبيهاً مفتوحاً' },
  ],
  stocks: [
    { key: 'good', ar: 'سليم', icon: '✅', reduce: 'none', hint: 'معدود وصالح للبيع' },
    { key: 'slow', ar: 'راكد', icon: '🟡', reduce: 'pct', hint: 'بطيء البيع — حدّد نسبة التخفيض' },
    { key: 'damaged', ar: 'تالف', icon: '🟠', reduce: 'pct', hint: 'تالف جزئياً — حدّد نسبة التخفيض' },
    { key: 'lost', ar: 'فاقد / تالف كلياً', icon: '❌', reduce: 'all', hint: 'يُستبعد من الأصول' },
  ],
  invest: [
    { key: 'inuse', ar: 'مستعمل', icon: '✅', reduce: 'none', hint: 'يُخصم منه تناقص القيمة فقط' },
    { key: 'idle', ar: 'معطّل', icon: '🟡', reduce: 'pct', hint: 'حدّد نسبة تخفيض إضافية' },
    { key: 'scrapped', ar: 'خارج الخدمة', icon: '❌', reduce: 'all', hint: 'يُستبعد من الأصول' },
  ],
  treasury: [
    { key: 'verified', ar: 'مطابق', icon: '✅', reduce: 'none', hint: 'عُدّ أو طوبق مع الكشف' },
    { key: 'unverified', ar: 'لم يُطابق', icon: '⏳', reduce: 'none', hint: 'يبقى تنبيهاً مفتوحاً' },
  ],
};

export const DEFAULT_DEDUCTIONS = [
  { label: 'منح العمال', labelFr: 'Primes du personnel', pct: 0 },
  { label: 'المشاريع الخيرية', labelFr: 'Œuvres caritatives', pct: 0 },
];

export const ZAKAT_MODES = [
  { key: 'solar', ar: 'سنة شمسية (ميلادية) — 2.577%', rate: 2.577 },
  { key: 'hijri', ar: 'سنة هجرية — 2.5%', rate: 2.5 },
  { key: 'custom', ar: 'نسبة مخصّصة', rate: null },
];

export const STEPS = [
  { key: 'setup', ar: 'الإعداد', icon: '⚙️' },
  { key: 'partners', ar: 'الشركاء', icon: '👥' },
  { key: 'capital', ar: 'حركة رؤوس الأموال', icon: '🔁' },
  { key: 'invest', ar: 'الاستثمارات', icon: '🏭', cat: 'invest' },
  { key: 'stocks', ar: 'المخزونات', icon: '📦', cat: 'stocks' },
  { key: 'receivables', ar: 'الحقوق والزبائن', icon: '🧾', cat: 'receivables' },
  { key: 'treasury', ar: 'الخزينة', icon: '💰', cat: 'treasury' },
  { key: 'liabilities', ar: 'الخصوم والديون', icon: '📕' },
  { key: 'distribution', ar: 'النتيجة والتوزيع والزكاة', icon: '⚖️' },
  { key: 'analysis', ar: 'تحليل النتيجة والميزانية', icon: '📈' },
  { key: 'reports', ar: 'الكشوفات والإقفال', icon: '🖨️' },
];

export const STEP_DESC = {
  setup: 'حدّد الدورة ونسب التوزيع والزكاة والاقتطاعات — مرة واحدة في بداية الجرد.',
  partners: 'من هم الشركاء، وبكم دخل كل واحد، وما نصيبه من الجهد.',
  capital: 'كل مال خرج أو دخل خلال السنة، بتاريخه، ليُرجَّح بالأيام.',
  invest: 'المعدات ووسائل النقل والتجهيزات بعد خصم تناقص قيمتها.',
  stocks: 'ما في المستودع بعد العدّ الفعلي، مع فرز التالف والراكد.',
  receivables: 'ما لك عند الناس — زبوناً زبوناً — مؤكَّداً أو مشكوكاً فيه أو معدوماً.',
  treasury: 'النقد في الصندوق والأرصدة في البنك والبريد يوم الجرد.',
  liabilities: 'ما على الشركة للغير يوم الجرد.',
  distribution: 'النتيجة، والاقتطاعات، والاحتياط، ونصيب كل شريك، وزكاته، ورأس ماله الجديد.',
  analysis: 'تحليل الإيرادات والتكاليف، ومؤشرات الهيكلة المالية مقارنة بالمعدلات المقبولة.',
  reports: 'معاينة وطباعة كل الكشوفات، والتصدير إلى Excel، ثم إقفال الدورة.',
};

export const PNL_KINDS = [
  { key: 'revenue', ar: 'رقم الأعمال (المبيعات)', fr: "Chiffre d'affaires" },
  { key: 'consumption', ar: 'مستهلكات المخزون (تكلفة البضاعة المباعة)', fr: 'Consommations' },
  { key: 'fixed', ar: 'التكاليف الثابتة', fr: 'Charges fixes' },
  { key: 'variable', ar: 'التكاليف المتغيرة', fr: 'Charges variables' },
  { key: 'depr', ar: 'اهتلاكات السنة', fr: "Dotations de l'exercice" },
];

export const DEFAULT_PNL = [
  ['revenue', 'رقم الأعمال', "Chiffre d'affaires"],
  ['consumption', 'مستهلكات المخزون', 'Consommations de stocks'],
  ['fixed', 'الأجور', 'Salaires'], ['fixed', 'المنح الثابتة', 'Primes fixes'], ['fixed', 'الكراء', 'Loyer'],
  ['fixed', 'الإطعام', 'Restauration'], ['fixed', 'الهاتف / الكهرباء / الماء / الغاز', 'Téléphone, énergie'],
  ['fixed', 'الإشهار', 'Publicité'], ['fixed', 'الضرائب', 'Impôts'], ['fixed', 'الضمان الاجتماعي', 'Sécurité sociale'],
  ['variable', 'لوازم ومستهلكات أخرى', 'Fournitures'], ['variable', 'تنقلات', 'Déplacements'], ['variable', 'نقل', 'Transport'],
  ['variable', 'منح متغيرة', 'Primes variables'], ['variable', 'صيانة', 'Entretien'],
  ['depr', 'اهتلاك المعدات ووسائل النقل', 'Dotations aux amortissements'],
];

// المعدلات المالية: ok(v) يرجع true إن كانت النسبة مقبولة
export const RATIOS = [
  { key: 'projectYield', group: 'yield', ar: 'مردودية المشروع', fr: 'Rentabilité du projet', desc: 'النتيجة الصافية ÷ رأس المال المستثمر', norm: 'حسب النشاط', ok: null },
  { key: 'financialYield', group: 'yield', ar: 'المردودية المالية', fr: 'Rentabilité financière', desc: 'ربح المال ÷ رأس المال المستثمر', norm: 'أكبر من 20%', ok: v => v > 20 },
  { key: 'debt', group: 'structure', ar: 'معدل المديونية', fr: "Taux d'endettement", desc: 'الديون ÷ رؤوس الأموال', norm: 'أقل من 33,33%', ok: v => v < 33.33 },
  { key: 'clientRisk', group: 'structure', ar: 'خطر عدم سداد الزبائن', fr: 'Risque clients', desc: 'ديون الزبائن ÷ رؤوس الأموال', norm: 'أقل من 33,33%', ok: v => v < 33.33 },
  { key: 'stockRisk', group: 'structure', ar: 'خطر الكساد', fr: 'Risque de stock', desc: 'المخزون ÷ رؤوس الأموال', norm: 'أقل من 70%', ok: v => v < 70 },
  { key: 'autonomy', group: 'structure', ar: 'الاستقلالية المالية', fr: 'Autonomie financière', desc: 'رؤوس الأموال ÷ مجموع الخصوم', norm: 'أكبر من 50%', ok: v => v > 50 },
  { key: 'liquidity', group: 'structure', ar: 'معدل السيولة', fr: 'Liquidité générale', desc: 'الأصول المتداولة ÷ الديون', norm: 'أكبر أو يساوي 100%', ok: v => v >= 100 },
  { key: 'immediate', group: 'structure', ar: 'معدل السيولة الآنية', fr: 'Liquidité immédiate', desc: 'الخزينة ÷ الديون', norm: 'بين 10% و25%', ok: v => v >= 10 && v <= 25 },
  { key: 'investFinancing', group: 'structure', ar: 'تمويل الاستثمارات', fr: 'Financement des invest.', desc: 'الاستثمارات ÷ رؤوس الأموال (مهم في الصناعة)', norm: 'أقل من 25%', ok: v => v < 25 },
];

// قوائم التحقق الافتراضية (تُستبدل بورقة ChecklistDefs إن وُجدت)
export const DEFAULT_CHECKLISTS = [
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
  ['analysis', 'هل فسّرت الفرق بين نتيجة الجرد ونتيجة الحسابات إن وُجد؟'],
].map(([step, text], i) => ({ id: 'cl' + (i + 1), step, text, order: i + 1 }));

export function accountOf(cat, key) {
  if (key === AUTO_ADVANCES.key) return AUTO_ADVANCES;
  return (ASSET_ACCOUNTS[cat] || []).find(a => a.key === key) || { key, ar: key, fr: key, zakat: true };
}
export function liabilityOf(key) {
  return LIABILITY_ACCOUNTS.find(a => a.key === key) || { key, ar: key, fr: key };
}
export function statusOf(cat, key) {
  const list = STATUSES[cat] || [];
  return list.find(s => s.key === key) || list[0];
}
