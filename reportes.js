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

