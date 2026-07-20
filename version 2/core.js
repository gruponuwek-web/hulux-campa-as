// ════════════════════════════════════════════
// ESTADO
// ════════════════════════════════════════════
const MUNICIPIOS = [
  'Ajacuba','Santiago de Anaya','Tetepango','San Salvador',
  'Progreso de Obregón','Mixquiahuala','Francisco I. Madero',
  'Atitalaquia','El Arenal','Actopan','Huichapan'
];

let state = {
  campanas: [],
  reportes: {},
  leads: [],       // pipeline
  catalogos: {
    agentes:     [],  // [{ id, nombre }]
    sucursales:  [],  // [{ id, nombre }]
    paquetes:    [],  // [{ id, nombre, precio }]
    promociones: [],  // [{ id, nombre }]
  }
};

let canalSeleccionado = 'Meta Ads';
let tipoSeleccionado = 'Captación';
let campanaEditandoId = null;
let campanaEliminarId = null;

let reporteCampanaId = null;
let reporteSemanaIdx = null;

let dashMesSeleccionado = null;

// Pipeline
let leadEditandoId = null;
let estadoLeadSeleccionado = 'negociacion';
let catalogoEditando = null; // { tipo, idx }

// ════════════════════════════════════════════
// GOOGLE SHEETS — CONEXIÓN
// ════════════════════════════════════════════
const GS_URL = "https://script.google.com/macros/s/AKfycbyGTonUjT09szLlEfyue4EmNpeMkff9FXJN5_xTdjPKcOpQg4kFviSSnA-AZsZI2J5iHg/exec";

let gsOnline = false; // se activa si getAll responde OK

async function gs(action, data) {
  try {
    const res = await fetch(GS_URL, {
      method: 'POST',
      body: new URLSearchParams({ action, data: JSON.stringify(data || {}) })
    });
    return await res.json();
  } catch (e) {
    console.warn('GS error:', e);
    return { ok: false, error: e.toString() };
  }
}

// ════════════════════════════════════════════
// PERSISTENCIA (Sheets + localStorage backup)
// ════════════════════════════════════════════
function guardarStateLocal() {
  localStorage.setItem('hulux_campanas_v2', JSON.stringify(state));
}
function cargarStateLocal() {
  const s = localStorage.getItem('hulux_campanas_v2');
  if (s) {
    const parsed = JSON.parse(s);
    state.campanas   = parsed.campanas   || [];
    state.reportes   = parsed.reportes   || {};
    state.leads      = parsed.leads      || [];
    state.catalogos  = parsed.catalogos  || {};
  }
  // Siempre garantizar estructura completa de catálogos
  if (!state.catalogos)              state.catalogos  = {};
  if (!state.catalogos.agentes)      state.catalogos.agentes     = [];
  if (!state.catalogos.sucursales)   state.catalogos.sucursales  = [];
  if (!state.catalogos.paquetes)     state.catalogos.paquetes    = [];
  if (!state.catalogos.promociones)  state.catalogos.promociones = [];
}

async function cargarState() {
  mostrarSyncStatus('cargando');
  const res = await gs('getAll');
  if (res && res.ok) {
    gsOnline = true;
    state.campanas  = res.campanas  || [];
    state.reportes  = res.reportes  || {};
    state.leads     = res.leads     || [];
    state.catalogos = res.catalogos || { agentes:[], sucursales:[], paquetes:[], promociones:[] };
    guardarStateLocal();
    mostrarSyncStatus('ok');
  } else {
    gsOnline = false;
    cargarStateLocal();
    mostrarSyncStatus('offline');
  }
}

async function guardarState() {
  guardarStateLocal(); // siempre local primero
  // Sync remoto se hace puntualmente en cada acción
}

// ── Indicador de sincronización ──────────────
function mostrarSyncStatus(estado) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const map = {
    cargando: { icon: '⏳', texto: 'Conectando...', color: '#F59E0B' },
    ok:       { icon: '☁️',  texto: 'Sincronizado', color: '#22C55E' },
    offline:  { icon: '📴',  texto: 'Sin conexión (modo local)', color: '#EF4444' },
    guardando:{ icon: '💾',  texto: 'Guardando...', color: '#F59E0B' },
    error:    { icon: '⚠️',  texto: 'Error al guardar', color: '#EF4444' },
  };
  const s = map[estado] || map.ok;
  el.innerHTML = `<span style="color:${s.color};font-size:12px;font-weight:600;">${s.icon} ${s.texto}</span>`;
}

// ════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-MX');
}
function fmtMXN(n) {
  if (n === null || n === undefined || isNaN(n) || n === 0) return '—';
  return '$' + Number(n).toLocaleString('es-MX', {minimumFractionDigits:0, maximumFractionDigits:0});
}
function pct(a, b) {
  if (!b || b === 0) return 0;
  return Math.round((a / b) * 100);
}
function semanaLabel(d) {
  // d = Date
  const options = { day: '2-digit', month: 'short' };
  const fin = new Date(d);
  fin.setDate(fin.getDate() + 6);
  return `Sem ${d.toLocaleDateString('es-MX', options)} – ${fin.toLocaleDateString('es-MX', options)}`;
}
function getSemanas(campana) {
  // Genera semanas numeradas desde la fecha de inicio exacta de la campaña
  const semanas = [];
  const inicio = new Date(campana.inicio + 'T00:00:00');
  const fin = campana.fin ? new Date(campana.fin + 'T00:00:00') : new Date();
  let cur = new Date(inicio);
  let i = 0;
  while (cur <= fin && i < 52) {
    const finSem = new Date(cur);
    finSem.setDate(finSem.getDate() + 6);
    const label = `Semana ${i + 1}  (${cur.toLocaleDateString('es-MX',{day:'2-digit',month:'short'})} – ${finSem.toLocaleDateString('es-MX',{day:'2-digit',month:'short'})})`;
    semanas.push({ idx: i, label, fecha: cur.toISOString().slice(0,10) });
    cur.setDate(cur.getDate() + 7);
    i++;
  }
  if (semanas.length === 0) {
    semanas.push({ idx: 0, label: 'Semana 1', fecha: campana.inicio });
  }
  return semanas;
}

// ════════════════════════════════════════════
// NAVEGACIÓN
// ════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('screen-' + id).classList.add('active');
  var tabs = document.querySelectorAll('.nav-tab');
  var map = { campanas: 0, pipeline: 1, reporte: 2, dashboard: 3, ajustes: 4 };
  if (map[id] !== undefined) tabs[map[id]].classList.add('active');
  if (id === 'reporte')   renderReporte();
  if (id === 'dashboard') renderDashboard();
  if (id === 'campanas')  renderCampanas();
  if (id === 'pipeline')  renderPipeline();
  if (id === 'ajustes')   renderAjustes();
}