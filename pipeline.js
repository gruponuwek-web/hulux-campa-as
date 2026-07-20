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

