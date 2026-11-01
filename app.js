/* ==================================================================
   Dompetku — app.js  (logika aplikasi)
   - Data tersimpan di Google Sheets lewat Apps Script (Code.gs)
   - Cache lokal untuk tampil instan + antrean offline
   ================================================================== */
'use strict';

const APP_VERSION = '1.1.0';
const K = { cfg: 'dk.cfg', cache: 'dk.cache', queue: 'dk.queue', prefs: 'dk.prefs', demo: 'dk.demo', pin: 'dk.pin', pinFail: 'dk.pinfail' };

/* ---------------- Penyimpanan lokal ---------------- */
const ls = {
  get(k, fb = null) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* penuh / diblokir */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

/* ---------------- Utilitas ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const rp = n => (n < 0 ? '-' : '') + 'Rp ' + nf.format(Math.abs(Math.round(n || 0)));
function rpShort(n) {
  const a = Math.abs(n), f = (v, s) => (v.toFixed(1).replace('.', ',').replace(/,0$/, '')) + s;
  if (a >= 1e9) return f(n / 1e9, ' M');
  if (a >= 1e6) return f(n / 1e6, ' jt');
  if (a >= 1e3) return f(n / 1e3, ' rb');
  return nf.format(n);
}
const pct = n => (n > 0 ? '+' : '') + Math.round(n) + '%';
const genId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => toISO(new Date());
const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d); };
const dayDiff = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 864e5);
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function fmtDate(s, style = 'long') {
  const d = fromISO(s);
  if (style === 'short') return `${d.getDate()} ${BLN[d.getMonth()]}`;
  if (style === 'medium') return `${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()}`;
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}
function relDay(s) {
  const t = today();
  if (s === t) return 'Hari ini';
  if (s === addDays(t, -1)) return 'Kemarin';
  return fmtDate(s);
}

/* ---------------- Ikon (gaya garis tipis) ---------------- */
const IC = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  in: '<path d="M17 7 7 17M17 17H7V7"/>',
  out: '<path d="M7 17 17 7M7 7h10v10"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  cloudOff: '<path d="m2 2 20 20"/><path d="M5.8 5.8A6 6 0 0 0 6 18h11"/><path d="M21 15.5A4.5 4.5 0 0 0 16.5 9h-1.3A7 7 0 0 0 9.5 5.2"/>',
  spark: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 12h-5a2 2 0 0 0 0 4h5v-4z"/><path d="M3 7h16"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  backspace: '<path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="m17 9-6 6M11 9l6 6"/>'
};
const icon = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ---------------- Kategori bawaan ---------------- */
const DEFAULTS = {
  pengeluaran: [['Makan & Minum', '🍜'], ['Belanja Harian', '🛒'], ['Transportasi', '🚗'], ['Tagihan & Utilitas', '💡'], ['Tempat Tinggal', '🏠'], ['Kesehatan', '💊'], ['Pendidikan', '📚'], ['Hiburan', '🎬'], ['Belanja Pribadi', '🛍️'], ['Langganan', '📱'], ['Keluarga', '👨‍👩‍👧'], ['Sedekah & Donasi', '🤲'], ['Cicilan & Utang', '💳'], ['Lainnya', '📦']],
  pemasukan: [['Gaji', '💼'], ['Bonus', '🎁'], ['Usaha', '🏪'], ['Freelance', '💻'], ['Investasi', '📈'], ['Hadiah', '🎉'], ['Cashback & Refund', '↩️'], ['Lainnya', '💰']],
  metode: [['Tunai', '💵'], ['Bank', '🏦'], ['E-Wallet', '📲'], ['Kartu Kredit', '💳']]
};
const toCats = arr => arr.map(([name, icon]) => ({ name, icon }));
const PALETTE = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#84cc16', '#94a3b8'];
const TYPE_LABEL = { pemasukan: 'Pemasukan', pengeluaran: 'Pengeluaran' };

/* ---------------- State ---------------- */
const S = {
  cfg: ls.get(K.cfg),                     // {api, key} atau {demo:true}
  tx: [],
  cats: { pemasukan: toCats(DEFAULTS.pemasukan), pengeluaran: toCats(DEFAULTS.pengeluaran), metode: toCats(DEFAULTS.metode) },
  queue: ls.get(K.queue, []),
  prefs: Object.assign({ theme: 'auto', period: { key: 'month' }, lastMethod: {}, lastType: 'pengeluaran', trend: 'daily' }, ls.get(K.prefs, {})),
  view: 'home',
  loaded: false, loading: false, syncing: false, lastSync: null, syncError: null, skipped: 0, sheetName: '',
  hist: { q: '', type: 'all', cat: '', from: '', to: '', limit: 60, open: false },
  charts: {}
};
const savePrefs = () => ls.set(K.prefs, S.prefs);
const saveQueue = () => ls.set(K.queue, S.queue);
const saveCache = () => ls.set(K.cache, { tx: S.tx, cats: S.cats, lastSync: S.lastSync, sheetName: S.sheetName, skipped: S.skipped });

/* ==================================================================
   API — ke Google Apps Script (atau mode demo)
   ================================================================== */
function apiError(message, extra) { return Object.assign(new Error(message), extra || {}); }

async function api(action, payload = {}) {
  if (S.cfg?.demo) return Demo.call(action, payload);
  if (!S.cfg?.api) throw apiError('Aplikasi belum terhubung ke spreadsheet.', { code: 'SETUP' });
  return apiRaw(S.cfg.api, S.cfg.key, action, payload);
}

async function apiRaw(url, key, action, payload = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let res;
  try {
    // text/plain → tanpa preflight CORS (dibutuhkan oleh Apps Script)
    res = await fetch(url, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, key, payload })
    });
  } catch (e) {
    throw apiError(navigator.onLine ? 'Tidak dapat terhubung ke server.' : 'Kamu sedang offline.', { offline: true });
  } finally { clearTimeout(timer); }
  let json;
  try { json = await res.json(); }
  catch (e) { throw apiError('Respons server tidak valid. Periksa URL Web App & pastikan aksesnya "Siapa saja".', { code: 'BAD_RESPONSE' }); }
  if (!json.ok) throw apiError(json.error || 'Terjadi kesalahan di server.', { code: json.code });
  return json.data;
}

/* ---------------- Mode demo (data contoh di HP, tanpa spreadsheet) ---------------- */
const Demo = {
  db() {
    let db = ls.get(K.demo);
    if (!db) { db = this.seed(); ls.set(K.demo, db); }
    return db;
  },
  seed() {
    const tx = [], t = today();
    const exp = [['Makan & Minum', 18000, 85000, 'Makan siang|Kopi|Makan malam|Sarapan'], ['Transportasi', 12000, 60000, 'Ojek online|Bensin|Parkir'], ['Belanja Harian', 25000, 250000, 'Supermarket|Sayur & buah'], ['Hiburan', 35000, 150000, 'Nonton|Game'], ['Langganan', 54000, 186000, 'Spotify|Netflix'], ['Belanja Pribadi', 80000, 400000, 'Baju|Skincare'], ['Kesehatan', 30000, 200000, 'Vitamin|Obat']];
    const meth = ['Tunai', 'E-Wallet', 'E-Wallet', 'Bank', 'Kartu Kredit'];
    let r = 7;
    const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    for (let d = 0; d < 100; d++) {
      const date = addDays(t, -d);
      const n = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const [cat, lo, hi, notes] = exp[Math.floor(rand() * (d % 9 === 0 ? 7 : 3))];
        const ns = notes.split('|');
        tx.push({ id: genId() + d + i, type: 'pengeluaran', date, category: cat, amount: Math.round((lo + rand() * (hi - lo)) / 500) * 500, note: ns[Math.floor(rand() * ns.length)], method: meth[Math.floor(rand() * meth.length)] });
      }
      const day = fromISO(date).getDate();
      if (day === 1) tx.push({ id: genId() + 'g' + d, type: 'pemasukan', date, category: 'Gaji', amount: 9500000, note: 'Gaji bulanan', method: 'Bank' });
      if (day === 5) tx.push({ id: genId() + 't' + d, type: 'pengeluaran', date, category: 'Tempat Tinggal', amount: 2500000, note: 'Sewa kos', method: 'Bank' });
      if (day === 10) tx.push({ id: genId() + 'l' + d, type: 'pengeluaran', date, category: 'Tagihan & Utilitas', amount: 350000, note: 'Listrik & internet', method: 'Bank' });
      if (day === 18) tx.push({ id: genId() + 'f' + d, type: 'pemasukan', date, category: 'Freelance', amount: 1500000 + Math.round(rand() * 20) * 100000, note: 'Proyek desain', method: 'Bank' });
    }
    tx.forEach((x, i) => { x.seq = tx.length - i; });
    return { tx, cats: { pemasukan: toCats(DEFAULTS.pemasukan), pengeluaran: toCats(DEFAULTS.pengeluaran), metode: toCats(DEFAULTS.metode) } };
  },
  async call(action, p) {
    await new Promise(r => setTimeout(r, 350));
    const db = this.db();
    const save = () => ls.set(K.demo, db);
    switch (action) {
      case 'ping': return { app: 'Dompetku', spreadsheet: 'Mode Demo' };
      case 'list': return { transactions: db.tx, categories: db.cats, spreadsheet: 'Mode Demo', skipped: 0 };
      case 'add': if (!db.tx.some(t => t.id === p.tx.id)) db.tx.push({ ...p.tx, seq: Date.now() }); save(); return { id: p.tx.id };
      case 'update': { const i = db.tx.findIndex(t => t.id === p.tx.id); if (i < 0) throw apiError('Transaksi tidak ditemukan.', { code: 'NOT_FOUND' }); db.tx[i] = { ...db.tx[i], ...p.tx }; save(); return { id: p.tx.id }; }
      case 'delete': db.tx = db.tx.filter(t => t.id !== p.id); save(); return { id: p.id };
      case 'addCategory': if (!db.cats[p.type].some(c => c.name.toLowerCase() === p.name.toLowerCase())) db.cats[p.type].push({ name: p.name, icon: p.icon }); save(); return { added: true };
    }
    throw apiError('Aksi tidak dikenal');
  }
};

/* ==================================================================
   DATA: memuat, sinkron, antrean offline
   ================================================================== */
const waiters = new Map();
const DROP_CODES = ['VALIDATION', 'NOT_FOUND', 'BAD_REQUEST'];

function normalizeTx(t) {
  return { id: String(t.id), type: t.type === 'pemasukan' ? 'pemasukan' : 'pengeluaran', date: t.date, amount: Math.abs(Number(t.amount) || 0), category: t.category || '', note: t.note || '', method: t.method || '', seq: t.seq || 0, pending: !!t.pending };
}
function sortTx() { S.tx.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (b.seq || 0) - (a.seq || 0)); }

function mergeCats(server) {
  const out = {};
  ['pemasukan', 'pengeluaran', 'metode'].forEach(k => {
    const list = (server && server[k] && server[k].length ? server[k] : toCats(DEFAULTS[k])).map(c => ({ name: c.name, icon: c.icon || '' }));
    out[k] = list;
  });
  // kategori yang terpakai di data lama tapi belum ada di daftar
  S.tx.forEach(t => {
    const list = out[t.type];
    if (t.category && !list.some(c => c.name.toLowerCase() === t.category.toLowerCase())) list.push({ name: t.category, icon: '' });
    if (t.method && !out.metode.some(c => c.name.toLowerCase() === t.method.toLowerCase())) out.metode.push({ name: t.method, icon: '' });
  });
  S.cats = out;
}

/** Terapkan operasi yang masih antre di atas data server (supaya tidak "hilang" saat refresh). */
function applyQueue(list) {
  const byId = new Map(list.map(t => [t.id, t]));
  S.queue.forEach(op => {
    if (op.action === 'add' || op.action === 'update') byId.set(op.payload.tx.id, normalizeTx({ ...op.payload.tx, pending: true, seq: byId.get(op.payload.tx.id)?.seq || Date.now() }));
    if (op.action === 'delete') byId.delete(op.payload.id);
  });
  return Array.from(byId.values());
}

function loadCache() {
  const c = ls.get(K.cache);
  if (!c) return false;
  S.tx = (c.tx || []).map(normalizeTx);
  S.lastSync = c.lastSync || null; S.sheetName = c.sheetName || ''; S.skipped = c.skipped || 0;
  mergeCats(c.cats);
  S.tx = applyQueue(S.tx); sortTx();
  S.loaded = true;
  return true;
}

async function refresh({ silent = false } = {}) {
  if (!S.cfg || S.loading) return;
  S.loading = true; renderTopbar();
  try {
    if (S.queue.length) await flush();
    const data = await api('list');
    let list = (data.transactions || []).map(normalizeTx);
    S.tx = applyQueue(list);
    mergeCats(data.categories);
    sortTx();
    S.lastSync = new Date().toISOString(); S.sheetName = data.spreadsheet || ''; S.skipped = data.skipped || 0;
    S.syncError = null; S.loaded = true;
    saveCache();
  } catch (e) {
    S.syncError = e.message;
    if (e.code === 'AUTH' || e.code === 'SETUP') { toast('error', e.code === 'AUTH' ? 'Kunci akses ditolak. Periksa di Pengaturan → Koneksi.' : e.message); }
    else if (!silent || !S.loaded) toast(e.offline ? 'warn' : 'error', e.offline ? 'Offline — menampilkan data tersimpan di HP.' : 'Gagal memuat data: ' + e.message);
  } finally {
    S.loading = false; S.loaded = true;
    render();
  }
}

function enqueue(action, payload) {
  const op = { opId: genId(), action, payload, at: Date.now() };
  S.queue.push(op); saveQueue();
  const p = new Promise((resolve, reject) => waiters.set(op.opId, { resolve, reject }));
  flush();
  return p;
}

async function flush() {
  if (S.syncing) return;
  S.syncing = true; renderTopbar();
  let needResync = false;
  try {
    while (S.queue.length) {
      const op = S.queue[0];
      try {
        await api(op.action, op.payload);
        S.queue.shift(); saveQueue();
        const id = op.payload.tx?.id;
        if (id) { const t = S.tx.find(x => x.id === id); if (t && !S.queue.some(q => q.payload.tx?.id === id)) t.pending = false; }
        settle(op.opId, null);
      } catch (err) {
        if (DROP_CODES.includes(err.code)) {          // ditolak server → buang & sinkron ulang
          S.queue.shift(); saveQueue(); needResync = true; settle(op.opId, err);
        } else {                                       // offline / kunci salah / server sibuk → simpan, coba lagi nanti
          S.queue.forEach(q => settle(q.opId, Object.assign(err, { kept: true })));
          S.syncError = err.message;
          break;
        }
      }
    }
    if (!S.queue.length) S.syncError = null;
  } finally {
    S.syncing = false; saveCache(); renderTopbar();
    if (S.view === 'settings') renderSettings();
  }
  if (needResync) refresh({ silent: true });
}
function settle(opId, err) {
  const w = waiters.get(opId); if (!w) return;
  waiters.delete(opId);
  err ? w.reject(err) : w.resolve();
}

/* ---------------- Operasi transaksi (optimistic) ---------------- */
async function saveTx(tx, isNew) {
  tx = normalizeTx(tx);
  tx.pending = true;
  const i = S.tx.findIndex(t => t.id === tx.id);
  if (i >= 0) { tx.seq = S.tx[i].seq; S.tx[i] = tx; } else { tx.seq = Date.now(); S.tx.push(tx); }
  sortTx(); saveCache(); render();

  // Jika transaksi ini masih menunggu dikirim, cukup perbarui antreannya
  const queued = S.queue.find(q => (q.action === 'add' || q.action === 'update') && q.payload.tx.id === tx.id && q !== S.queue[0]);
  const clean = { id: tx.id, type: tx.type, date: tx.date, amount: tx.amount, category: tx.category, note: tx.note, method: tx.method };
  if (queued) { queued.payload.tx = clean; saveQueue(); return; }
  return enqueue(isNew ? 'add' : 'update', { tx: clean });
}

async function removeTx(t) {
  S.tx = S.tx.filter(x => x.id !== t.id);
  saveCache(); render();
  const qi = S.queue.findIndex((q, i) => i > 0 && q.action === 'add' && q.payload.tx.id === t.id);
  if (qi > 0) {   // belum pernah terkirim → cukup hapus dari antrean
    S.queue = S.queue.filter(q => q.payload.tx?.id !== t.id); saveQueue(); return;
  }
  return enqueue('delete', { id: t.id, type: t.type });
}

/* ==================================================================
   ANALITIK
   ================================================================== */
function periodRange(p = S.prefs.period) {
  const t = today(), d = fromISO(t), y = d.getFullYear();
  switch (p.key) {
    case 'today': return { from: t, to: t, label: 'Hari ini' };
    case 'week': { const from = addDays(t, -((d.getDay() + 6) % 7)); return { from, to: addDays(from, 6), label: 'Minggu ini' }; }
    case 'year': return { from: `${y}-01-01`, to: `${y}-12-31`, label: 'Tahun ini' };
    case 'custom': if (p.from && p.to) return { from: p.from, to: p.to, label: `${fmtDate(p.from, 'short')} – ${fmtDate(p.to, 'medium')}` };
    // fallthrough
    default: return { from: toISO(new Date(y, d.getMonth(), 1)), to: toISO(new Date(y, d.getMonth() + 1, 0)), label: 'Bulan ini' };
  }
}
/** Periode pembanding dengan panjang hari yang setara (mis. 1–15 Nov vs 1–15 Okt). */
function prevRange(r, key = S.prefs.period.key) {
  const t = today();
  const effTo = (r.to > t && r.from <= t) ? t : r.to;
  const elapsed = dayDiff(r.from, effTo);
  let from;
  if (key === 'month') { const d = fromISO(r.from); from = toISO(new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  else if (key === 'year') from = `${Number(r.from.slice(0, 4)) - 1}-01-01`;
  else from = addDays(r.from, -(dayDiff(r.from, r.to) + 1));
  let to = addDays(from, elapsed);
  if (key === 'month') { const d = fromISO(from); const end = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)); if (to > end) to = end; }
  return { from, to, effTo, days: elapsed + 1 };
}
const inRange = (t, r) => t.date >= r.from && t.date <= r.to;
function summarize(list) {
  let inc = 0, exp = 0;
  for (const t of list) { if (t.type === 'pemasukan') inc += t.amount; else exp += t.amount; }
  return { inc, exp, net: inc - exp, count: list.length };
}
function byCategory(list, type = 'pengeluaran') {
  const m = new Map();
  list.forEach(t => { if (t.type !== type) return; const k = t.category || 'Tanpa kategori'; m.set(k, (m.get(k) || 0) + t.amount); });
  return Array.from(m, ([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
}
function catIcon(type, name) {
  const c = (S.cats[type] || []).find(x => x.name.toLowerCase() === String(name).toLowerCase());
  return (c && c.icon) || (type === 'pemasukan' ? '💰' : '🏷️');
}
function methodIcon(name) { const c = S.cats.metode.find(x => x.name.toLowerCase() === String(name).toLowerCase()); return (c && c.icon) || '💳'; }

function insights(r) {
  const key = S.prefs.period.key;
  const cur = S.tx.filter(t => inRange(t, r));
  const s = summarize(cur);
  const pr = prevRange(r, key);
  const curElapsed = S.tx.filter(t => t.date >= r.from && t.date <= pr.effTo);
  const prev = summarize(S.tx.filter(t => inRange(t, pr)));
  const sc = summarize(curElapsed);
  const cats = byCategory(cur);
  const out = [];

  if (cats.length) {
    const top = cats[0];
    out.push({ wide: true, k: 'Pengeluaran terbesar', v: `${catIcon('pengeluaran', top.name)} ${esc(top.name)}`, s: `${rp(top.total)} · ${Math.round(top.total / (s.exp || 1) * 100)}% dari total pengeluaran` });
  }
  const days = Math.max(1, pr.days);
  out.push({ k: 'Rata-rata harian', v: rp(sc.exp / days), s: `pengeluaran · ${days} hari` });

  if (prev.exp > 0) {
    const ch = (sc.exp - prev.exp) / prev.exp * 100;
    out.push({ k: 'vs periode lalu', v: `<span class="${ch > 0 ? 'up' : 'down'}">${pct(ch)}</span>`, s: `pengeluaran ${ch > 0 ? 'naik' : 'turun'} dari ${rp(prev.exp)}` });
  } else out.push({ k: 'vs periode lalu', v: '—', s: 'belum ada data pembanding' });

  if (s.inc > 0) {
    const rate = s.net / s.inc * 100;
    out.push({ k: 'Rasio tabungan', v: `<span class="${rate >= 0 ? 'good' : 'bad'}">${Math.round(rate)}%</span>`, s: rate >= 20 ? 'sehat, pertahankan' : rate >= 0 ? 'target ideal ≥ 20%' : 'pengeluaran melebihi pemasukan' });
  }
  if (key === 'month' && r.to >= today() && r.from <= today()) {
    const totalDays = dayDiff(r.from, r.to) + 1;
    out.push({ k: 'Proyeksi akhir bulan', v: rp(sc.exp / days * totalDays), s: 'jika pola belanja tetap' });
  }
  const big = cur.filter(t => t.type === 'pengeluaran').sort((a, b) => b.amount - a.amount)[0];
  if (big) out.push({ k: 'Transaksi terbesar', v: rp(big.amount), s: `${esc(big.category)} · ${fmtDate(big.date, 'short')}` });
  return { s, out, cats };
}

/* ==================================================================
   UI: toast, sheet, dialog
   ================================================================== */
function toast(type, msg, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const ic = { success: icon('check', 14), error: icon('x', 14), warn: '!', loading: '' }[type] || '';
  el.innerHTML = `<span class="t-ic">${ic}</span><span class="t-msg">${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  const ctl = {
    el,
    update(t, m, d = 2600) { el.className = 'toast ' + t; el.querySelector('.t-ic').innerHTML = { success: icon('check', 14), error: icon('x', 14), warn: '!' }[t] || ''; el.querySelector('.t-msg').textContent = m; ctl.hideIn(d); },
    hide() { el.classList.add('out'); setTimeout(() => el.remove(), 260); },
    hideIn(d) { clearTimeout(ctl.t); ctl.t = setTimeout(ctl.hide, d); }
  };
  if (type !== 'loading') ctl.hideIn(ms);
  el.addEventListener('click', ctl.hide);
  return ctl;
}

const sheets = [];
let popIgnore = 0, popResolve = null;
function openSheet({ title = '', html, foot = '', cls = '', onMount, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap ' + cls;
  wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true">
    ${cls.includes('dialog') ? '' : '<div class="sheet-handle"></div>'}
    ${title ? `<div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Tutup">${icon('x', 18)}</button></div>` : ''}
    <div class="sheet-body">${html}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  const sh = { el: wrap, onClose, close: fromPop => closeSheet(sh, fromPop) };
  wrap.addEventListener('click', e => { if (e.target.classList.contains('sheet-backdrop') || e.target.closest('[data-close]')) sh.close(); });
  enableDrag(sh);
  sheets.push(sh);
  history.pushState({ sheet: sheets.length }, '');
  onMount && onMount(sh);
  return sh;
}
function closeSheet(sh, fromPop) {
  const i = sheets.indexOf(sh);
  if (i < 0) return Promise.resolve();
  sheets.splice(i, 1);
  sh.el.classList.remove('open');
  setTimeout(() => sh.el.remove(), 320);
  sh.onClose && sh.onClose();
  if (fromPop) return Promise.resolve();
  return new Promise(res => { popIgnore++; popResolve = res; history.back(); setTimeout(() => { if (popResolve === res) { popResolve = null; res(); } }, 400); });
}
window.addEventListener('popstate', () => {
  if (popIgnore > 0) { popIgnore--; const r = popResolve; popResolve = null; r && r(); return; }
  const top = sheets[sheets.length - 1];
  if (top) top.close(true);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheets.length) sheets[sheets.length - 1].close(); });

/** Geser ke bawah untuk menutup sheet. */
function enableDrag(sh) {
  const sheet = $('.sheet', sh.el);
  const grip = $('.sheet-handle', sh.el);
  const head = $('.sheet-head', sh.el);
  if (!grip) return;
  let y0 = null, dy = 0;
  const start = e => { y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; };
  const move = e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; };
  const end = () => { if (y0 == null) return; sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 90) sh.close(); y0 = null; };
  [grip, head].forEach(el => { if (!el) return; el.addEventListener('touchstart', start, { passive: true }); el.addEventListener('touchmove', move, { passive: true }); el.addEventListener('touchend', end); });
}

function confirmDialog({ title, message, ok = 'Hapus', cancel = 'Batal', danger = true }) {
  return new Promise(resolve => {
    let result = false;
    const sh = openSheet({
      cls: 'dialog',
      html: `<div class="dialog-body"><div class="art">${icon('trash', 22)}</div><h3>${esc(title)}</h3><p>${esc(message)}</p></div>
             <div class="dialog-actions"><button class="btn secondary" data-close>${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button></div>`,
      onClose: () => resolve(result),
      onMount: s => $('[data-ok]', s.el).addEventListener('click', () => { result = true; s.close(); })
    });
  });
}

/* ==================================================================
   RENDER
   ================================================================== */
const VIEW_TITLE = { home: '', stats: 'Statistik', history: 'Riwayat', settings: 'Pengaturan' };

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
}
function syncLabel() {
  if (S.cfg?.demo) return '<span class="sync-dot warn"></span>Mode demo';
  if (S.syncing || S.loading) return 'Menyinkronkan…';
  if (S.queue.length) return `<span class="sync-dot warn"></span>${S.queue.length} menunggu dikirim`;
  if (S.syncError) return '<span class="sync-dot err"></span>Belum tersinkron';
  if (S.lastSync) { const d = new Date(S.lastSync); return `<span class="sync-dot"></span>Tersinkron ${pad(d.getHours())}.${pad(d.getMinutes())}`; }
  return '';
}
function renderTopbar() {
  const tb = $('#topbar');
  const title = S.view === 'home' ? greeting() : VIEW_TITLE[S.view];
  const sub = S.view === 'home' ? fmtDate(today()) : '';
  tb.innerHTML = `<div class="tb-text"><h1>${esc(title)}</h1><div class="sub">${sub ? esc(sub) + ' · ' : ''}${syncLabel()}</div></div>
    <button class="icon-btn ${S.loading || S.syncing ? 'spin' : ''}" data-action="refresh" aria-label="Sinkronkan">${icon('refresh', 18)}</button>`;
}

function render() {
  renderTopbar();
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === S.view));
  $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === S.view));
  ({ home: renderHome, stats: renderStats, history: renderHistory, settings: renderSettings })[S.view]();
}

function navigate(view) {
  if (S.view === view) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  S.view = view; window.scrollTo(0, 0); render();
}

/* ---------- Komponen kecil ---------- */
function periodChips() {
  const p = S.prefs.period;
  const items = [['today', 'Hari ini'], ['week', 'Minggu ini'], ['month', 'Bulan ini'], ['year', 'Tahun ini']];
  const r = periodRange();
  return `<div class="chips period-bar">${items.map(([k, l]) => `<button class="chip ${p.key === k ? 'active' : ''}" data-period="${k}">${l}</button>`).join('')}
    <button class="chip ${p.key === 'custom' ? 'active' : ''}" data-period="custom">${icon('calendar', 15)}${p.key === 'custom' ? esc(r.label) : 'Custom'}</button></div>`;
}
function txRow(t, i = 0) {
  const sign = t.type === 'pemasukan' ? '+' : '−';
  const sub = [t.note, t.method].filter(Boolean).join(' · ') || fmtDate(t.date, 'medium');
  return `<button class="tx" data-tx="${esc(t.id)}" style="animation-delay:${Math.min(i, 12) * 18}ms">
    <span class="tx-ic">${catIcon(t.type, t.category)}</span>
    <span class="tx-main"><b>${esc(t.category || 'Tanpa kategori')}</b><small>${t.pending ? '<span class="pending">● menunggu sinkron</span> · ' : ''}${esc(sub)}</small></span>
    <span class="tx-amt amt ${t.type}">${sign}${rp(t.amount)}</span></button>`;
}
function emptyState(ic, title, text, btn = '') {
  return `<div class="empty"><div class="art">${icon(ic, 34)}</div><h4>${esc(title)}</h4><p>${esc(text)}</p>${btn}</div>`;
}
const skeleton = () => `<div class="skel" style="height:190px;margin-bottom:14px"></div><div class="insights"><div class="skel" style="height:86px"></div><div class="skel" style="height:86px"></div></div><div class="skel" style="height:260px;margin-top:22px"></div>`;
function demoBanner() {
  return S.cfg?.demo ? `<div class="banner">${icon('spark', 18)}<span><b>Mode demo.</b> Data contoh, tidak tersimpan ke spreadsheet.</span><button class="btn primary" data-action="connect">Hubungkan</button></div>` : '';
}

/* ---------- Beranda ---------- */
function renderHome() {
  const el = $('[data-view="home"]');
  if (!S.loaded) { el.innerHTML = periodChips() + skeleton(); return; }
  const r = periodRange();
  const { s, out } = insights(r);
  const share = s.inc + s.exp > 0 ? (s.inc / (s.inc + s.exp)) * 100 : 50;
  const recent = S.tx.slice(0, 6);
  el.innerHTML = `${demoBanner()}${periodChips()}
    <div class="balance">
      <div class="lbl">Saldo bersih · ${esc(r.label)}</div>
      <div class="big amt ${s.net < 0 ? 'neg' : ''}">${rp(s.net)}</div>
      <div class="split">
        <div class="it"><span class="dot in">${icon('in', 17)}</span><div style="min-width:0"><small>Pemasukan</small><b class="amt">${rp(s.inc)}</b></div></div>
        <div class="it"><span class="dot out">${icon('out', 17)}</span><div style="min-width:0"><small>Pengeluaran</small><b class="amt">${rp(s.exp)}</b></div></div>
      </div>
      ${s.inc + s.exp > 0 ? `<div class="ratio"><i style="width:${share}%"></i></div><div class="ratio-cap"><span>${s.count} transaksi</span><span>${s.inc > 0 ? Math.round(s.exp / s.inc * 100) + '% pemasukan terpakai' : 'belum ada pemasukan'}</span></div>` : ''}
    </div>
    ${s.count ? `<div class="section-head"><h2>Insight</h2></div><div class="insights">${out.map(o => `<div class="ins ${o.wide ? 'wide' : ''}"><div class="k">${o.wide ? icon('spark', 14) : ''}${o.k}</div><div class="v amt">${o.v}</div><div class="s">${o.s}</div></div>`).join('')}</div>` : ''}
    <div class="section-head"><h2>Transaksi terbaru</h2>${S.tx.length ? '<button class="link" data-nav="history">Lihat semua</button>' : ''}</div>
    ${recent.length ? `<div class="tx-list">${recent.map(txRow).join('')}</div>`
      : emptyState('receipt', 'Belum ada transaksi', 'Catat pemasukan atau pengeluaran pertamamu. Cuma butuh beberapa detik.', '<button class="btn primary" data-action="add">' + icon('plus', 18) + 'Tambah transaksi</button>')}`;
}

/* ---------- Statistik ---------- */
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function destroyCharts() { Object.values(S.charts).forEach(c => c && c.destroy()); S.charts = {}; }

function renderStats() {
  const el = $('[data-view="stats"]');
  destroyCharts();
  if (!S.loaded) { el.innerHTML = periodChips() + skeleton(); return; }
  const r = periodRange();
  const list = S.tx.filter(t => inRange(t, r));
  const s = summarize(list);
  const cats = byCategory(list);
  const mode = S.prefs.trend;
  const top = cats.slice(0, 7);
  if (cats.length > 7) top.push({ name: 'Lainnya (gabungan)', total: cats.slice(7).reduce((a, b) => a + b.total, 0), merged: true });

  el.innerHTML = `${demoBanner()}${periodChips()}
    <div class="card">
      <div class="card-head"><h3>Pengeluaran per kategori</h3><span class="muted">${esc(r.label)}</span></div>
      ${cats.length ? `<div class="donut"><canvas id="ch-cat"></canvas><div class="donut-c"><small>Total</small><b class="amt">${rpShort(s.exp)}</b></div></div>
      <div class="cat-rows">${top.map((c, i) => `<div class="cat-row"><span class="em">${c.merged ? '⋯' : catIcon('pengeluaran', c.name)}</span>
        <div><div class="nm"><span>${esc(c.name)}</span><span class="pc">${Math.round(c.total / s.exp * 100)}%</span></div><div class="bar"><i style="width:${c.total / cats[0].total * 100}%;background:${PALETTE[i % PALETTE.length]}"></i></div></div>
        <span class="am amt">${rp(c.total)}</span></div>`).join('')}</div>`
      : emptyState('pie', 'Belum ada pengeluaran', 'Tidak ada pengeluaran di periode ini.')}
    </div>
    <div class="card">
      <div class="card-head"><h3>Tren</h3><div class="seg sm"><button class="${mode === 'daily' ? 'active' : ''}" data-trend="daily">Harian</button><button class="${mode === 'monthly' ? 'active' : ''}" data-trend="monthly">Bulanan</button></div></div>
      <div class="chart-box"><canvas id="ch-trend"></canvas></div>
      <div class="legend"><span><i style="background:${cssVar('--expense')}"></i>Pengeluaran</span><span><i style="background:${cssVar('--income')}"></i>Pemasukan</span></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Pemasukan vs Pengeluaran</h3><span class="muted">6 bulan terakhir</span></div>
      <div class="chart-box"><canvas id="ch-vs"></canvas></div>
    </div>`;

  if (!window.Chart) {
    $$('canvas', el).forEach(c => { c.parentElement.innerHTML = '<div class="empty" style="padding:60px 10px">Grafik sedang dimuat… pastikan internet aktif saat pertama kali membuka aplikasi.</div>'; });
    return;
  }
  const text = cssVar('--muted'), grid = cssVar('--border'), inc = cssVar('--income'), exp = cssVar('--expense');
  Chart.defaults.font.family = cssVar('--font') || 'Inter, sans-serif';
  Chart.defaults.color = text;
  const tooltip = { backgroundColor: cssVar('--primary'), titleColor: cssVar('--on-primary'), bodyColor: cssVar('--on-primary'), padding: 10, cornerRadius: 10, displayColors: false, callbacks: { label: c => `${c.dataset.label ? c.dataset.label + ': ' : ''}${rp(c.parsed.y ?? c.parsed)}` } };
  const scales = { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } }, y: { grid: { color: grid }, border: { display: false }, ticks: { callback: v => rpShort(v), maxTicksLimit: 5 }, beginAtZero: true } };

  if (cats.length) {
    S.charts.cat = new Chart($('#ch-cat'), {
      type: 'doughnut',
      data: { labels: top.map(c => c.name), datasets: [{ data: top.map(c => c.total), backgroundColor: top.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 0, hoverOffset: 6 }] },
      options: { cutout: '74%', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip } }
    });
  }

  // Tren
  const tr = trendData(r, mode);
  S.charts.trend = new Chart($('#ch-trend'), {
    type: mode === 'daily' ? 'line' : 'bar',
    data: { labels: tr.labels, datasets: [
      { label: 'Pengeluaran', data: tr.out, borderColor: exp, backgroundColor: mode === 'daily' ? hexA(exp, .10) : exp, fill: mode === 'daily', tension: .35, pointRadius: 0, pointHitRadius: 12, borderWidth: 2, borderRadius: 6, maxBarThickness: 18 },
      { label: 'Pemasukan', data: tr.in, borderColor: inc, backgroundColor: mode === 'daily' ? 'transparent' : inc, tension: .35, pointRadius: 0, pointHitRadius: 12, borderWidth: 2, borderDash: mode === 'daily' ? [4, 4] : [], borderRadius: 6, maxBarThickness: 18 }
    ] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip }, scales }
  });

  // Perbandingan 6 bulan
  const vs = monthly(6, today());
  S.charts.vs = new Chart($('#ch-vs'), {
    type: 'bar',
    data: { labels: vs.labels, datasets: [
      { label: 'Pemasukan', data: vs.in, backgroundColor: inc, borderRadius: 6, maxBarThickness: 16 },
      { label: 'Pengeluaran', data: vs.out, backgroundColor: exp, borderRadius: 6, maxBarThickness: 16 }
    ] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16 } }, tooltip }, scales }
  });
}
function hexA(hex, a) {
  const m = hex.replace('#', '').match(/.{2}/g); if (!m || m.length < 3) return hex;
  return `rgba(${parseInt(m[0], 16)},${parseInt(m[1], 16)},${parseInt(m[2], 16)},${a})`;
}
function trendData(r, mode) {
  if (mode === 'monthly') return monthly(12, r.to < today() ? r.to : today());
  let to = r.to > today() && r.from <= today() ? today() : r.to;
  let from = r.from;
  if (dayDiff(from, to) < 6) from = addDays(to, -6);
  const labels = [], inn = [], out = [], idx = {};
  for (let d = from, i = 0; d <= to; d = addDays(d, 1), i++) { idx[d] = i; labels.push(fmtDate(d, 'short')); inn.push(0); out.push(0); }
  S.tx.forEach(t => { const i = idx[t.date]; if (i === undefined) return; (t.type === 'pemasukan' ? inn : out)[i] += t.amount; });
  return { labels, in: inn, out };
}
function monthly(n, endISO) {
  const end = fromISO(endISO), labels = [], keys = [], inn = [], out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(end.getFullYear(), end.getMonth() - i, 1); keys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); labels.push(BLN[d.getMonth()] + (n > 6 ? ` '${String(d.getFullYear()).slice(2)}` : '')); inn.push(0); out.push(0); }
  S.tx.forEach(t => { const i = keys.indexOf(t.date.slice(0, 7)); if (i < 0) return; (t.type === 'pemasukan' ? inn : out)[i] += t.amount; });
  return { labels, in: inn, out };
}

/* ---------- Riwayat ---------- */
function renderHistory() {
  const el = $('[data-view="history"]');
  const h = S.hist;
  const active = (h.cat ? 1 : 0) + (h.from ? 1 : 0) + (h.to ? 1 : 0);
  const allCats = [...S.cats.pengeluaran.map(c => ['pengeluaran', c.name]), ...S.cats.pemasukan.map(c => ['pemasukan', c.name])];
  el.innerHTML = `<div class="search-row"><div class="search">${icon('search', 18)}<input class="input" id="h-q" type="search" placeholder="Cari catatan, kategori, nominal…" value="${esc(h.q)}" autocomplete="off"></div>
      <button class="filter-btn ${h.open ? 'active' : ''}" data-action="toggle-filter" aria-label="Filter">${icon('filter', 18)}${active ? `<span class="badge">${active}</span>` : ''}</button></div>
    <div class="chips">
      ${[['all', 'Semua'], ['pengeluaran', 'Pengeluaran'], ['pemasukan', 'Pemasukan']].map(([k, l]) => `<button class="chip ${h.type === k ? 'active' : ''}" data-htype="${k}">${l}</button>`).join('')}
    </div>
    <div class="filters" ${h.open ? '' : 'hidden'}>
      <div class="full"><label>Kategori</label><select class="select" id="h-cat"><option value="">Semua kategori</option>
        ${allCats.filter(([t]) => h.type === 'all' || h.type === t).map(([t, n]) => `<option value="${esc(t + '|' + n)}" ${h.cat === t + '|' + n ? 'selected' : ''}>${esc(catIcon(t, n) + ' ' + n)}${h.type === 'all' ? ' · ' + TYPE_LABEL[t] : ''}</option>`).join('')}</select></div>
      <div><label>Dari tanggal</label><input class="input" type="date" id="h-from" value="${esc(h.from)}"></div>
      <div><label>Sampai tanggal</label><input class="input" type="date" id="h-to" value="${esc(h.to)}"></div>
      ${active ? '<button class="btn ghost full" data-action="reset-filter">Reset filter</button>' : ''}
    </div>
    <div id="h-list"></div>`;
  renderHistoryList();
}
function filteredTx() {
  const h = S.hist;
  const q = h.q.trim().toLowerCase();
  const qNum = q.replace(/[^0-9]/g, '');
  const [ct, cn] = h.cat ? h.cat.split('|') : [];
  return S.tx.filter(t => {
    if (h.type !== 'all' && t.type !== h.type) return false;
    if (ct && (t.type !== ct || t.category.toLowerCase() !== cn.toLowerCase())) return false;
    if (h.from && t.date < h.from) return false;
    if (h.to && t.date > h.to) return false;
    if (q) {
      const hay = (t.category + ' ' + t.note + ' ' + t.method).toLowerCase();
      if (!hay.includes(q) && !(qNum && String(Math.round(t.amount)).includes(qNum))) return false;
    }
    return true;
  });
}
function renderHistoryList() {
  const box = $('#h-list'); if (!box) return;
  if (!S.loaded) { box.innerHTML = '<div class="skel" style="height:300px;margin-top:16px"></div>'; return; }
  const list = filteredTx();
  if (!list.length) {
    const filtering = S.hist.q || S.hist.cat || S.hist.from || S.hist.to || S.hist.type !== 'all';
    box.innerHTML = filtering ? emptyState('search', 'Tidak ditemukan', 'Coba kata kunci atau filter lain.') : emptyState('receipt', 'Belum ada transaksi', 'Transaksi yang kamu catat akan muncul di sini.', `<button class="btn primary" data-action="add">${icon('plus', 18)}Tambah transaksi</button>`);
    return;
  }
  const s = summarize(list);
  const shown = list.slice(0, S.hist.limit);
  const groups = [];
  shown.forEach(t => { const g = groups[groups.length - 1]; if (g && g.date === t.date) g.items.push(t); else groups.push({ date: t.date, items: [t] }); });
  const dayNet = d => { const x = summarize(list.filter(t => t.date === d)); return x.net; };
  box.innerHTML = `<div class="result-sum"><span>${list.length} transaksi</span><span class="amt"><span class="good">+${rpShort(s.inc)}</span> · <span>−${rpShort(s.exp)}</span></span></div>
    ${groups.map(g => { const n = dayNet(g.date); return `<div class="day-head"><span>${esc(relDay(g.date))}</span><span class="amt">${n >= 0 ? '+' : '−'}${rp(Math.abs(n))}</span></div><div class="tx-list">${g.items.map(txRow).join('')}</div>`; }).join('')}
    ${list.length > shown.length ? `<button class="btn secondary block" style="margin-top:16px" data-action="more">Muat lebih banyak (${list.length - shown.length} lagi)</button>` : ''}`;
}

/* ---------- Pengaturan ---------- */
function renderSettings() {
  const el = $('[data-view="settings"]');
  if (!el.classList.contains('active')) return;
  const c = S.cfg || {};
  const host = c.api ? c.api.replace(/^https:\/\//, '').slice(0, 34) + '…' : '';
  el.innerHTML = `${demoBanner()}
    <div class="lg-title">Koneksi</div>
    <div class="list-group">
      <div class="row">${icon('db')}<div class="grow"><b>${c.demo ? 'Mode demo' : esc(S.sheetName || 'Google Sheets')}</b><small>${c.demo ? 'Data contoh di HP ini' : esc(host)}</small></div></div>
      <div class="row">${icon('refresh')}<div class="grow"><b>Status sinkron</b><small>${S.queue.length ? S.queue.length + ' transaksi menunggu dikirim' : S.lastSync ? 'Terakhir ' + new Date(S.lastSync).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Belum pernah'}${S.syncError ? ' · ' + esc(S.syncError) : ''}</small></div></div>
      ${S.skipped ? `<div class="row">${icon('alert')}<div class="grow"><b>${S.skipped} baris dilewati</b><small>Tanggal/nominal tidak terbaca (mis. baris TOTAL)</small></div></div>` : ''}
      <button class="row btn-row" data-action="sync-now">${icon('refresh')}<div class="grow"><b>Sinkronkan sekarang</b></div>${icon('chevron', 18)}</button>
      ${S.queue.length ? `<button class="row btn-row danger" data-action="clear-queue">${icon('trash')}<div class="grow"><b>Buang antrean tertunda</b><small>Gunakan hanya jika antrean macet</small></div></button>` : ''}
      <button class="row btn-row" data-action="connect">${icon('link')}<div class="grow"><b>${c.demo ? 'Hubungkan ke spreadsheet' : 'Ganti URL / kunci akses'}</b></div>${icon('chevron', 18)}</button>
    </div>
    <div class="lg-title">Tampilan</div>
    <div class="list-group"><div class="row">${icon('sun')}<div class="grow"><b>Tema</b></div>
      <div class="seg sm">${[['auto', 'Otomatis'], ['light', 'Terang'], ['dark', 'Gelap']].map(([k, l]) => `<button class="${S.prefs.theme === k ? 'active' : ''}" data-theme-set="${k}">${l}</button>`).join('')}</div></div></div>
    <div class="lg-title">Keamanan</div>
    <div class="list-group">${Pin.enabled() ? `
      <div class="row">${icon('lock')}<div class="grow"><b>Kunci PIN aktif</b><small>Diminta setiap aplikasi dibuka</small></div></div>
      <div class="row wrap">${icon('clock')}<div class="grow"><b>Kunci otomatis</b><small>Setelah aplikasi ditinggal</small></div>
        <div class="seg sm">${[[0, 'Segera'], [60, '1 mnt'], [300, '5 mnt']].map(([s, l]) => `<button class="${Pin.after() === s ? 'active' : ''}" data-pin-after="${s}">${l}</button>`).join('')}</div></div>
      <button class="row btn-row" data-action="pin-lock-now">${icon('lock')}<div class="grow"><b>Kunci sekarang</b></div>${icon('chevron', 18)}</button>
      <button class="row btn-row" data-action="pin-change">${icon('key')}<div class="grow"><b>Ganti PIN</b></div>${icon('chevron', 18)}</button>
      <button class="row btn-row danger" data-action="pin-off">${icon('x')}<div class="grow"><b>Matikan PIN</b></div></button>`
    : `<button class="row btn-row" data-action="pin-on">${icon('lock')}<div class="grow"><b>Aktifkan kunci PIN</b><small>4 angka, diminta setiap membuka aplikasi</small></div>${icon('chevron', 18)}</button>`}
    </div>
    ${['pengeluaran', 'pemasukan'].map(t => `<div class="lg-title">Kategori ${TYPE_LABEL[t].toLowerCase()}</div>
      <div class="list-group"><div class="cat-pills">${S.cats[t].map(x => `<span>${x.icon || '🏷️'} ${esc(x.name)}</span>`).join('')}</div>
      <button class="row btn-row" data-action="new-cat" data-type="${t}">${icon('plus')}<div class="grow"><b>Tambah kategori</b><small>Ubah/hapus kategori lewat sheet "Kategori"</small></div></button></div>`).join('')}
    <div class="lg-title">Lainnya</div>
    <div class="list-group">
      <button class="row btn-row danger" data-action="logout">${icon('logout')}<div class="grow"><b>${c.demo ? 'Keluar dari mode demo' : 'Putuskan koneksi di HP ini'}</b><small>Data di spreadsheet tidak terhapus</small></div></button>
    </div>
    <p class="muted" style="text-align:center;font-size:12px;margin:20px 0">Dompetku v${APP_VERSION}</p>`;
}

/* ==================================================================
   FORM TAMBAH / EDIT
   ================================================================== */
function usageOrder(type) {
  const since = addDays(today(), -90), count = {};
  S.tx.forEach(t => { if (t.type === type && t.date >= since) count[t.category] = (count[t.category] || 0) + 1; });
  return S.cats[type].slice().sort((a, b) => (count[b.name] || 0) - (count[a.name] || 0));
}

function openForm(existing) {
  const isNew = !existing;
  const f = existing ? { ...existing } : { id: genId(), type: S.prefs.lastType || 'pengeluaran', amount: 0, category: '', date: today(), note: '', method: '' };
  if (!f.method) f.method = S.prefs.lastMethod[f.type] || '';
  const notesFor = () => Array.from(new Set(S.tx.filter(t => t.type === f.type && t.note && (!f.category || t.category === f.category)).slice(0, 40).map(t => t.note))).slice(0, 8);

  const sh = openSheet({
    title: isNew ? 'Tambah transaksi' : 'Edit transaksi',
    html: `
      <div class="seg type">${['pengeluaran', 'pemasukan'].map(t => `<button data-type="${t}">${TYPE_LABEL[t]}</button>`).join('')}</div>
      <label class="amount-field" id="f-amt-wrap"><span>Rp</span><input id="f-amount" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="0" aria-label="Nominal"></label>
      <div class="field-err" id="e-amount"></div>
      <div class="form-sec"><div class="f-label">Kategori</div><div class="cat-grid" id="f-cats"></div><div class="field-err" id="e-cat" style="text-align:left"></div></div>
      <div class="form-sec"><div class="f-label">Tanggal</div><div class="chips wrap" id="f-date"></div></div>
      <div class="form-sec"><div class="f-label">Metode</div><div class="chips wrap" id="f-method"></div></div>
      <div class="form-sec"><div class="f-label">Catatan <span class="muted">(opsional)</span></div>
        <input class="input" id="f-note" maxlength="140" placeholder="Contoh: makan siang bareng tim" list="f-notes" autocomplete="off" enterkeyhint="done"><datalist id="f-notes"></datalist></div>`,
    foot: `<button class="btn primary block lg" id="f-save">${isNew ? 'Simpan' : 'Simpan perubahan'}</button>`,
    onMount: s => {
      const root = s.el;
      const amt = $('#f-amount', root);
      const setAmt = n => { f.amount = n; amt.value = n ? nf.format(n) : ''; };
      setAmt(f.amount);
      $('#f-note', root).value = f.note;

      const paintType = () => {
        $$('.seg.type button', root).forEach(b => b.classList.toggle('active', b.dataset.type === f.type));
        $('#f-amt-wrap', root).className = 'amount-field ' + f.type;
      };
      const paintCats = () => {
        const list = usageOrder(f.type);
        $('#f-cats', root).innerHTML = list.map(c => `<button class="cat-tile ${c.name === f.category ? 'active' : ''}" data-cat="${esc(c.name)}"><span class="em">${c.icon || '🏷️'}</span><span>${esc(c.name)}</span></button>`).join('') +
          `<button class="cat-tile add" data-newcat><span class="em">${icon('plus', 22)}</span><span>Baru</span></button>`;
        $('#f-notes', root).innerHTML = notesFor().map(n => `<option value="${esc(n)}">`).join('');
      };
      const paintDate = () => {
        const t = today(), y = addDays(t, -1);
        const custom = f.date !== t && f.date !== y;
        $('#f-date', root).innerHTML = `<button class="chip ${f.date === t ? 'active' : ''}" data-date="${t}">Hari ini</button>
          <button class="chip ${f.date === y ? 'active' : ''}" data-date="${y}">Kemarin</button>
          <label class="chip ${custom ? 'active' : ''}">${icon('calendar', 15)}${custom ? esc(fmtDate(f.date, 'medium')) : 'Pilih tanggal'}<input type="date" id="f-date-input" value="${f.date}" max="${addDays(t, 365)}"></label>`;
        $('#f-date-input', root).addEventListener('change', e => { if (e.target.value) { f.date = e.target.value; paintDate(); } });
      };
      const paintMethod = () => {
        $('#f-method', root).innerHTML = S.cats.metode.map(m => `<button class="chip ${m.name === f.method ? 'active' : ''}" data-method="${esc(m.name)}">${m.icon || '💳'} ${esc(m.name)}</button>`).join('');
      };
      paintType(); paintCats(); paintDate(); paintMethod();

      amt.addEventListener('input', () => {
        const digits = amt.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13);
        setAmt(digits ? Number(digits) : 0);
        $('#e-amount', root).textContent = '';
      });
      root.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.type) { if (f.type !== b.dataset.type) { f.type = b.dataset.type; if (!S.cats[f.type].some(c => c.name === f.category)) f.category = ''; if (isNew) f.method = S.prefs.lastMethod[f.type] || f.method; paintType(); paintCats(); paintMethod(); } }
        else if (b.dataset.cat !== undefined) { f.category = b.dataset.cat; $('#e-cat', root).textContent = ''; paintCats(); }
        else if (b.hasAttribute('data-newcat')) newCategory(f.type, name => { f.category = name; paintCats(); });
        else if (b.dataset.date) { f.date = b.dataset.date; paintDate(); }
        else if (b.dataset.method !== undefined) { f.method = f.method === b.dataset.method ? '' : b.dataset.method; paintMethod(); }
      });
      $('#f-note', root).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#f-save', root).click(); } });

      $('#f-save', root).addEventListener('click', async () => {
        // Validasi
        let ok = true;
        if (!f.amount || f.amount <= 0) { $('#e-amount', root).textContent = 'Nominal wajib diisi dan harus lebih dari 0'; shake($('#f-amt-wrap', root)); ok = false; }
        if (!f.category) { $('#e-cat', root).textContent = 'Pilih kategori dulu'; shake($('#f-cats', root)); ok = false; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) { toast('error', 'Tanggal tidak valid'); ok = false; }
        if (!ok) { if (!f.amount) amt.focus(); return; }
        f.note = $('#f-note', root).value.trim();
        S.prefs.lastType = f.type; S.prefs.lastMethod[f.type] = f.method; savePrefs();

        const tx = { id: f.id, type: f.type, amount: f.amount, category: f.category, date: f.date, note: f.note, method: f.method };
        await s.close();
        const t = toast('loading', isNew ? 'Menyimpan ke spreadsheet…' : 'Menyimpan perubahan…');
        try {
          await saveTx(tx, isNew);
          t.update('success', S.cfg?.demo ? 'Tersimpan (mode demo)' : (isNew ? 'Tersimpan ke spreadsheet' : 'Perubahan tersimpan'));
        } catch (err) {
          if (err.kept) t.update('warn', err.offline ? 'Offline — tersimpan di HP, akan dikirim otomatis' : 'Belum terkirim: ' + err.message + ' (akan dicoba lagi)', 4200);
          else t.update('error', 'Gagal menyimpan: ' + err.message, 5000);
        }
      });
      if (isNew) setTimeout(() => amt.focus(), 60);
    }
  });
  if (isNew) amt_focus_now(sh);
}
/** iOS hanya membuka keyboard jika fokus terjadi langsung dari ketukan pengguna. */
function amt_focus_now(sh) { try { $('#f-amount', sh.el).focus({ preventScroll: true }); } catch (e) { } }
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

function newCategory(type, done) {
  const EMO = type === 'pemasukan' ? ['💰', '💼', '🏪', '📈', '🎁', '🪙', '🏦', '🤝'] : type === 'metode' ? ['💳', '🏦', '📲', '💵'] : ['🍜', '☕', '🛒', '🚗', '⛽', '🏠', '💡', '💊', '🎬', '🎮', '🛍️', '✈️', '🐾', '👶', '🎓', '🏋️', '💅', '🧾'];
  let emoji = EMO[0];
  openSheet({
    title: 'Kategori baru',
    html: `<div class="field"><label>Nama kategori</label><input class="input" id="nc-name" maxlength="30" placeholder="Contoh: Kopi" autocomplete="off" enterkeyhint="done"></div>
      <div class="field"><label>Ikon</label><div class="chips wrap" id="nc-emo">${EMO.map((e, i) => `<button class="chip ${i ? '' : 'active'}" data-emo="${e}" style="font-size:18px">${e}</button>`).join('')}</div></div>
      <div class="field-err" id="nc-err" style="text-align:left"></div>`,
    foot: `<button class="btn primary block lg" id="nc-save">Tambah</button>`,
    onMount: s => {
      const name = $('#nc-name', s.el);
      setTimeout(() => name.focus(), 50);
      $('#nc-emo', s.el).addEventListener('click', e => { const b = e.target.closest('[data-emo]'); if (!b) return; emoji = b.dataset.emo; $$('[data-emo]', s.el).forEach(x => x.classList.toggle('active', x === b)); });
      name.addEventListener('keydown', e => { if (e.key === 'Enter') $('#nc-save', s.el).click(); });
      $('#nc-save', s.el).addEventListener('click', async () => {
        const n = name.value.trim();
        if (!n) { $('#nc-err', s.el).textContent = 'Nama kategori wajib diisi'; return; }
        if (S.cats[type].some(c => c.name.toLowerCase() === n.toLowerCase())) { $('#nc-err', s.el).textContent = 'Kategori ini sudah ada'; return; }
        S.cats[type].push({ name: n, icon: emoji }); saveCache();
        await s.close();
        done && done(n);
        if (S.view === 'settings') renderSettings();
        enqueue('addCategory', { type, name: n, icon: emoji })
          .then(() => toast('success', `Kategori "${n}" ditambahkan`))
          .catch(err => toast(err.kept ? 'warn' : 'error', err.kept ? 'Kategori akan disimpan ke sheet saat online' : 'Gagal menambah kategori: ' + err.message));
      });
    }
  });
}

/* ---------- Detail transaksi ---------- */
function openDetail(id) {
  const t = S.tx.find(x => x.id === id); if (!t) return;
  openSheet({
    title: 'Detail transaksi',
    html: `<div class="detail-amt"><div class="em">${catIcon(t.type, t.category)}</div>
        <div class="v amt ${t.type === 'pemasukan' ? 'good' : ''}">${t.type === 'pemasukan' ? '+' : '−'}${rp(t.amount)}</div><div class="t">${TYPE_LABEL[t.type]}</div></div>
      <div class="kv">
        <div><span>Kategori</span><b>${esc(t.category || 'Tanpa kategori')}</b></div>
        <div><span>Tanggal</span><b>${esc(fmtDate(t.date))}</b></div>
        ${t.method ? `<div><span>Metode</span><b>${methodIcon(t.method)} ${esc(t.method)}</b></div>` : ''}
        ${t.note ? `<div><span>Catatan</span><b>${esc(t.note)}</b></div>` : ''}
        <div><span>Status</span><b>${t.pending ? '<span class="pending">Menunggu sinkron</span>' : S.cfg?.demo ? 'Data contoh (demo)' : 'Tersimpan di spreadsheet'}</b></div>
      </div>`,
    foot: `<div class="actions-2"><button class="btn secondary" data-del>${icon('trash', 18)}Hapus</button><button class="btn primary" data-edit>${icon('edit', 18)}Edit</button></div>`,
    onMount: s => {
      $('[data-edit]', s.el).addEventListener('click', async () => { await s.close(); openForm(t); });
      $('[data-del]', s.el).addEventListener('click', async () => {
        await s.close();
        const yes = await confirmDialog({ title: 'Hapus transaksi?', message: `${t.category} · ${rp(t.amount)} pada ${fmtDate(t.date, 'medium')}. Baris akan dipindah ke sheet "Arsip" sehingga masih bisa dipulihkan.` });
        if (!yes) return;
        const tt = toast('loading', 'Menghapus…');
        try { await removeTx(t); tt.update('success', 'Transaksi dihapus & diarsipkan'); }
        catch (err) {
          if (err.kept) tt.update('warn', 'Akan dihapus dari spreadsheet saat online', 4000);
          else tt.update('error', 'Gagal menghapus: ' + err.message, 5000);
        }
      });
    }
  });
}

/* ---------- Periode custom ---------- */
function openCustomPeriod() {
  const p = S.prefs.period;
  const r = periodRange();
  openSheet({
    title: 'Pilih periode',
    html: `<div class="field"><label>Dari tanggal</label><input class="input" type="date" id="cp-from" value="${p.from || r.from}"></div>
      <div class="field"><label>Sampai tanggal</label><input class="input" type="date" id="cp-to" value="${p.to || r.to}"></div><div class="field-err" id="cp-err" style="text-align:left"></div>`,
    foot: `<button class="btn primary block lg" id="cp-ok">Terapkan</button>`,
    onMount: s => $('#cp-ok', s.el).addEventListener('click', async () => {
      const from = $('#cp-from', s.el).value, to = $('#cp-to', s.el).value;
      if (!from || !to) { $('#cp-err', s.el).textContent = 'Isi kedua tanggal'; return; }
      if (from > to) { $('#cp-err', s.el).textContent = 'Tanggal awal harus sebelum tanggal akhir'; return; }
      S.prefs.period = { key: 'custom', from, to }; savePrefs();
      await s.close(); render();
    })
  });
}

/* ==================================================================
   KUNCI PIN (melindungi aplikasi dari orang lain yang memegang HP)
   PIN tidak disimpan apa adanya, hanya hash SHA-256 + salt acak.
   ================================================================== */
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const Pin = {
  cfg() { return ls.get(K.pin); },
  enabled() { const c = ls.get(K.pin); return !!(c && c.hash); },
  after() { const c = ls.get(K.pin); return c && typeof c.after === 'number' ? c.after : 60; },
  async hash(pin, salt) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin))); },
  async set(pin) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    ls.set(K.pin, { salt, hash: await this.hash(pin, salt), after: this.after() });
    ls.del(K.pinFail);
  },
  async check(pin) { const c = this.cfg(); return !!(c && c.hash) && (await this.hash(pin, c.salt)) === c.hash; },
  remove() { ls.del(K.pin); ls.del(K.pinFail); },
  setAfter(sec) { const c = this.cfg(); if (c) { c.after = sec; ls.set(K.pin, c); } },
  weak(pin) { return /^(\d)\1{3}$/.test(pin) || ['1234', '4321', '0123', '3210', '6789', '9876', '1212', '1122'].includes(pin); }
};

/** Cek PIN dengan jeda bertahap setelah 5x salah (30 dtk, 1 mnt, 2 mnt … maks 15 mnt). */
async function attemptPin(pin) {
  const f = ls.get(K.pinFail, { n: 0, until: 0 });
  const wait = Math.ceil((f.until - Date.now()) / 1000);
  if (wait > 0) return `Terlalu banyak percobaan. Coba lagi dalam ${wait} detik.`;
  if (await Pin.check(pin)) { ls.del(K.pinFail); return true; }
  f.n += 1;
  if (f.n % 5 === 0) {
    f.until = Date.now() + Math.min(30000 * Math.pow(2, f.n / 5 - 1), 900000);
    ls.set(K.pinFail, f);
    return `PIN salah ${f.n} kali. Tunggu ${Math.round((f.until - Date.now()) / 1000)} detik.`;
  }
  ls.set(K.pinFail, f);
  return `PIN salah. ${5 - (f.n % 5)} percobaan lagi sebelum dijeda.`;
}

/**
 * Layar PIN layar penuh dengan keypad.
 * onPin(pin) → true (selesai) | 'pesan error' | {title, sub, msg?} (lanjut ke langkah berikutnya)
 * Tombol kiri: onLeft() → nilai untuk menutup, atau undefined untuk tetap di layar. Tanpa onLeft = Batal (null).
 */
function pinScreen({ title, sub = '', left = '', onPin, onLeft }) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'lock';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="lock-in">
      <div class="logo sm">${icon('lock', 24)}</div>
      <h2 class="lk-title"></h2><p class="lk-sub"></p>
      <div class="pin-dots">${'<i></i>'.repeat(4)}</div>
      <div class="pin-msg" aria-live="assertive"></div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
        <button class="kp-text" data-k="left">${esc(left)}</button><button data-k="0">0</button>
        <button class="kp-text" data-k="del" aria-label="Hapus angka">${icon('backspace', 26)}</button></div></div>`;
    document.body.appendChild(el);
    const dots = $('.pin-dots', el), msg = $('.pin-msg', el);
    const head = (t, s) => { $('.lk-title', el).textContent = t; $('.lk-sub', el).textContent = s || ''; };
    head(title, sub);
    let val = '', busy = false;
    const paint = () => $$('i', dots).forEach((d, i) => d.classList.toggle('on', i < val.length));
    const fail = text => { msg.textContent = text; dots.classList.add('err'); shake(dots); try { navigator.vibrate && navigator.vibrate([30, 40, 30]); } catch (e) { } };
    const close = v => { document.removeEventListener('keydown', onKey); el.classList.add('out'); setTimeout(() => el.remove(), 220); resolve(v); };
    const press = async k => {
      if (busy) return;
      if (k === 'left') {
        if (!left) return;
        if (!onLeft) return close(null);
        busy = true; const r = await onLeft(); busy = false;
        if (r !== undefined) close(r);
        return;
      }
      if (k === 'del') { val = val.slice(0, -1); paint(); return; }
      if (val.length >= 4) return;
      val += k; msg.textContent = ''; dots.classList.remove('err', 'ok'); paint();
      if (val.length < 4) return;
      busy = true;
      const r = await onPin(val);
      if (r === true) { dots.classList.add('ok'); setTimeout(() => close(val), 160); return; }
      if (r && typeof r === 'object') { head(r.title, r.sub); if (r.msg) fail(r.msg); }
      else fail(r || 'PIN salah');
      setTimeout(() => { val = ''; paint(); busy = false; }, 350);
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
    const onKey = e => {
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') press('del');
    };
    document.addEventListener('keydown', onKey);
  });
}

let lockPromise = null;
/** Mengunci aplikasi (jika PIN aktif). Selesai saat PIN benar dimasukkan. */
function lockApp() {
  if (!Pin.enabled()) { document.documentElement.classList.remove('locked'); return Promise.resolve(); }
  if (lockPromise) return lockPromise;
  document.documentElement.classList.add('locked');
  lockPromise = pinScreen({
    title: 'Masukkan PIN', sub: 'Dompetku terkunci', left: 'Lupa PIN?',
    onLeft: async () => ((await forgotPin()) ? 'reset' : undefined),
    onPin: attemptPin
  }).then(() => {
    document.documentElement.classList.remove('locked'); lockPromise = null;
    if (S.view === 'settings') renderSettings();   // status PIN bisa berubah (mis. setelah reset)
  });
  return lockPromise;
}

/** Reset PIN dengan membuktikan pemilik: masukkan Kunci Akses spreadsheet. */
function forgotPin() {
  return new Promise(resolve => {
    const demo = !!S.cfg?.demo || !S.cfg?.key;
    const el = document.createElement('div');
    el.className = 'lock top';
    el.innerHTML = `<div class="lock-in form">
      <div class="logo sm">${icon('key', 24)}</div>
      <h2>Reset PIN</h2>
      <p>${demo ? 'Mode demo: PIN akan dihapus.' : 'Masukkan Kunci Akses dari spreadsheet (menu 💰 Dompetku → Lihat kunci akses) untuk membuktikan ini kamu.'}</p>
      ${demo ? '' : '<input class="input" id="fp-key" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false">'}
      <div class="pin-msg" id="fp-msg"></div>
      <button class="btn primary block lg" id="fp-ok">Reset PIN</button>
      <button class="btn ghost block" id="fp-back">Kembali</button></div>`;
    document.body.appendChild(el);
    const close = v => { el.remove(); resolve(v); };
    $('#fp-back', el).addEventListener('click', () => close(false));
    $('#fp-ok', el).addEventListener('click', () => {
      if (!demo) {
        const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const given = norm($('#fp-key', el).value);
        if (!given || given !== norm(S.cfg.key)) { $('#fp-msg', el).textContent = 'Kunci akses tidak cocok.'; shake($('#fp-key', el)); return; }
      }
      Pin.remove();
      close(true);
      toast('success', 'PIN dihapus. Buat PIN baru di Pengaturan → Keamanan.', 4000);
    });
  });
}

async function setupPin() {
  let first = null;
  const intro = { title: 'Buat PIN', sub: 'Pilih 4 angka yang mudah kamu ingat' };
  const ok = await pinScreen({
    ...intro, left: 'Batal',
    onPin: async pin => {
      if (!first) {
        if (Pin.weak(pin)) return 'PIN terlalu mudah ditebak. Pilih kombinasi lain.';
        first = pin;
        return { title: 'Ulangi PIN', sub: 'Masukkan PIN yang sama sekali lagi' };
      }
      if (pin !== first) { first = null; return { ...intro, msg: 'PIN tidak sama. Ulangi dari awal.' }; }
      await Pin.set(pin);
      return true;
    }
  });
  if (ok) toast('success', 'Kunci PIN aktif');
  renderSettings();
}
async function verifyPin(sub) {
  return !!(await pinScreen({ title: 'Masukkan PIN saat ini', sub, left: 'Batal', onPin: attemptPin }));
}

/* ==================================================================
   SETUP / KONEKSI
   ================================================================== */
function showSetup() {
  const root = $('#setup-root');
  const c = S.cfg && !S.cfg.demo ? S.cfg : {};
  root.innerHTML = `<div class="setup"><div class="setup-in">
    <div class="logo">${icon('wallet', 30)}</div>
    <h1>Hubungkan ke Google Sheets</h1>
    <p class="lead">Tempel URL Web App dan Kunci Akses dari Apps Script spreadsheet-mu. Cukup sekali di HP ini.</p>
    <div class="field"><label for="su-url">URL Web App</label><input class="input" id="su-url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(c.api || '')}" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
    <div class="field"><label for="su-key">Kunci Akses</label><input class="input" id="su-key" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" value="${esc(c.key || '')}" autocomplete="off" autocapitalize="characters" spellcheck="false">
      <div class="hint">Lihat di spreadsheet: menu 💰 Dompetku → Lihat kunci akses.</div></div>
    <div class="err" id="su-err"></div>
    <button class="btn primary block lg" id="su-go">Hubungkan</button>
    ${S.cfg ? '<button class="btn ghost block" id="su-cancel" style="margin-top:8px">Batal</button>' : `<div class="divider">atau</div><button class="btn secondary block" id="su-demo">Coba dulu dengan data contoh</button>`}
  </div></div>`;
  const go = $('#su-go');
  go.addEventListener('click', async () => {
    const url = $('#su-url').value.trim(), key = $('#su-key').value.trim();
    const err = $('#su-err'); err.textContent = '';
    if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url)) { err.textContent = 'URL harus diawali https://script.google.com/macros/s/… dan diakhiri /exec'; return; }
    if (!/\/exec(\?.*)?$/.test(url)) { err.textContent = 'Gunakan URL yang berakhiran /exec (bukan /dev).'; return; }
    if (key.replace(/[^A-Za-z0-9]/g, '').length < 16) { err.textContent = 'Kunci akses belum lengkap.'; return; }
    go.disabled = true; go.innerHTML = '<span class="spinner"></span>Menghubungkan…';
    try {
      const info = await apiRaw(url, key, 'ping');
      const wasDemo = S.cfg?.demo;
      S.cfg = { api: url, key }; ls.set(K.cfg, S.cfg);
      if (wasDemo) { ls.del(K.cache); ls.del(K.demo); S.queue = []; saveQueue(); S.tx = []; S.loaded = false; }
      root.innerHTML = '';
      toast('success', 'Terhubung ke "' + (info.spreadsheet || 'spreadsheet') + '"');
      render(); refresh();
    } catch (e) {
      err.textContent = e.code === 'AUTH' ? 'Kunci akses salah. Salin ulang dari menu 💰 Dompetku → Lihat kunci akses.'
        : e.code === 'SETUP' ? e.message
        : e.offline ? 'Tidak bisa terhubung. Pastikan internet aktif, URL benar, dan akses Web App diatur ke "Siapa saja".'
        : e.message;
      go.disabled = false; go.textContent = 'Hubungkan';
    }
  });
  $('#su-demo')?.addEventListener('click', () => {
    S.cfg = { demo: true }; ls.set(K.cfg, S.cfg);
    root.innerHTML = ''; S.loaded = false; render(); refresh();
  });
  $('#su-cancel')?.addEventListener('click', () => { root.innerHTML = ''; });
}

/* ==================================================================
   TEMA
   ================================================================== */
const mql = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = S.prefs.theme === 'auto' ? (mql.matches ? 'dark' : 'light') : S.prefs.theme;
  document.documentElement.dataset.theme = t;
  $('meta[name="theme-color"]').setAttribute('content', t === 'dark' ? '#000000' : '#ffffff');
}
mql.addEventListener?.('change', () => { if (S.prefs.theme === 'auto') { applyTheme(); if (S.view === 'stats') renderStats(); } });

/* ==================================================================
   EVENT GLOBAL
   ================================================================== */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-nav],[data-action],[data-tx],[data-period],[data-trend],[data-htype],[data-theme-set],[data-pin-after]');
  if (!el || el.closest('.sheet-wrap')) return;
  const d = el.dataset;
  if (d.nav) return navigate(d.nav);
  if (d.tx) return openDetail(d.tx);
  if (d.period) {
    if (d.period === 'custom') return openCustomPeriod();
    S.prefs.period = { key: d.period }; savePrefs(); return render();
  }
  if (d.trend) { S.prefs.trend = d.trend; savePrefs(); return renderStats(); }
  if (d.htype) { S.hist.type = d.htype; S.hist.limit = 60; if (S.hist.cat && !S.hist.cat.startsWith(d.htype) && d.htype !== 'all') S.hist.cat = ''; return renderHistory(); }
  if (d.themeSet) { S.prefs.theme = d.themeSet; savePrefs(); applyTheme(); return renderSettings(); }
  if (d.pinAfter !== undefined) { Pin.setAfter(Number(d.pinAfter)); return renderSettings(); }
  switch (d.action) {
    case 'add': return openForm();
    case 'refresh': case 'sync-now': return refresh();
    case 'more': S.hist.limit += 100; return renderHistoryList();
    case 'toggle-filter': S.hist.open = !S.hist.open; return renderHistory();
    case 'reset-filter': Object.assign(S.hist, { cat: '', from: '', to: '' }); return renderHistory();
    case 'connect': return showSetup();
    case 'new-cat': return newCategory(d.type);
    case 'pin-on': return setupPin();
    case 'pin-change': if (await verifyPin('Untuk mengganti PIN')) await setupPin(); return;
    case 'pin-off':
      if (await verifyPin('Untuk mematikan kunci PIN')) { Pin.remove(); toast('success', 'Kunci PIN dimatikan'); renderSettings(); }
      return;
    case 'pin-lock-now': return lockApp();
    case 'clear-queue':
      if (await confirmDialog({ title: 'Buang antrean?', message: `${S.queue.length} perubahan yang belum terkirim akan dibuang dan tidak masuk ke spreadsheet.`, ok: 'Buang' })) {
        S.queue = []; saveQueue(); refresh();
      }
      return;
    case 'logout':
      if (await confirmDialog({ title: S.cfg?.demo ? 'Keluar dari mode demo?' : 'Putuskan koneksi?', message: 'Data di HP ini akan dibersihkan. Data di spreadsheet tetap aman.', ok: 'Lanjutkan' })) {
        [K.cfg, K.cache, K.queue, K.demo, K.pin, K.pinFail].forEach(ls.del);
        S.cfg = null; S.tx = []; S.queue = []; S.loaded = false; S.lastSync = null;
        showSetup(); render();
      }
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'h-q') { S.hist.q = e.target.value; S.hist.limit = 60; renderHistoryList(); }
});
document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'h-cat') { S.hist.cat = e.target.value; renderHistory(); }
  if (id === 'h-from' || id === 'h-to') { S.hist[id === 'h-from' ? 'from' : 'to'] = e.target.value; renderHistory(); }
});

window.addEventListener('online', () => { if (S.queue.length) flush().then(() => refresh({ silent: true })); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    S.hiddenAt = Date.now();
    if (Pin.enabled() && Pin.after() === 0) lockApp();   // "Segera": kunci sebelum masuk daftar aplikasi terbuka
    return;
  }
  if (Pin.enabled() && S.hiddenAt && Date.now() - S.hiddenAt >= Pin.after() * 1000) lockApp();
  if (!S.cfg) return;
  const stale = !S.lastSync || Date.now() - new Date(S.lastSync).getTime() > 60e3;
  if (S.queue.length || stale) refresh({ silent: true });
});
setInterval(() => { if (S.queue.length && navigator.onLine && !S.syncing) flush(); }, 45e3);

/* ==================================================================
   MULAI
   ================================================================== */
function init() {
  $$('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon, el.dataset.icon === 'plus' ? 26 : 22); });
  applyTheme();
  const unlocked = lockApp();   // PIN diminta setiap aplikasi dibuka
  if (!S.cfg) { render(); showSetup(); }
  else {
    loadCache();
    render();
    refresh({ silent: true });
  }
  // Pintasan dari ikon aplikasi: ?add=1 langsung membuka form
  if (new URLSearchParams(location.search).get('add') === '1' && S.cfg) { history.replaceState(null, '', location.pathname); unlocked.then(() => setTimeout(() => openForm(), 250)); }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
}
// Grafik dimuat terpisah; render ulang statistik setelah siap
window.onChartReady = () => { if (S.view === 'stats') renderStats(); };
init();
