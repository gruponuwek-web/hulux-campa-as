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
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  const tabs = document.querySelectorAll('.nav-tab');
  const map = { campanas: 0, pipeline: 1, reporte: 2, dashboard: 3, config: 4 };
  if (map[id] !== undefined) tabs[map[id]].classList.add('active');
  if (id === 'reporte')   renderReporte();
  if (id === 'dashboard') renderDashboard();
  if (id === 'campanas')  renderCampanas();
  if (id === 'pipeline')  renderPipeline();
  if (id === 'config')    renderConfig();
}

// ════════════════════════════════════════════
// PANTALLA 1: CAMPAÑAS
// ════════════════════════════════════════════
function renderCampanas() {
  const list = document.getElementById('campana-list');
  const empty = document.getElementById('empty-campanas');
  list.innerHTML = '';
  if (state.campanas.length === 0) {
    empty.style.display = '';
    list.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  list.style.display = '';
  state.campanas.forEach(c => {
    const reps = state.reportes[c.id] || [];
    const div = document.createElement('div');
    div.className = 'campana-card';
    const iconCanal = c.canal === 'Meta Ads' ? '📘' : '🎵';
    const claseCanal = c.canal === 'Meta Ads' ? 'meta' : 'tiktok';
    const badgeTipo = c.tipo === 'Captación'
      ? '<span class="badge badge-captacion">Captación</span>'
      : '<span class="badge badge-reconocimiento">Reconocimiento</span>';
    const badgeCanal = c.canal === 'Meta Ads'
      ? '<span class="badge badge-meta">Meta Ads</span>'
      : '<span class="badge badge-tiktok">TikTok</span>';
    div.innerHTML = `
      <div class="campana-icon ${claseCanal}">${iconCanal}</div>
      <div class="campana-info">
        <div class="campana-nombre">${c.nombre}</div>
        <div class="campana-meta">
          ${badgeCanal}
          ${badgeTipo}
          <span class="campana-meta-sep">·</span>
          <span>${c.inicio} → ${c.fin || 'Abierta'}</span>
          <span class="campana-meta-sep">·</span>
          <span>${reps.length} reporte${reps.length !== 1 ? 's' : ''}</span>
          <span class="campana-meta-sep">·</span>
          <span>Presupuesto: ${fmtMXN(c.presupuesto)}</span>
        </div>
      </div>
      <div class="campana-actions">
        <button class="btn btn-ghost" style="padding:7px 12px;font-size:12px;" onclick="editarCampana('${c.id}')">Editar</button>
        <button class="btn btn-danger" style="padding:7px 12px;font-size:12px;" onclick="pedirEliminar('${c.id}')">Eliminar</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function abrirModalCampana(id) {
  campanaEditandoId = id || null;
  canalSeleccionado = 'Meta Ads';
  tipoSeleccionado = 'Captación';

  if (id) {
    const c = state.campanas.find(x => x.id === id);
    document.getElementById('modal-campana-title').textContent = 'Editar campaña';
    document.getElementById('c-nombre').value = c.nombre;
    document.getElementById('c-presupuesto').value = c.presupuesto;
    document.getElementById('c-meta').value = c.meta || '';
    document.getElementById('c-inicio').value = c.inicio;
    document.getElementById('c-fin').value = c.fin || '';
    selectCanal(c.canal, true);
    selectTipo(c.tipo, true);
    document.querySelector('#modal-campana .btn-primary').textContent = 'Guardar cambios';
  } else {
    document.getElementById('modal-campana-title').textContent = 'Nueva campaña';
    document.getElementById('c-nombre').value = '';
    document.getElementById('c-presupuesto').value = '';
    document.getElementById('c-meta').value = '';
    document.getElementById('c-inicio').value = '';
    document.getElementById('c-fin').value = '';
    selectCanal('Meta Ads', true);
    selectTipo('Captación', true);
    document.querySelector('#modal-campana .btn-primary').textContent = 'Crear campaña';
  }
  abrirModal('modal-campana');
}

function editarCampana(id) { abrirModalCampana(id); }

function selectCanal(canal, silent) {
  canalSeleccionado = canal;
  document.getElementById('canal-meta').classList.toggle('selected', canal === 'Meta Ads');
  document.getElementById('canal-tiktok').classList.toggle('selected', canal === 'TikTok');
}
function selectTipo(tipo, silent) {
  tipoSeleccionado = tipo;
  document.getElementById('tipo-captacion').classList.toggle('selected', tipo === 'Captación');
  document.getElementById('tipo-reconocimiento').classList.toggle('selected', tipo === 'Reconocimiento');
  document.getElementById('meta-label').textContent = tipo === 'Captación' ? 'Meta de leads' : 'Meta de alcance (personas)';
}

async function guardarCampana() {
  const nombre = document.getElementById('c-nombre').value.trim();
  const presupuesto = parseFloat(document.getElementById('c-presupuesto').value) || 0;
  const meta = parseFloat(document.getElementById('c-meta').value) || 0;
  const inicio = document.getElementById('c-inicio').value;
  const fin = document.getElementById('c-fin').value;

  if (!nombre) { alert('Escribe el nombre de la campaña.'); return; }
  if (!inicio) { alert('Selecciona la fecha de inicio.'); return; }

  let campana;
  if (campanaEditandoId) {
    campana = state.campanas.find(x => x.id === campanaEditandoId);
    campana.nombre = nombre; campana.canal = canalSeleccionado; campana.tipo = tipoSeleccionado;
    campana.presupuesto = presupuesto; campana.meta = meta; campana.inicio = inicio; campana.fin = fin;
  } else {
    campana = { id: uid(), nombre, canal: canalSeleccionado, tipo: tipoSeleccionado, presupuesto, meta, inicio, fin };
    state.campanas.push(campana);
  }

  guardarStateLocal();
  cerrarModal('modal-campana');
  renderCampanas();

  // Sync remoto
  if (gsOnline) {
    mostrarSyncStatus('guardando');
    const res = await gs('saveCampana', { ...campana });
    mostrarSyncStatus(res && res.ok ? 'ok' : 'error');
  }
}

function pedirEliminar(id) {
  campanaEliminarId = id;
  abrirModal('modal-eliminar');
}
async function confirmarEliminar() {
  const id = campanaEliminarId;
  state.campanas = state.campanas.filter(c => c.id !== id);
  delete state.reportes[id];
  guardarStateLocal();
  cerrarModal('modal-eliminar');
  renderCampanas();

  if (gsOnline) {
    mostrarSyncStatus('guardando');
    const res = await gs('deleteCampana', { id });
    mostrarSyncStatus(res && res.ok ? 'ok' : 'error');
  }
}

// ════════════════════════════════════════════
// PANTALLA 2: REPORTE SEMANAL
// ════════════════════════════════════════════
function renderReporte() {
  const btns = document.getElementById('reporte-campana-btns');
  btns.innerHTML = '';
  const sinCamp = document.getElementById('reporte-sin-campanas');
  const formWrap = document.getElementById('reporte-form-wrap');

  if (state.campanas.length === 0) {
    sinCamp.style.display = '';
    formWrap.style.display = 'none';
    return;
  }
  sinCamp.style.display = 'none';
  formWrap.style.display = '';

  state.campanas.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'dash-camp-btn' + (reporteCampanaId === c.id ? ' active' : '');
    btn.textContent = c.nombre;
    btn.onclick = () => {
      if (reporteCampanaId === c.id) {
        // Toggle: deseleccionar
        reporteCampanaId = null;
        document.querySelectorAll('#reporte-campana-btns .dash-camp-btn').forEach(b => b.classList.remove('active'));
        mostrarFormReporte(null);
        document.getElementById('reporte-semana').innerHTML = '';
      } else {
        seleccionarCampanaReporte(c.id);
      }
    };
    btns.appendChild(btn);
  });

  // Grid combinado: municipio | leads | cierres — construir PRIMERO
  const gridComb = document.getElementById('municipio-grid-combinado');
  gridComb.innerHTML = '';
  MUNICIPIOS.forEach(m => {
    const key = m.replace(/\s/g,'_');
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0;align-items:center;padding:5px 0;border-bottom:1px solid #F5F5F5;';
    row.innerHTML = `
      <div style="font-size:13px;color:var(--gris-700);font-weight:500;padding-right:8px;">${m}</div>
      <div style="padding:0 4px;">
        <input type="text" inputmode="numeric" pattern="[0-9]*" id="lead-mun-${key}" placeholder="0"
          style="text-align:center;border-color:#FFD4B8;background:#FFF8F5;"
          oninput="this.value=this.value.replace(/[^0-9]/g,'');actualizarTotalesMun()">
      </div>
      <div style="padding:0 4px;">
        <input type="text" inputmode="numeric" pattern="[0-9]*" id="mun-${key}" placeholder="0"
          style="text-align:center;border-color:#BBF7D0;background:#F0FDF4;"
          oninput="this.value=this.value.replace(/[^0-9]/g,'');actualizarTotalesMun()">
      </div>
      <div style="padding:0 4px;">
        <input type="text" inputmode="decimal" id="mrr-mun-${key}" placeholder="0"
          style="text-align:center;border-color:#DDD6FE;background:#F5F3FF;"
          oninput="this.value=this.value.replace(/[^0-9.]/g,'');actualizarTotalesMun()">
      </div>
    `;
    gridComb.appendChild(row);
  });

  if (!reporteCampanaId || !state.campanas.find(x => x.id === reporteCampanaId)) {
    reporteCampanaId = null;
    mostrarFormReporte(null);
  } else {
    seleccionarCampanaReporte(reporteCampanaId);
  }
}

function seleccionarCampanaReporte(id) {
  reporteCampanaId = id;
  document.querySelectorAll('#reporte-campana-btns .dash-camp-btn').forEach(b => b.classList.remove('active'));
  event && event.target && event.target.classList.add('active');
  // Re-render btns
  const btns = document.getElementById('reporte-campana-btns');
  btns.querySelectorAll('.dash-camp-btn').forEach(b => {
    const c = state.campanas.find(x => x.nombre === b.textContent);
    if (c) b.classList.toggle('active', c.id === id);
  });

  const campana = state.campanas.find(x => x.id === id);
  mostrarFormReporte(campana);
  renderSelectSemanas(campana);
}

function mostrarFormReporte(campana) {
  const fCap = document.getElementById('form-captacion');
  const fRec = document.getElementById('form-reconocimiento');
  const fEmp = document.getElementById('form-empty');
  const btnRow = document.getElementById('btn-guardar-wrap');

  if (!campana) {
    fCap.style.display = 'none';
    fRec.style.display = 'none';
    fEmp.style.display = '';
    btnRow.style.display = 'none';
    return;
  }
  fEmp.style.display = 'none';
  btnRow.style.display = 'flex';
  if (campana.tipo === 'Captación') {
    fCap.style.display = '';
    fRec.style.display = 'none';
  } else {
    fCap.style.display = 'none';
    fRec.style.display = '';
  }
}

function renderSelectSemanas(campana) {
  const sel = document.getElementById('reporte-semana');
  sel.innerHTML = '';
  const semanas = getSemanas(campana);
  semanas.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.idx;
    opt.textContent = s.label;
    sel.appendChild(opt);
  });
  // Seleccionar la última
  sel.value = semanas[semanas.length - 1].idx;
  reporteSemanaIdx = parseInt(sel.value);
  cargarReporteSemana();
}

function agregarSemana() {
  // Ya las generamos dinámicamente, así que no hace falta
  alert('Las semanas se generan automáticamente desde la fecha de inicio de la campaña.');
}

function cargarReporteSemana() {
  const sel = document.getElementById('reporte-semana');
  reporteSemanaIdx = parseInt(sel.value);
  if (!reporteCampanaId) return;
  const reps = state.reportes[reporteCampanaId] || [];
  const rep = reps.find(r => r.semanaIdx === reporteSemanaIdx);
  const campana = state.campanas.find(x => x.id === reporteCampanaId);

  if (campana.tipo === 'Captación') {
    document.getElementById('r-gasto').value         = rep ? rep.gasto : '';
    document.getElementById('r-contactos-fb').value  = rep ? (rep.contactosFB || '') : '';
    document.getElementById('r-contactos-ig').value  = rep ? (rep.contactosIG || '') : '';
    document.getElementById('r-soporte-fb').value    = rep ? (rep.soporteFB || '') : '';
    document.getElementById('r-soporte-ig').value    = rep ? (rep.soporteIG || '') : '';
    calcularLeads();
    MUNICIPIOS.forEach(m => {
      const k = m.replace(/\s/g,'_');
      const iL = document.getElementById('lead-mun-' + k);
      if (iL) iL.value = rep && rep.leadsMun ? (rep.leadsMun[m] || 0) : 0;
      const iC = document.getElementById('mun-' + k);
      if (iC) iC.value = rep && rep.cierres ? (rep.cierres[m] || 0) : 0;
      const iM = document.getElementById('mrr-mun-' + k);
      if (iM) iM.value = rep && rep.mrrMun ? (rep.mrrMun[m] || '') : '';
    });
    actualizarTotalesMun();
  } else {
    document.getElementById('r-gasto-rec').value = rep ? rep.gasto : '';
    document.getElementById('r-alcance').value = rep ? rep.alcance : '';
    document.getElementById('r-impresiones').value = rep ? rep.impresiones : '';
  }
}

function calcularLeads() {
  const cFB = parseInt(document.getElementById('r-contactos-fb').value) || 0;
  const cIG = parseInt(document.getElementById('r-contactos-ig').value) || 0;
  const sFB = parseInt(document.getElementById('r-soporte-fb').value) || 0;
  const sIG = parseInt(document.getElementById('r-soporte-ig').value) || 0;
  const lFB = Math.max(0, cFB - sFB);
  const lIG = Math.max(0, cIG - sIG);
  document.getElementById('r-contactos').value = cFB + cIG || '';
  document.getElementById('r-soporte').value   = sFB + sIG || '';
  document.getElementById('r-leads-fb').value  = lFB || '';
  document.getElementById('r-leads-ig').value  = lIG || '';
  document.getElementById('r-leads').value      = lFB + lIG || '';
}

function actualizarTotalesMun() {
  let totalLeads = 0, totalCierres = 0, totalMRR = 0;
  MUNICIPIOS.forEach(m => {
    const k = m.replace(/\s/g,'_');
    totalLeads   += parseInt(document.getElementById('lead-mun-' + k)?.value) || 0;
    totalCierres += parseInt(document.getElementById('mun-' + k)?.value) || 0;
    totalMRR     += parseFloat(document.getElementById('mrr-mun-' + k)?.value) || 0;
  });
  document.getElementById('total-leads-mun').textContent = totalLeads;
  document.getElementById('total-cierres-reporte').textContent = totalCierres;
  const mrrEl = document.getElementById('total-mrr-reporte');
  if (mrrEl) mrrEl.textContent = '$' + totalMRR.toLocaleString('es-MX', {minimumFractionDigits:0, maximumFractionDigits:0});
}
// aliases por compatibilidad
function actualizarTotalLeadsMun() { actualizarTotalesMun(); }
function actualizarTotalCierres() { actualizarTotalesMun(); }

function limpiarFormReporte() {
  const campana = state.campanas.find(x => x.id === reporteCampanaId);
  if (!campana) return;
  if (campana.tipo === 'Captación') {
    document.getElementById('r-gasto').value = '';
    document.getElementById('r-contactos-fb').value = '';
    document.getElementById('r-contactos-ig').value = '';
    document.getElementById('r-soporte-fb').value = '';
    document.getElementById('r-soporte-ig').value = '';
    calcularLeads();
    MUNICIPIOS.forEach(m => {
      const k = m.replace(/\s/g,'_');
      const iL = document.getElementById('lead-mun-' + k); if (iL) iL.value = 0;
      const iC = document.getElementById('mun-' + k);      if (iC) iC.value = 0;
      const iM = document.getElementById('mrr-mun-' + k);  if (iM) iM.value = '';
    });
    actualizarTotalesMun();
  } else {
    document.getElementById('r-gasto-rec').value = '';
    document.getElementById('r-alcance').value = '';
    document.getElementById('r-impresiones').value = '';
  }
}

function guardarReporte() {
  if (!reporteCampanaId) { alert('Selecciona una campaña.'); return; }
  const campana = state.campanas.find(x => x.id === reporteCampanaId);

  // Validar gasto obligatorio
  const gastoField = campana.tipo === 'Captación' ? 'r-gasto' : 'r-gasto-rec';
  const gastoVal = parseFloat(document.getElementById(gastoField).value);
  if (!gastoVal || gastoVal <= 0) {
    const el = document.getElementById(gastoField);
    el.style.borderColor = 'var(--rojo)';
    el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
    el.focus();
    setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 2500);
    return;
  }

  const semanas = getSemanas(campana);
  const semana = semanas.find(s => s.idx === reporteSemanaIdx);

  if (!state.reportes[reporteCampanaId]) state.reportes[reporteCampanaId] = [];
  const reps = state.reportes[reporteCampanaId];
  const idx = reps.findIndex(r => r.semanaIdx === reporteSemanaIdx);

  let rep = { semanaIdx: reporteSemanaIdx, semanaLabel: semana ? semana.label : 'Semana', fecha: semana ? semana.fecha : '' };

  if (campana.tipo === 'Captación') {
    const leadsMun = {}, cierres = {}, mrrMun = {};
    MUNICIPIOS.forEach(m => {
      const k = m.replace(/\s/g,'_');
      leadsMun[m] = parseInt(document.getElementById('lead-mun-' + k)?.value) || 0;
      cierres[m]  = parseInt(document.getElementById('mun-' + k)?.value) || 0;
      mrrMun[m]   = parseFloat(document.getElementById('mrr-mun-' + k)?.value) || 0;
    });
    rep.gasto       = gastoVal;
    rep.contactosFB = parseInt(document.getElementById('r-contactos-fb').value) || 0;
    rep.contactosIG = parseInt(document.getElementById('r-contactos-ig').value) || 0;
    rep.contactos   = rep.contactosFB + rep.contactosIG;
    rep.soporteFB   = parseInt(document.getElementById('r-soporte-fb').value) || 0;
    rep.soporteIG   = parseInt(document.getElementById('r-soporte-ig').value) || 0;
    rep.soporte     = rep.soporteFB + rep.soporteIG;
    rep.leadsFB     = Math.max(0, rep.contactosFB - rep.soporteFB);
    rep.leadsIG     = Math.max(0, rep.contactosIG - rep.soporteIG);
    rep.leads       = rep.leadsFB + rep.leadsIG;
    rep.leadsMun    = leadsMun;
    rep.cierres     = cierres;
    rep.mrrMun      = mrrMun;
    rep.mrrTotal    = Object.values(mrrMun).reduce((a,v) => a+v, 0);
  } else {
    rep.gasto = gastoVal;
    rep.alcance = parseInt(document.getElementById('r-alcance').value) || 0;
    rep.impresiones = parseInt(document.getElementById('r-impresiones').value) || 0;
  }

  if (idx >= 0) reps[idx] = rep; else reps.push(rep);
  reps.sort((a, b) => a.semanaIdx - b.semanaIdx);
  guardarStateLocal();

  // Sync remoto
  if (gsOnline) {
    mostrarSyncStatus('guardando');
    const repId = reporteCampanaId + '_s' + reporteSemanaIdx;
    const payload = {
      repId,
      campanaId:     reporteCampanaId,
      nombreCampana: campana.nombre,
      ...rep,
    };
    gs('saveReporte', payload).then(res => {
      mostrarSyncStatus(res && res.ok ? 'ok' : 'error');
    });
  }

  // Reset: deseleccionar campaña y volver al estado inicial
  reporteCampanaId = null;
  reporteSemanaIdx = null;
  renderReporte();
}

// ════════════════════════════════════════════
// PANTALLA 3: DASHBOARD
// ════════════════════════════════════════════

// Obtiene todos los meses con datos (YYYY-MM) ordenados
function getMesesConDatos() {
  const meses = new Set();
  state.campanas.forEach(c => {
    (state.reportes[c.id] || []).forEach(r => {
      if (r.fecha) meses.add(r.fecha.slice(0,7));
    });
  });
  return [...meses].sort();
}

// Filtra reportes de una campaña por mes
function repsDeMes(campanaId, mesKey) {
  return (state.reportes[campanaId] || []).filter(r => r.fecha && r.fecha.slice(0,7) === mesKey);
}

function labelMes(mesKey) {
  const [y, m] = mesKey.split('-');
  const d = new Date(parseInt(y), parseInt(m)-1, 1);
  return d.toLocaleDateString('es-MX', { month:'long', year:'numeric' })
    .replace(/^\w/, c => c.toUpperCase());
}

function navMes(dir) {
  const meses = getMesesConDatos();
  if (!meses.length) return;
  const idx = meses.indexOf(dashMesSeleccionado);
  const newIdx = Math.max(0, Math.min(meses.length - 1, idx + dir));
  dashMesSeleccionado = meses[newIdx];
  document.getElementById('dash-mes-select').value = dashMesSeleccionado;
  renderDashboard();
}

function renderDashboard() {
  const dashEmpty   = document.getElementById('dash-empty');
  const dashContent = document.getElementById('dash-content');
  const meses = getMesesConDatos();

  if (meses.length === 0) {
    dashEmpty.style.display = '';
    dashContent.style.display = 'none';
    return;
  }
  dashEmpty.style.display = 'none';
  dashContent.style.display = '';

  // Inicializar mes si es necesario
  if (!dashMesSeleccionado || !meses.includes(dashMesSeleccionado)) {
    dashMesSeleccionado = meses[meses.length - 1];
  }

  // Poblar dropdown
  const sel = document.getElementById('dash-mes-select');
  sel.innerHTML = '';
  meses.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = labelMes(m);
    sel.appendChild(opt);
  });
  sel.value = dashMesSeleccionado;

  // Deshabilitar flechas en extremos
  const btns = document.querySelectorAll('#dash-content .btn-ghost');
  if (btns[0]) btns[0].disabled = meses.indexOf(dashMesSeleccionado) === 0;
  if (btns[1]) btns[1].disabled = meses.indexOf(dashMesSeleccionado) === meses.length - 1;

  renderDashResumen(dashMesSeleccionado);
  renderDashDesglose(dashMesSeleccionado);
}

// ── RESUMEN CONSOLIDADO DEL MES ───────────────
function renderDashResumen(mesKey) {
  const wrap = document.getElementById('dash-resumen');

  // Acumular todas las campañas de captación del mes
  let gastoTotal = 0, leadsTotal = 0, leadsFBTotal = 0, leadsIGTotal = 0;
  let soporteTotal = 0, cierresTotal = 0, mrrTotal = 0;
  const leadsMunTotal = {}; const cierresMunTotal = {}; const mrrMunTotal = {};
  MUNICIPIOS.forEach(m => { leadsMunTotal[m] = 0; cierresMunTotal[m] = 0; mrrMunTotal[m] = 0; });

  let gastoRec = 0, alcanceTotal = 0, impresionesTotalRec = 0;
  let hayCaptacion = false, hayRec = false;

  state.campanas.forEach(c => {
    const reps = repsDeMes(c.id, mesKey);
    if (!reps.length) return;
    if (c.tipo === 'Captación') {
      hayCaptacion = true;
      reps.forEach(r => {
        gastoTotal += r.gasto || 0;
        leadsTotal += r.leads || 0;
        leadsFBTotal += r.leadsFB || 0;
        leadsIGTotal += r.leadsIG || 0;
        soporteTotal += r.soporte || 0;
        cierresTotal += Object.values(r.cierres || {}).reduce((a,v) => a+v, 0);
        mrrTotal     += r.mrrTotal || 0;
        MUNICIPIOS.forEach(m => {
          leadsMunTotal[m]  += (r.leadsMun || {})[m] || 0;
          cierresMunTotal[m]+= (r.cierres  || {})[m] || 0;
          mrrMunTotal[m]    += (r.mrrMun   || {})[m] || 0;
        });
      });
    } else {
      hayRec = true;
      reps.forEach(r => {
        gastoRec += r.gasto || 0;
        alcanceTotal += r.alcance || 0;
        impresionesTotalRec += r.impresiones || 0;
      });
    }
  });

  const cpl = leadsTotal > 0 ? Math.round(gastoTotal / leadsTotal) : 0;
  const cac = cierresTotal > 0 ? Math.round(gastoTotal / cierresTotal) : 0;
  const conv = leadsTotal > 0 ? pct(cierresTotal, leadsTotal) : 0;
  const gastoGlobal = gastoTotal + gastoRec;
  const maxLM = Math.max(...Object.values(leadsMunTotal), 1);
  const maxCM = Math.max(...Object.values(cierresMunTotal), 1);

  wrap.innerHTML = `
    <div style="margin-bottom:6px;font-size:12px;font-weight:700;color:var(--gris-500);text-transform:uppercase;letter-spacing:0.7px;">
      Consolidado · ${labelMes(mesKey)}
    </div>

    ${hayCaptacion ? `
    <!-- KPIs captación -->
    <div class="kpi-grid" style="margin-bottom:14px;">
      <div class="kpi-card">
        <div class="kpi-label">Leads reales</div>
        <div class="kpi-value big">${fmt(leadsTotal)}</div>
        <div class="kpi-sub">
          <span style="color:#1877F2;">📘 ${fmt(leadsFBTotal)} FB</span> &nbsp;
          <span style="color:#E1306C;">📷 ${fmt(leadsIGTotal)} IG</span>
        </div>
        <div class="kpi-delta neutral">${soporteTotal} contactos de soporte descartados</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">CPL promedio</div>
        <div class="kpi-value big">${cpl > 0 ? '$'+fmt(cpl) : '—'}</div>
        <div class="kpi-sub">Gasto captación: ${fmtMXN(gastoTotal)}</div>
        <div class="kpi-delta ${cpl===0?'neutral':cpl<200?'up':cpl<500?'neutral':'down'}">${cpl===0?'Sin datos':cpl<200?'↓ Eficiente':cpl<500?'↔ Revisar':'↑ Alto'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Nuevos clientes</div>
        <div class="kpi-value big">${fmt(cierresTotal)}</div>
        <div class="kpi-sub">CAC: ${cac > 0 ? '$'+fmt(cac) : '—'}</div>
        <div class="kpi-delta ${conv>=20?'up':conv>=10?'neutral':conv>0?'down':'neutral'}">${conv > 0 ? conv+'% conv. lead→cliente' : 'Sin cierres'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">MRR generado</div>
        <div class="kpi-value big" style="color:#7C3AED;">${mrrTotal > 0 ? fmtMXN(mrrTotal) : '—'}</div>
        <div class="kpi-sub">Ingreso mensual recurrente</div>
        <div class="kpi-delta ${mrrTotal > gastoTotal ? 'up' : mrrTotal > 0 ? 'neutral' : 'neutral'}">${mrrTotal > 0 ? (mrrTotal > gastoTotal ? '↑ ROI positivo' : '↔ Menor al gasto') : 'Sin datos'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Gasto total del mes</div>
        <div class="kpi-value big">${fmtMXN(gastoGlobal)}</div>
        <div class="kpi-sub">${hayRec ? 'Captación: '+fmtMXN(gastoTotal)+' · Reconoc.: '+fmtMXN(gastoRec) : 'Solo captación'}</div>
      </div>
    </div>

    <!-- Gráfica combinada municipio -->
    <div class="card" style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div class="card-title" style="margin-bottom:0;">📍 Leads y cierres por municipio</div>
        <div style="display:flex;align-items:center;gap:16px;font-size:11px;font-weight:600;">
          <span style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:12px;border-radius:3px;background:var(--naranja);display:inline-block;"></span>Leads</span>
          <span style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:12px;border-radius:3px;background:var(--verde);display:inline-block;"></span>Cierres</span>
        </div>
      </div>
      <!-- Encabezado -->
      <div style="display:grid;grid-template-columns:130px 1fr 44px 44px 48px 72px;gap:6px;align-items:center;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #F0F0F0;">
        <div style="font-size:11px;font-weight:700;color:var(--gris-500);text-transform:uppercase;">Municipio</div>
        <div style="font-size:11px;font-weight:700;color:var(--gris-500);text-transform:uppercase;">Distribución</div>
        <div style="font-size:11px;font-weight:700;color:var(--naranja-deep);text-transform:uppercase;text-align:center;">Leads</div>
        <div style="font-size:11px;font-weight:700;color:var(--verde);text-transform:uppercase;text-align:center;">Cierres</div>
        <div style="font-size:11px;font-weight:700;color:var(--gris-500);text-transform:uppercase;text-align:center;">Conv%</div>
        <div style="font-size:11px;font-weight:700;color:#7C3AED;text-transform:uppercase;text-align:right;">MRR</div>
      </div>
      ${MUNICIPIOS.map(m => {
        const l = leadsMunTotal[m] || 0;
        const c = cierresMunTotal[m] || 0;
        const mrr = mrrMunTotal[m] || 0;
        const convM = l > 0 ? Math.round(c/l*100) : 0;
        const barLeads = maxLM > 0 ? Math.round(l/maxLM*100) : 0;
        const barCierres = l > 0 ? Math.round(c/l*100) : 0;
        return `
        <div style="display:grid;grid-template-columns:130px 1fr 44px 44px 48px 72px;gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid #FAFAFA;">
          <div style="font-size:12px;color:var(--gris-700);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m}</div>
          <div style="position:relative;height:22px;background:var(--gris-100);border-radius:4px;overflow:hidden;">
            <div style="position:absolute;left:0;top:0;height:100%;width:${barLeads}%;background:var(--naranja);border-radius:4px;opacity:0.85;transition:width 0.4s;"></div>
            <div style="position:absolute;left:0;top:0;height:100%;width:${Math.round(barLeads*barCierres/100)}%;background:var(--verde);border-radius:4px;transition:width 0.4s;"></div>
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--naranja-deep);text-align:center;font-family:'JetBrains Mono',monospace;">${l}</div>
          <div style="font-size:13px;font-weight:700;color:var(--verde);text-align:center;font-family:'JetBrains Mono',monospace;">${c}</div>
          <div style="font-size:12px;font-weight:600;text-align:center;color:${convM>=20?'var(--verde)':convM>=10?'var(--amarillo)':convM>0?'var(--rojo)':'var(--gris-300)'};">${convM > 0 ? convM+'%' : '—'}</div>
          <div style="font-size:12px;font-weight:600;text-align:right;color:${mrr>0?'#7C3AED':'var(--gris-300)'};">${mrr > 0 ? fmtMXN(mrr) : '—'}</div>
        </div>`;
      }).join('')}
      <!-- Total -->
      <div style="display:grid;grid-template-columns:130px 1fr 44px 44px 48px 72px;gap:6px;align-items:center;padding:8px 0 0;margin-top:4px;border-top:2px solid #F0F0F0;">
        <div style="font-size:12px;font-weight:700;color:var(--negro);">TOTAL</div>
        <div></div>
        <div style="font-size:14px;font-weight:800;color:var(--naranja-deep);text-align:center;font-family:'JetBrains Mono',monospace;">${leadsTotal}</div>
        <div style="font-size:14px;font-weight:800;color:var(--verde);text-align:center;font-family:'JetBrains Mono',monospace;">${cierresTotal}</div>
        <div style="font-size:13px;font-weight:700;text-align:center;color:${conv>=20?'var(--verde)':conv>=10?'var(--amarillo)':conv>0?'var(--rojo)':'var(--gris-300)'};">${conv > 0 ? conv+'%' : '—'}</div>
        <div style="font-size:13px;font-weight:800;text-align:right;color:#7C3AED;">${mrrTotal > 0 ? fmtMXN(mrrTotal) : '—'}</div>
      </div>
    </div>` : ''}

    ${hayRec && !hayCaptacion ? `
    <div class="kpi-grid" style="margin-bottom:14px;">
      <div class="kpi-card">
        <div class="kpi-label">Alcance total</div>
        <div class="kpi-value big">${fmt(alcanceTotal)}</div>
        <div class="kpi-sub">personas únicas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Impresiones</div>
        <div class="kpi-value big">${fmt(impresionesTotalRec)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">CPM</div>
        <div class="kpi-value big">${impresionesTotalRec>0?'$'+fmt(Math.round(gastoRec/impresionesTotalRec*1000)):'—'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Gasto reconocimiento</div>
        <div class="kpi-value big">${fmtMXN(gastoRec)}</div>
      </div>
    </div>` : ''}
  `;
}

// ── DESGLOSE POR CAMPAÑA ──────────────────────
function renderDashDesglose(mesKey) {
  const wrap = document.getElementById('dash-desglose');
  wrap.innerHTML = '';

  const campañasConDatos = state.campanas.filter(c => repsDeMes(c.id, mesKey).length > 0);

  if (!campañasConDatos.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:30px 0;"><div class="empty-icon">📭</div><div class="empty-title">Sin campañas con datos en este mes</div></div>';
    return;
  }

  campañasConDatos.forEach(c => {
    const reps = repsDeMes(c.id, mesKey);
    const div = document.createElement('div');
    div.className = 'card';
    div.style.marginBottom = '14px';

    const iconCanal = c.canal === 'Meta Ads' ? '📘' : '🎵';
    const badgeTipo = c.tipo === 'Captación'
      ? '<span class="badge badge-captacion">Captación</span>'
      : '<span class="badge badge-reconocimiento">Reconocimiento</span>';

    if (c.tipo === 'Captación') {
      const gasto = reps.reduce((a,r) => a+(r.gasto||0), 0);
      const leads = reps.reduce((a,r) => a+(r.leads||0), 0);
      const leadsFB = reps.reduce((a,r) => a+(r.leadsFB||0), 0);
      const leadsIG = reps.reduce((a,r) => a+(r.leadsIG||0), 0);
      const cierres = reps.reduce((a,r) => a+Object.values(r.cierres||{}).reduce((s,v)=>s+v,0), 0);
      const cpl = leads > 0 ? Math.round(gasto/leads) : 0;
      const cac = cierres > 0 ? Math.round(gasto/cierres) : 0;
      const conv = leads > 0 ? pct(cierres, leads) : 0;
      const avance = c.meta > 0 ? Math.min(100, pct(leads, c.meta)) : null;

      // Municipios por campaña
      const lMun = {}, cMun = {}, mrrMunC = {};
      MUNICIPIOS.forEach(m => { lMun[m] = 0; cMun[m] = 0; mrrMunC[m] = 0; });
      reps.forEach(r => {
        MUNICIPIOS.forEach(m => {
          lMun[m]    += (r.leadsMun||{})[m] || 0;
          cMun[m]    += (r.cierres ||{})[m] || 0;
          mrrMunC[m] += (r.mrrMun  ||{})[m] || 0;
        });
      });
      const maxLMC = Math.max(...Object.values(lMun), 1);
      const mrrCampana = Object.values(mrrMunC).reduce((a,v)=>a+v,0);

      div.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <span style="font-size:18px;">${iconCanal}</span>
          <span style="font-size:15px;font-weight:700;flex:1;">${c.nombre}</span>
          ${badgeTipo}
          <span style="font-size:12px;color:var(--gris-500);">${reps.length} sem.</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px;">
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:600;color:var(--gris-500);text-transform:uppercase;margin-bottom:4px;">Leads</div>
            <div style="font-size:20px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--naranja-deep);">${fmt(leads)}</div>
            <div style="font-size:11px;color:var(--gris-500);">📘${fmt(leadsFB)} 📷${fmt(leadsIG)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:600;color:var(--gris-500);text-transform:uppercase;margin-bottom:4px;">Cierres</div>
            <div style="font-size:20px;font-weight:800;font-family:'JetBrains Mono',monospace;">${fmt(cierres)}</div>
            <div style="font-size:11px;color:var(--gris-500);">${conv > 0 ? conv+'% conv.' : '—'}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:600;color:var(--gris-500);text-transform:uppercase;margin-bottom:4px;">MRR</div>
            <div style="font-size:20px;font-weight:800;font-family:'JetBrains Mono',monospace;color:#7C3AED;">${mrrCampana > 0 ? fmtMXN(mrrCampana) : '—'}</div>
            <div style="font-size:11px;color:var(--gris-500);">${mrrCampana > gasto ? '↑ ROI positivo' : mrrCampana > 0 ? '↔ Menor al gasto' : 'Sin datos'}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:600;color:var(--gris-500);text-transform:uppercase;margin-bottom:4px;">CPL</div>
            <div style="font-size:20px;font-weight:800;font-family:'JetBrains Mono',monospace;">${cpl > 0 ? '$'+fmt(cpl) : '—'}</div>
            <div style="font-size:11px;color:var(--gris-500);">CAC: ${cac > 0 ? '$'+fmt(cac) : '—'}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:600;color:var(--gris-500);text-transform:uppercase;margin-bottom:4px;">Gasto</div>
            <div style="font-size:20px;font-weight:800;font-family:'JetBrains Mono',monospace;">${fmtMXN(gasto)}</div>
            <div style="font-size:11px;color:var(--gris-500);">de ${fmtMXN(c.presupuesto)}</div>
          </div>
        </div>
        ${avance !== null ? `
        <div class="progress-wrap" style="margin-bottom:16px;">
          <div class="progress-header"><span>${fmt(leads)} leads · meta: ${fmt(c.meta)}</span><span>${avance}%</span></div>
          <div class="progress-bar"><div class="progress-fill ${avance>=80?'verde':avance>=50?'amarillo':''}" style="width:${avance}%"></div></div>
        </div>` : ''}
        <!-- Gráfica municipios combinada -->
        <div style="border-top:1px solid #F0F0F0;padding-top:12px;">
          <div style="display:grid;grid-template-columns:120px 1fr 38px 38px 44px 64px;gap:4px;align-items:center;margin-bottom:6px;">
            <div style="font-size:10px;font-weight:700;color:var(--gris-500);text-transform:uppercase;">Municipio</div>
            <div style="font-size:10px;font-weight:700;color:var(--gris-500);text-transform:uppercase;">Dist.</div>
            <div style="font-size:10px;font-weight:700;color:var(--naranja-deep);text-transform:uppercase;text-align:center;">L</div>
            <div style="font-size:10px;font-weight:700;color:var(--verde);text-transform:uppercase;text-align:center;">C</div>
            <div style="font-size:10px;font-weight:700;color:var(--gris-500);text-transform:uppercase;text-align:center;">Conv%</div>
            <div style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;text-align:right;">MRR</div>
          </div>
          ${MUNICIPIOS.map(m => {
            const l = lMun[m]; const c2 = cMun[m]; const mrr2 = mrrMunC[m] || 0;
            const convM = l > 0 ? Math.round(c2/l*100) : 0;
            const barL = Math.round(l/maxLMC*100);
            const barC = l > 0 ? Math.round(c2/l*100) : 0;
            return `<div style="display:grid;grid-template-columns:120px 1fr 38px 38px 44px 64px;gap:4px;align-items:center;padding:3px 0;border-bottom:1px solid #FAFAFA;">
              <div style="font-size:11px;color:var(--gris-700);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m}</div>
              <div style="position:relative;height:18px;background:var(--gris-100);border-radius:3px;overflow:hidden;">
                <div style="position:absolute;left:0;top:0;height:100%;width:${barL}%;background:var(--naranja);opacity:0.8;border-radius:3px;"></div>
                <div style="position:absolute;left:0;top:0;height:100%;width:${Math.round(barL*barC/100)}%;background:var(--verde);border-radius:3px;"></div>
              </div>
              <div style="font-size:12px;font-weight:700;color:var(--naranja-deep);text-align:center;">${l}</div>
              <div style="font-size:12px;font-weight:700;color:var(--verde);text-align:center;">${c2}</div>
              <div style="font-size:11px;font-weight:600;text-align:center;color:${convM>=20?'var(--verde)':convM>=10?'var(--amarillo)':convM>0?'var(--rojo)':'var(--gris-300)'};">${convM>0?convM+'%':'—'}</div>
              <div style="font-size:11px;font-weight:600;text-align:right;color:${mrr2>0?'#7C3AED':'var(--gris-300)'};">${mrr2>0?fmtMXN(mrr2):'—'}</div>
            </div>`;
          }).join('')}
          <div style="display:grid;grid-template-columns:120px 1fr 38px 38px 44px 64px;gap:4px;padding-top:6px;border-top:2px solid #F0F0F0;margin-top:3px;">
            <div style="font-size:11px;font-weight:700;">TOTAL</div><div></div>
            <div style="font-size:12px;font-weight:800;color:var(--naranja-deep);text-align:center;">${leads}</div>
            <div style="font-size:12px;font-weight:800;color:var(--verde);text-align:center;">${cierres}</div>
            <div style="font-size:11px;font-weight:700;text-align:center;color:${conv>=20?'var(--verde)':conv>=10?'var(--amarillo)':conv>0?'var(--rojo)':'var(--gris-300)'};">${conv>0?conv+'%':'—'}</div>
            <div style="font-size:12px;font-weight:800;text-align:right;color:#7C3AED;">${mrrCampana>0?fmtMXN(mrrCampana):'—'}</div>
          </div>
        </div>
      `;
    } else {
      const gasto = reps.reduce((a,r) => a+(r.gasto||0), 0);
      const alcance = reps.reduce((a,r) => a+(r.alcance||0), 0);
      const impresiones = reps.reduce((a,r) => a+(r.impresiones||0), 0);
      const cpm = impresiones > 0 ? Math.round(gasto/impresiones*1000) : 0;
      const frec = alcance > 0 ? (impresiones/alcance).toFixed(1) : '—';
      const avance = c.meta > 0 ? Math.min(100, pct(alcance, c.meta)) : null;

      div.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <span style="font-size:18px;">${iconCanal}</span>
          <span style="font-size:15px;font-weight:700;flex:1;">${c.nombre}</span>
          ${badgeTipo}
          <span style="font-size:12px;color:var(--gris-500);">${reps.length} sem.</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:600;color:var(--gris-500);text-transform:uppercase;margin-bottom:4px;">Alcance</div>
            <div style="font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace;">${fmt(alcance)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:600;color:var(--gris-500);text-transform:uppercase;margin-bottom:4px;">Impresiones</div>
            <div style="font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace;">${fmt(impresiones)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:600;color:var(--gris-500);text-transform:uppercase;margin-bottom:4px;">CPM</div>
            <div style="font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace;">${cpm > 0 ? '$'+fmt(cpm) : '—'}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:600;color:var(--gris-500);text-transform:uppercase;margin-bottom:4px;">Frecuencia</div>
            <div style="font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace;">${frec}x</div>
          </div>
        </div>
        ${avance !== null ? `
        <div class="progress-wrap" style="margin-top:12px;">
          <div class="progress-header"><span>${fmt(alcance)} personas · meta: ${fmt(c.meta)}</span><span>${avance}%</span></div>
          <div class="progress-bar"><div class="progress-fill ${avance>=80?'verde':avance>=50?'amarillo':''}" style="width:${avance}%"></div></div>
        </div>` : ''}
      `;
    }
    wrap.appendChild(div);
  });
}

// ════════════════════════════════════════════
// MODAL UTILS
// ════════════════════════════════════════════
function abrirModal(id) {
  document.getElementById(id).classList.add('open');
}
function cerrarModal(id) {
  document.getElementById(id).classList.remove('open');
}
// ════════════════════════════════════════════
// PIPELINE — UTILIDADES
// ════════════════════════════════════════════
function diasDesde(fechaStr) {
  if (!fechaStr) return null;
  const diff = Date.now() - new Date(fechaStr + 'T00:00:00').getTime();
  return Math.floor(diff / 86400000);
}

function estadoBadge(estado) {
  const map = {
    negociacion: '<span class="badge badge-negociacion">🤝 Negociación</span>',
    contrato:    '<span class="badge badge-contrato">📄 Contrato</span>',
    instalado:   '<span class="badge badge-instalado">✅ Instalado</span>',
    cancelado:   '<span class="badge badge-cancelado">❌ Cancelado</span>',
  };
  return map[estado] || estado;
}

function alertaReloj(lead) {
  if (lead.estado !== 'contrato') return null;
  const d = diasDesde(lead.fechaContrato);
  if (d === null) return null;
  const horas = Math.floor((Date.now() - new Date(lead.fechaContrato + 'T00:00:00').getTime()) / 3600000);
  if (horas >= 48) return { nivel: 'critica', horas };
  if (horas >= 36) return { nivel: 'warn', horas };
  return null;
}

// ════════════════════════════════════════════
// PIPELINE — RENDER
// ════════════════════════════════════════════
function renderPipeline() {
  const filtroEstado    = document.getElementById('filtro-estado')?.value || '';
  const filtroSucursal  = document.getElementById('filtro-sucursal-pipe')?.value || '';
  const filtroAgente    = document.getElementById('filtro-agente-pipe')?.value || '';

  // Poblar selectores de filtro con catálogos
  poblarSelect('filtro-sucursal-pipe', state.catalogos.sucursales, 'Todas las sucursales');
  poblarSelect('filtro-agente-pipe',   state.catalogos.agentes,    'Todos los agentes');

  // Alertas
  const alertasWrap = document.getElementById('pipeline-alertas');
  const criticos = state.leads.filter(l => alertaReloj(l)?.nivel === 'critica');
  const warns    = state.leads.filter(l => alertaReloj(l)?.nivel === 'warn');
  alertasWrap.innerHTML = '';
  criticos.forEach(l => {
    const a = alertaReloj(l);
    alertasWrap.innerHTML += `
      <div class="alerta-card critica">
        <span style="font-size:20px;">🚨</span>
        <div>
          <strong>${l.nombre}</strong> — Contrato sin instalar hace <strong>${a.horas} horas</strong>
          <div style="font-size:12px;color:var(--gris-500);">${l.sucursal} · ${l.agente}</div>
        </div>
        <button class="btn btn-ghost" style="margin-left:auto;padding:6px 12px;font-size:12px;" onclick="abrirModalLead('${l.id}')">Ver lead</button>
      </div>`;
  });
  warns.forEach(l => {
    const a = alertaReloj(l);
    alertasWrap.innerHTML += `
      <div class="alerta-card">
        <span style="font-size:20px;">⚠️</span>
        <div>
          <strong>${l.nombre}</strong> — Contrato a <strong>${48 - a.horas} horas</strong> de vencer
          <div style="font-size:12px;color:var(--gris-500);">${l.sucursal} · ${l.agente}</div>
        </div>
        <button class="btn btn-ghost" style="margin-left:auto;padding:6px 12px;font-size:12px;" onclick="abrirModalLead('${l.id}')">Ver lead</button>
      </div>`;
  });

  // Filtrar leads
  let leads = [...state.leads];
  if (filtroEstado)   leads = leads.filter(l => l.estado === filtroEstado);
  if (filtroSucursal) leads = leads.filter(l => l.sucursal === filtroSucursal);
  if (filtroAgente)   leads = leads.filter(l => l.agente === filtroAgente);

  // KPIs rápidos
  const total      = state.leads.length;
  const activos    = state.leads.filter(l => l.estado === 'negociacion' || l.estado === 'contrato').length;
  const instalados = state.leads.filter(l => l.estado === 'instalado').length;
  const caidos     = state.leads.filter(l => l.estado === 'cancelado').length;
  const mrrReal    = state.leads.filter(l => l.estado === 'instalado').reduce((a, l) => a + (Number(l.precio) || 0), 0);
  const mrrPrevisto= state.leads.filter(l => l.estado === 'contrato').reduce((a, l) => a + (Number(l.precio) || 0), 0);
  const estancados = state.leads.filter(l => {
    if (l.estado !== 'negociacion') return false;
    const d = diasDesde(l.fechaAlta);
    return d !== null && d >= 2;
  }).length;

  document.getElementById('pipeline-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">En pipeline</div>
      <div class="kpi-value big">${activos}</div>
      <div class="kpi-sub">${estancados > 0 ? `<span style="color:var(--rojo);">⚠️ ${estancados} estancados +2 días</span>` : 'Sin estancados'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Instalados</div>
      <div class="kpi-value big" style="color:var(--verde);">${instalados}</div>
      <div class="kpi-sub">MRR Real: ${fmtMXN(mrrReal)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">MRR Previsto</div>
      <div class="kpi-value big" style="color:#7C3AED;">${fmtMXN(mrrPrevisto)}</div>
      <div class="kpi-sub">${state.leads.filter(l=>l.estado==='contrato').length} contratos pendientes de instalar</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Cancelados</div>
      <div class="kpi-value big" style="color:var(--rojo);">${caidos}</div>
      <div class="kpi-sub">de ${total} leads totales · ${total > 0 ? Math.round(caidos/total*100) : 0}%</div>
    </div>
  `;

  // Tabla
  const tbody = document.getElementById('pipeline-body');
  const empty = document.getElementById('pipeline-empty');
  tbody.innerHTML = '';

  if (leads.length === 0) {
    empty.style.display = '';
    document.getElementById('pipeline-tabla').style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  document.getElementById('pipeline-tabla').style.display = '';

  leads.sort((a, b) => {
    // Contratos con alerta primero
    const aA = alertaReloj(a); const bA = alertaReloj(b);
    if (aA && !bA) return -1;
    if (!aA && bA) return 1;
    return new Date(b.fechaAlta) - new Date(a.fechaAlta);
  });

  leads.forEach(l => {
    const alerta = alertaReloj(l);
    const dias   = diasDesde(l.fechaAlta);
    const tr = document.createElement('tr');
    if (alerta?.nivel === 'critica') tr.style.background = '#FFF5F5';
    else if (alerta?.nivel === 'warn') tr.style.background = '#FFFBEB';
    else if (l.estado === 'negociacion' && dias >= 2) tr.style.background = '#FFFBEB';

    tr.innerHTML = `
      <td>
        <div style="font-weight:600;font-size:13px;">${l.nombre || '—'}</div>
        <div style="font-size:11px;color:var(--gris-500);">${l.telefono || ''}</div>
      </td>
      <td style="font-size:13px;">${l.sucursal || '—'}</td>
      <td style="font-size:12px;color:var(--gris-500);">${l.campana ? (state.campanas.find(c=>c.id===l.campana)?.nombre || l.campana) : '—'}</td>
      <td style="font-size:13px;">${l.agente || '—'}</td>
      <td>${estadoBadge(l.estado)}</td>
      <td class="td-mono" style="font-size:13px;color:${dias >= 2 && l.estado==='negociacion' ? 'var(--rojo)' : 'var(--negro)'};">${dias !== null ? dias + 'd' : '—'}</td>
      <td style="font-size:12px;">${l.fechaContrato || '—'}</td>
      <td style="font-size:12px;">${l.fechaInstalacion ? l.fechaInstalacion : (alerta ? `<span style="color:var(--rojo);font-weight:600;">⚠️ ${alerta.horas}hrs</span>` : '—')}</td>
      <td style="font-size:12px;">${l.paquete || '—'}</td>
      <td class="td-mono" style="font-size:13px;color:#7C3AED;">${l.precio ? fmtMXN(l.precio) : '—'}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost" style="padding:5px 10px;font-size:11px;" onclick="abrirModalLead('${l.id}')">Editar</button>
          <button class="btn btn-danger" style="padding:5px 10px;font-size:11px;" onclick="eliminarLead('${l.id}')">×</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ════════════════════════════════════════════
// PIPELINE — MODAL LEAD
// ════════════════════════════════════════════
function abrirModalLead(id) {
  leadEditandoId = id || null;

  // Poblar selectores
  poblarSelect('l-sucursal', state.catalogos.sucursales, 'Selecciona...');
  poblarSelect('l-agente',   state.catalogos.agentes,   'Selecciona...');
  poblarSelect('l-paquete',  state.catalogos.paquetes,  'Selecciona...');
  poblarSelect('l-promo',    state.catalogos.promociones,'Sin promoción');

  // Poblar campañas
  const selCamp = document.getElementById('l-campana');
  selCamp.innerHTML = '<option value="">Sin campaña</option>';
  state.campanas.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.nombre;
    selCamp.appendChild(opt);
  });

  if (id) {
    const l = state.leads.find(x => x.id === id);
    document.getElementById('modal-lead-title').textContent = 'Editar lead';
    document.getElementById('l-nombre').value    = l.nombre || '';
    document.getElementById('l-telefono').value  = l.telefono || '';
    document.getElementById('l-sucursal').value  = l.sucursal || '';
    document.getElementById('l-agente').value    = l.agente || '';
    document.getElementById('l-canal').value     = l.canal || '';
    document.getElementById('l-campana').value   = l.campana || '';
    document.getElementById('l-paquete').value   = l.paquete || '';
    document.getElementById('l-precio').value    = l.precio || '';
    document.getElementById('l-tipopago').value  = l.tipoPago || '';
    document.getElementById('l-promo').value     = l.promo || '';
    document.getElementById('l-fecha-contrato').value          = l.fechaContrato || '';
    document.getElementById('l-fecha-instalacion').value        = l.fechaInstalacion || '';
    document.getElementById('l-fecha-instalacion-real').value   = l.fechaInstalacionReal || '';
    document.getElementById('l-causa-cancelacion').value        = l.causaCancelacion || '';
    calcularHulux24();
    selectEstadoLead(l.estado || 'negociacion');
  } else {
    document.getElementById('modal-lead-title').textContent = 'Nuevo lead';
    ['l-nombre','l-telefono','l-precio','l-fecha-contrato','l-fecha-instalacion','l-fecha-instalacion-real'].forEach(fieldId => document.getElementById(fieldId).value = '');
    ['l-sucursal','l-agente','l-canal','l-campana','l-paquete','l-tipopago','l-promo','l-causa-cancelacion'].forEach(fieldId => document.getElementById(fieldId).value = '');
    selectEstadoLead('negociacion');
  }
  abrirModal('modal-lead');
}

function selectEstadoLead(estado) {
  estadoLeadSeleccionado = estado;
  document.querySelectorAll('.estado-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.estado === estado);
  });
  document.getElementById('seccion-contrato').style.display =
    (estado === 'contrato' || estado === 'instalado') ? '' : 'none';
  document.getElementById('seccion-cancelacion').style.display =
    estado === 'cancelado' ? '' : 'none';
}

function guardarLead() {
  const nombre = document.getElementById('l-nombre').value.trim();
  if (!nombre) { alert('El nombre del prospecto es obligatorio.'); return; }

  const fechaProg = document.getElementById('l-fecha-instalacion').value;
  const fechaReal = document.getElementById('l-fecha-instalacion-real').value;

  const lead = {
    id:                     leadEditandoId || uid(),
    nombre,
    telefono:               document.getElementById('l-telefono').value.trim(),
    sucursal:               document.getElementById('l-sucursal').value,
    agente:                 document.getElementById('l-agente').value,
    canal:                  document.getElementById('l-canal').value,
    campana:                document.getElementById('l-campana').value,
    estado:                 estadoLeadSeleccionado,
    paquete:                document.getElementById('l-paquete').value,
    precio:                 parseFloat(document.getElementById('l-precio').value) || 0,
    tipoPago:               document.getElementById('l-tipopago').value,
    promo:                  document.getElementById('l-promo').value,
    fechaContrato:          document.getElementById('l-fecha-contrato').value,
    fechaInstalacion:       fechaProg,
    fechaInstalacionReal:   fechaReal,
    gapInstalacionHoras:    calcularGapHoras(fechaProg, fechaReal),
    causaCancelacion:       document.getElementById('l-causa-cancelacion').value,
    fechaAlta:              leadEditandoId
      ? (state.leads.find(x => x.id === leadEditandoId)?.fechaAlta || new Date().toISOString().slice(0,10))
      : new Date().toISOString().slice(0,10),
  };

  if (leadEditandoId) {
    const idx = state.leads.findIndex(x => x.id === leadEditandoId);
    if (idx >= 0) state.leads[idx] = lead;
  } else {
    state.leads.push(lead);
  }

  guardarStateLocal();
  cerrarModal('modal-lead');
  renderPipeline();

  if (gsOnline) {
    mostrarSyncStatus('guardando');
    gs('saveLead', lead).then(r => mostrarSyncStatus(r?.ok ? 'ok' : 'error'));
  }
}

function eliminarLead(id) {
  if (!confirm('¿Eliminar este lead del pipeline?')) return;
  state.leads = state.leads.filter(l => l.id !== id);
  guardarStateLocal();
  renderPipeline();
  if (gsOnline) gs('deleteLead', { id });
}

// ════════════════════════════════════════════
// CONFIGURACIÓN
// ════════════════════════════════════════════
function asegurarCatalogos() {
  if (!state.catalogos) state.catalogos = {};
  if (!state.catalogos.agentes)     state.catalogos.agentes     = [];
  if (!state.catalogos.sucursales)  state.catalogos.sucursales  = [];
  if (!state.catalogos.paquetes)    state.catalogos.paquetes    = [];
  if (!state.catalogos.promociones) state.catalogos.promociones = [];
}

function renderConfig() {
  asegurarCatalogos();
  renderListaCatalogo('agentes',    'lista-agentes');
  renderListaCatalogo('sucursales', 'lista-sucursales');
  renderListaCatalogo('paquetes',   'lista-paquetes');
  renderListaCatalogo('promociones','lista-promociones');
}

function renderListaCatalogo(tipo, contenedorId) {
  const wrap = document.getElementById(contenedorId);
  const items = state.catalogos[tipo] || [];
  if (items.length === 0) {
    wrap.innerHTML = '<div style="font-size:13px;color:var(--gris-400);padding:8px 0;">Sin elementos. Agrega el primero.</div>';
    return;
  }
  wrap.innerHTML = items.map((item, idx) => `
    <div class="catalogo-item">
      <div>
        <div class="catalogo-item-nombre">${item.nombre}</div>
        ${item.precio ? `<div class="catalogo-item-sub">${fmtMXN(item.precio)} / mes</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px;" onclick="editarCatalogo('${tipo}', ${idx})">Editar</button>
        <button class="btn btn-danger" style="padding:4px 10px;font-size:11px;" onclick="eliminarCatalogo('${tipo}', ${idx})">×</button>
      </div>
    </div>
  `).join('');
}

function poblarSelect(selectId, items, placeholder) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  (items || []).forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.nombre;
    opt.textContent = item.nombre + (item.precio ? ` · ${fmtMXN(item.precio)}` : '');
    sel.appendChild(opt);
  });
  sel.value = current;
}

let catalogoTipoActual = null;
let catalogoIdxActual  = null;

function agregarCatalogo(tipo) {
  asegurarCatalogos();
  catalogoTipoActual = tipo;
  catalogoIdxActual  = null;
  const labels = { agentes:'Nombre del agente', sucursales:'Nombre de la sucursal', paquetes:'Nombre del paquete', promociones:'Nombre de la promoción' };
  const titles = { agentes:'Agregar agente', sucursales:'Agregar sucursal', paquetes:'Agregar paquete', promociones:'Agregar promoción' };
  document.getElementById('modal-catalogo-title').textContent = titles[tipo];
  document.getElementById('catalogo-label').textContent = labels[tipo];
  document.getElementById('catalogo-input').value = '';
  document.getElementById('catalogo-extra').value = '';
  document.getElementById('catalogo-extra-wrap').style.display = tipo === 'paquetes' ? '' : 'none';
  document.getElementById('catalogo-extra-label').textContent = 'Precio base (MXN/mes)';
  abrirModal('modal-catalogo');
}

function editarCatalogo(tipo, idx) {
  catalogoTipoActual = tipo;
  catalogoIdxActual  = idx;
  const item = state.catalogos[tipo][idx];
  const labels = { agentes:'Nombre del agente', sucursales:'Nombre de la sucursal', paquetes:'Nombre del paquete', promociones:'Nombre de la promoción' };
  const titles = { agentes:'Editar agente', sucursales:'Editar sucursal', paquetes:'Editar paquete', promociones:'Editar promoción' };
  document.getElementById('modal-catalogo-title').textContent = titles[tipo];
  document.getElementById('catalogo-label').textContent = labels[tipo];
  document.getElementById('catalogo-input').value = item.nombre || '';
  document.getElementById('catalogo-extra').value = item.precio || '';
  document.getElementById('catalogo-extra-wrap').style.display = tipo === 'paquetes' ? '' : 'none';
  abrirModal('modal-catalogo');
}

function guardarCatalogo() {
  const nombre = document.getElementById('catalogo-input').value.trim();
  if (!nombre) { alert('Escribe un nombre.'); return; }
  const precio = parseFloat(document.getElementById('catalogo-extra').value) || 0;
  const item = { id: uid(), nombre, ...(catalogoTipoActual === 'paquetes' ? { precio } : {}) };

  if (catalogoIdxActual !== null) {
    state.catalogos[catalogoTipoActual][catalogoIdxActual] = { ...state.catalogos[catalogoTipoActual][catalogoIdxActual], ...item };
  } else {
    state.catalogos[catalogoTipoActual].push(item);
  }

  guardarStateLocal();
  cerrarModal('modal-catalogo');
  renderConfig();
  if (gsOnline) gs('saveCatalogos', state.catalogos);
}

function eliminarCatalogo(tipo, idx) {
  if (!confirm('¿Eliminar este elemento?')) return;
  state.catalogos[tipo].splice(idx, 1);
  guardarStateLocal();
  renderConfig();
  if (gsOnline) gs('saveCatalogos', state.catalogos);
}



// ════════════════════════════════════════════
// HULUX 24 — GAP INSTALACIÓN
// ════════════════════════════════════════════
function calcularGapHoras(fechaProg, fechaReal) {
  if (!fechaProg || !fechaReal) return null;
  const diff = new Date(fechaReal + 'T00:00:00') - new Date(fechaProg + 'T00:00:00');
  return Math.round(diff / 3600000);
}

function calcularHulux24() {
  const badge = document.getElementById('hulux24-badge');
  if (!badge) return;
  const prog = document.getElementById('l-fecha-instalacion')?.value;
  const real = document.getElementById('l-fecha-instalacion-real')?.value;
  if (!prog || !real) { badge.style.display = 'none'; return; }
  const horas = calcularGapHoras(prog, real);
  badge.style.display = '';
  if (horas <= 24) {
    badge.innerHTML = `<div style="background:#DCFCE7;border:1px solid #BBF7D0;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:#166534;">✅ HULUX 24 cumplido — instalado en ${horas} horas</div>`;
  } else {
    badge.innerHTML = `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:#991B1B;">⚠️ HULUX 24 incumplido — ${horas} horas (${horas - 24}hrs de retraso)</div>`;
  }
}

// ════════════════════════════════════════════
// DASHBOARD — SWITCH TABS
// ════════════════════════════════════════════
let dashTabActual = 'marketing';
let dashMesVentasSeleccionado = null;

function switchDashTab(tab) {
  dashTabActual = tab;
  document.getElementById('dash-marketing').style.display = tab === 'marketing' ? '' : 'none';
  document.getElementById('dash-ventas').style.display    = tab === 'ventas'    ? '' : 'none';
  const btnMkt = document.getElementById('dash-tab-mkt');
  const btnVta = document.getElementById('dash-tab-vta');
  if (tab === 'marketing') {
    btnMkt.style.background = 'var(--naranja)'; btnMkt.style.color = '#fff';
    btnVta.style.background = 'transparent';    btnVta.style.color = 'var(--gris-500)';
    renderDashboard();
  } else {
    btnVta.style.background = 'var(--verde)'; btnVta.style.color = '#fff';
    btnMkt.style.background = 'transparent';  btnMkt.style.color = 'var(--gris-500)';
    renderDashVentas();
  }
}

// ════════════════════════════════════════════
// DASHBOARD VENTAS
// ════════════════════════════════════════════
function getMesesConLeads() {
  const meses = new Set();
  state.leads.forEach(l => {
    const fecha = l.fechaInstalacionReal || l.fechaContrato || l.fechaAlta;
    if (fecha) meses.add(fecha.slice(0,7));
  });
  if (!meses.size) meses.add(new Date().toISOString().slice(0,7));
  return [...meses].sort();
}

function navMesVentas(dir) {
  const meses = getMesesConLeads();
  const idx = meses.indexOf(dashMesVentasSeleccionado);
  const newIdx = Math.max(0, Math.min(meses.length - 1, idx + dir));
  dashMesVentasSeleccionado = meses[newIdx];
  document.getElementById('dash-mes-ventas').value = dashMesVentasSeleccionado;
  renderDashVentas();
}

function renderDashVentas() {
  const meses = getMesesConLeads();
  if (!dashMesVentasSeleccionado || !meses.includes(dashMesVentasSeleccionado)) {
    dashMesVentasSeleccionado = meses[meses.length - 1];
  }

  // Poblar dropdown
  const sel = document.getElementById('dash-mes-ventas');
  sel.innerHTML = '';
  meses.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = labelMes(m);
    sel.appendChild(opt);
  });
  sel.value = dashMesVentasSeleccionado;

  // Flechas extremos
  const btns = document.querySelectorAll('#dash-ventas-content .btn-ghost');
  if (btns[0]) btns[0].disabled = meses.indexOf(dashMesVentasSeleccionado) === 0;
  if (btns[1]) btns[1].disabled = meses.indexOf(dashMesVentasSeleccionado) === meses.length - 1;

  const mes = dashMesVentasSeleccionado;

  // Filtrar leads del mes por fecha relevante
  const leadsDelMes = state.leads.filter(l => {
    const fecha = l.fechaInstalacionReal || l.fechaContrato || l.fechaAlta;
    return fecha && fecha.slice(0,7) === mes;
  });

  const instalados  = leadsDelMes.filter(l => l.estado === 'instalado');
  const contratos   = leadsDelMes.filter(l => l.estado === 'contrato');
  const cancelados  = leadsDelMes.filter(l => l.estado === 'cancelado');

  const mrrReal     = instalados.reduce((a, l) => a + (l.precio || 0), 0);
  const mrrPrevisto = contratos.reduce((a, l)  => a + (l.precio || 0), 0) + mrrReal;
  const mrrCancelado= cancelados.reduce((a, l) => a + (l.precio || 0), 0);
  const mrrDiff     = mrrPrevisto > 0 ? Math.round((mrrReal / mrrPrevisto) * 100) : 0;

  // HULUX 24
  const conGap      = instalados.filter(l => l.gapInstalacionHoras !== null && l.gapInstalacionHoras !== undefined);
  const cumplieron  = conGap.filter(l => l.gapInstalacionHoras <= 24);
  const tasaH24     = conGap.length > 0 ? Math.round(cumplieron.length / conGap.length * 100) : null;
  const gapPromedio = conGap.length > 0 ? Math.round(conGap.reduce((a,l) => a + l.gapInstalacionHoras, 0) / conGap.length) : null;

  // Por agente
  const porAgente = {};
  leadsDelMes.forEach(l => {
    const ag = l.agente || 'Sin asignar';
    if (!porAgente[ag]) porAgente[ag] = { leads:0, contratos:0, instalados:0, cancelados:0, mrr:0 };
    porAgente[ag].leads++;
    if (l.estado === 'contrato')  porAgente[ag].contratos++;
    if (l.estado === 'instalado') { porAgente[ag].instalados++; porAgente[ag].mrr += l.precio || 0; }
    if (l.estado === 'cancelado') porAgente[ag].cancelados++;
  });

  // Por canal
  const porCanal = {};
  instalados.forEach(l => {
    const c = l.canal || 'Sin canal';
    if (!porCanal[c]) porCanal[c] = { count:0, mrr:0 };
    porCanal[c].count++; porCanal[c].mrr += l.precio || 0;
  });

  // Por paquete
  const porPaquete = {};
  instalados.forEach(l => {
    const p = l.paquete || 'Sin paquete';
    if (!porPaquete[p]) porPaquete[p] = { count:0, mrr:0 };
    porPaquete[p].count++; porPaquete[p].mrr += l.precio || 0;
  });

  // Por causa cancelación
  const porCausa = {};
  cancelados.forEach(l => {
    const c = l.causaCancelacion || 'Sin causa';
    if (!porCausa[c]) porCausa[c] = { count:0, mrr:0 };
    porCausa[c].count++; porCausa[c].mrr += l.precio || 0;
  });

  const wrap = document.getElementById('dash-ventas-kpis');

  wrap.innerHTML = `
    <!-- KPIs principales -->
    <div style="font-size:12px;font-weight:700;color:var(--gris-500);text-transform:uppercase;letter-spacing:0.7px;margin-bottom:10px;">
      Consolidado · ${labelMes(mes)}
    </div>

    <!-- MRR Previsto vs Real -->
    <div class="kpi-grid" style="margin-bottom:14px;">
      <div class="kpi-card">
        <div class="kpi-label">MRR Real</div>
        <div class="kpi-value big" style="color:var(--verde);">${mrrReal > 0 ? fmtMXN(mrrReal) : '—'}</div>
        <div class="kpi-sub">${instalados.length} clientes instalados</div>
        <div class="kpi-delta ${mrrDiff >= 80 ? 'up' : mrrDiff >= 50 ? 'neutral' : 'down'}">${mrrDiff}% del previsto</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">MRR Previsto</div>
        <div class="kpi-value big" style="color:#7C3AED;">${mrrPrevisto > 0 ? fmtMXN(mrrPrevisto) : '—'}</div>
        <div class="kpi-sub">${contratos.length + instalados.length} contratos totales</div>
        <div class="kpi-delta neutral">Diferencia: ${fmtMXN(mrrPrevisto - mrrReal)}</div>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--rojo)">
        <div class="kpi-label">MRR Cancelado</div>
        <div class="kpi-value big" style="color:var(--rojo);">${mrrCancelado > 0 ? fmtMXN(mrrCancelado) : '—'}</div>
        <div class="kpi-sub">${cancelados.length} cancelaciones</div>
        <div class="kpi-delta ${cancelados.length === 0 ? 'up' : 'down'}">${mrrPrevisto > 0 ? Math.round(mrrCancelado/mrrPrevisto*100) : 0}% del previsto perdido</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">HULUX 24</div>
        <div class="kpi-value big" style="color:${tasaH24 === null ? 'var(--gris-300)' : tasaH24 >= 80 ? 'var(--verde)' : 'var(--rojo)'};">${tasaH24 !== null ? tasaH24 + '%' : '—'}</div>
        <div class="kpi-sub">instalaciones a tiempo</div>
        <div class="kpi-delta ${tasaH24 === null ? 'neutral' : tasaH24 >= 80 ? 'up' : 'down'}">${gapPromedio !== null ? 'Gap promedio: ' + gapPromedio + 'hrs' : 'Sin datos'}</div>
      </div>
    </div>


    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      <div class="card"><div class="card-title">👤 Por agente vendedor</div><div id="dash-ventas-agentes"></div></div>
      <div class="card"><div class="card-title">📡 Cierres por canal</div><div id="dash-ventas-canal"></div></div>
      <div class="card"><div class="card-title">📦 Paquetes más vendidos</div><div id="dash-ventas-paquete"></div></div>
      <div class="card"><div class="card-title">❌ Cancelados por causa</div><div id="dash-ventas-causa"></div></div>
    </div>
    <div class="card">
      <div class="card-title">✅ Detalle de instalaciones del mes</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Cliente</th><th>Sucursal</th><th>Agente</th><th>Canal</th><th>Paquete</th><th>MRR</th><th>Prog.</th><th>Real</th><th>Gap</th><th>HULUX 24</th></tr></thead>
        <tbody id="dash-ventas-tabla"></tbody>
      </table></div>
    </div>
  `;

  // ── Agente ──────────────────────────────
  const wAgente = document.getElementById('dash-ventas-agentes');
  if (!Object.keys(porAgente).length) {
    wAgente.innerHTML = '<div style="color:var(--gris-400);font-size:13px;">Sin datos</div>';
  } else {
    let h = '<div style="display:grid;grid-template-columns:1fr 40px 40px 40px 72px;gap:6px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #F0F0F0;"><div style="font-size:10px;font-weight:700;color:var(--gris-500);text-transform:uppercase;">Agente</div><div style="font-size:10px;font-weight:700;color:var(--gris-500);text-align:center;">L</div><div style="font-size:10px;font-weight:700;color:var(--verde);text-align:center;">✅</div><div style="font-size:10px;font-weight:700;color:var(--rojo);text-align:center;">❌</div><div style="font-size:10px;font-weight:700;color:#7C3AED;text-align:right;">MRR</div></div>';
    Object.entries(porAgente).sort((a,b) => b[1].mrr - a[1].mrr).forEach(([ag, d]) => {
      h += '<div style="display:grid;grid-template-columns:1fr 40px 40px 40px 72px;gap:6px;padding:5px 0;border-bottom:1px solid #FAFAFA;align-items:center;"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + ag + '</div><div style="font-size:12px;text-align:center;color:var(--gris-500);">' + d.leads + '</div><div style="font-size:12px;text-align:center;font-weight:700;color:var(--verde);">' + d.instalados + '</div><div style="font-size:12px;text-align:center;font-weight:700;color:var(--rojo);">' + d.cancelados + '</div><div style="font-size:12px;text-align:right;font-weight:700;color:#7C3AED;">' + (d.mrr > 0 ? fmtMXN(d.mrr) : '—') + '</div></div>';
    });
    wAgente.innerHTML = h;
  }

  // ── Canal ────────────────────────────────
  const wCanal = document.getElementById('dash-ventas-canal');
  if (!Object.keys(porCanal).length) {
    wCanal.innerHTML = '<div style="color:var(--gris-400);font-size:13px;">Sin instalaciones registradas</div>';
  } else {
    const maxMrr = Math.max(...Object.values(porCanal).map(x => x.mrr), 1);
    let h = '';
    Object.entries(porCanal).sort((a,b) => b[1].mrr - a[1].mrr).forEach(([canal, d]) => {
      h += '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span style="font-weight:600;">' + canal + '</span><span style="color:#7C3AED;font-weight:700;">' + fmtMXN(d.mrr) + ' · ' + d.count + '</span></div><div style="height:8px;background:var(--gris-100);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + Math.round(d.mrr/maxMrr*100) + '%;background:var(--verde);border-radius:4px;"></div></div></div>';
    });
    wCanal.innerHTML = h;
  }

  // ── Paquete ──────────────────────────────
  const wPaq = document.getElementById('dash-ventas-paquete');
  if (!Object.keys(porPaquete).length) {
    wPaq.innerHTML = '<div style="color:var(--gris-400);font-size:13px;">Sin instalaciones</div>';
  } else {
    const maxC = Math.max(...Object.values(porPaquete).map(x => x.count), 1);
    let h = '';
    Object.entries(porPaquete).sort((a,b) => b[1].count - a[1].count).forEach(([paq, d]) => {
      h += '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span style="font-weight:600;">' + paq + '</span><span style="color:var(--naranja-deep);font-weight:700;">' + d.count + ' ventas · ' + fmtMXN(d.mrr) + '</span></div><div style="height:8px;background:var(--gris-100);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + Math.round(d.count/maxC*100) + '%;background:var(--naranja);border-radius:4px;"></div></div></div>';
    });
    wPaq.innerHTML = h;
  }

  // ── Causa cancelación ────────────────────
  const wCausa = document.getElementById('dash-ventas-causa');
  if (!Object.keys(porCausa).length) {
    wCausa.innerHTML = '<div style="color:var(--gris-400);font-size:13px;">Sin cancelaciones este mes 🎉</div>';
  } else {
    let h = '<div style="display:grid;grid-template-columns:1fr 36px 72px;gap:6px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #F0F0F0;"><div style="font-size:10px;font-weight:700;color:var(--gris-500);text-transform:uppercase;">Causa</div><div style="font-size:10px;font-weight:700;color:var(--gris-500);text-align:center;">#</div><div style="font-size:10px;font-weight:700;color:var(--rojo);text-align:right;">MRR perdido</div></div>';
    Object.entries(porCausa).sort((a,b) => b[1].mrr - a[1].mrr).forEach(([causa, d]) => {
      h += '<div style="display:grid;grid-template-columns:1fr 36px 72px;gap:6px;padding:5px 0;border-bottom:1px solid #FAFAFA;align-items:center;"><div style="font-size:12px;font-weight:500;">' + causa + '</div><div style="font-size:12px;text-align:center;font-weight:700;color:var(--rojo);">' + d.count + '</div><div style="font-size:12px;text-align:right;font-weight:700;color:var(--rojo);">' + (d.mrr > 0 ? fmtMXN(d.mrr) : '—') + '</div></div>';
    });
    wCausa.innerHTML = h;
  }

  // ── Tabla instalados ─────────────────────
  const tbody = document.getElementById('dash-ventas-tabla');
  if (!instalados.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--gris-400);padding:24px;">Sin instalaciones este mes</td></tr>';
  } else {
    tbody.innerHTML = instalados.map(l => {
      const gap = l.gapInstalacionHoras;
      const cumple = gap !== null && gap !== undefined && gap <= 24;
      const gapColor = gap > 24 ? 'var(--rojo)' : (gap <= 24 ? 'var(--verde)' : 'var(--gris-400)');
      return '<tr><td style="font-weight:600;font-size:13px;">' + l.nombre + '</td><td style="font-size:12px;">' + (l.sucursal||'—') + '</td><td style="font-size:12px;">' + (l.agente||'—') + '</td><td style="font-size:11px;color:var(--gris-500);">' + (l.canal||'—') + '</td><td style="font-size:12px;">' + (l.paquete||'—') + '</td><td class="td-mono" style="color:#7C3AED;">' + fmtMXN(l.precio) + '</td><td style="font-size:12px;">' + (l.fechaInstalacion||'—') + '</td><td style="font-size:12px;">' + (l.fechaInstalacionReal||'—') + '</td><td class="td-mono" style="font-size:12px;color:' + gapColor + ';">' + (gap !== null && gap !== undefined ? gap+'hrs' : '—') + '</td><td style="text-align:center;">' + (gap !== null && gap !== undefined ? (cumple ? '✅' : '❌') : '—') + '</td></tr>';
    }).join('');
  }
}


(async () => {
  const hoy = new Date();
  document.getElementById('header-fecha').textContent =
    hoy.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  await cargarState();
  renderCampanas();

  // Revisión periódica de alertas cada 5 minutos
  setInterval(() => {
    const hayAlertas = state.leads.some(l => alertaReloj(l));
    if (hayAlertas) renderPipeline();
  }, 5 * 60 * 1000);
})();