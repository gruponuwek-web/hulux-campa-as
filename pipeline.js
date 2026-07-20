// ════════════════════════════════════════════
// PIPELINE — UTILIDADES
// ════════════════════════════════════════════
var vistaPipeline = 'lista'; // 'lista' | 'kanban'

function switchVistaPipeline(vista) {
  vistaPipeline = vista;
  var btnLista  = document.getElementById('btn-vista-lista');
  var btnKanban = document.getElementById('btn-vista-kanban');
  var vistaL    = document.getElementById('pipeline-vista-lista');
  var vistaK    = document.getElementById('pipeline-vista-kanban');

  if (vista === 'lista') {
    btnLista.style.background  = 'var(--blanco)';
    btnLista.style.color       = 'var(--negro)';
    btnLista.style.boxShadow   = '0 1px 3px rgba(0,0,0,0.1)';
    btnKanban.style.background = 'transparent';
    btnKanban.style.color      = 'var(--gris-500)';
    btnKanban.style.boxShadow  = 'none';
    vistaL.style.display = '';
    vistaK.style.display = 'none';
  } else {
    btnKanban.style.background = 'var(--blanco)';
    btnKanban.style.color      = 'var(--negro)';
    btnKanban.style.boxShadow  = '0 1px 3px rgba(0,0,0,0.1)';
    btnLista.style.background  = 'transparent';
    btnLista.style.color       = 'var(--gris-500)';
    btnLista.style.boxShadow   = 'none';
    vistaL.style.display = 'none';
    vistaK.style.display = '';
  }
  renderPipeline();
}

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

  // ── Render Kanban ────────────────────────────
  renderKanban(leads);
}

function renderKanban(leads) {
  var cols = { negociacion: [], contrato: [], instalado: [], cancelado: [] };
  var estadoConfig = {
    negociacion: { label: 'En negociación', color: 'var(--naranja-deep)' },
    contrato:    { label: 'Contrato firmado', color: '#5B21B6' },
    instalado:   { label: 'Instalado', color: '#166534' },
    cancelado:   { label: 'Cancelado', color: '#991B1B' },
  };

  // Usar todos los leads sin filtro de estado
  var todosLeads = state.leads.filter(function(l) {
    var filtroS = document.getElementById('filtro-sucursal-pipe')?.value || '';
    var filtroA = document.getElementById('filtro-agente-pipe')?.value || '';
    if (filtroS && l.sucursal !== filtroS) return false;
    if (filtroA && l.agente   !== filtroA) return false;
    return true;
  });

  todosLeads.forEach(function(l) {
    if (cols[l.estado]) cols[l.estado].push(l);
  });

  var dragLeadId = null; // id del lead que se está arrastrando

  Object.keys(cols).forEach(function(estado) {
    var col = document.getElementById('kanban-' + estado);
    if (!col) return;
    col.innerHTML = '';

    // ── Drop zone ────────────────────────────
    col.addEventListener('dragover', function(e) {
      e.preventDefault();
      col.style.background = 'rgba(242,101,34,0.06)';
      col.style.borderRadius = '8px';
    });
    col.addEventListener('dragleave', function() {
      col.style.background = '';
    });
    col.addEventListener('drop', function(e) {
      e.preventDefault();
      col.style.background = '';
      var id = e.dataTransfer.getData('text/plain');
      if (!id) return;
      var lead = state.leads.find(function(l) { return l.id === id; });
      if (!lead || lead.estado === estado) return;

      // Si es cancelado, pedir causa
      if (estado === 'cancelado' && !lead.causaCancelacion) {
        var causa = prompt('¿Causa de cancelación?\n\n1. Sin instalación a tiempo\n2. Precio\n3. Sin cobertura\n4. Eligió otra empresa\n5. Sin respuesta\n6. Otro\n\nEscribe la causa:');
        if (!causa) return;
        lead.causaCancelacion = causa;
      }

      // Si pasa a contrato, pedir fecha de contrato si no tiene
      if (estado === 'contrato' && !lead.fechaContrato) {
        lead.fechaContrato = new Date().toISOString().slice(0,10);
      }

      // Si pasa a instalado, pedir fecha real si no tiene
      if (estado === 'instalado' && !lead.fechaInstalacionReal) {
        lead.fechaInstalacionReal = new Date().toISOString().slice(0,10);
        lead.gapInstalacionHoras = calcularGapHoras(lead.fechaInstalacion, lead.fechaInstalacionReal);
      }

      lead.estado = estado;
      guardarStateLocal();
      if (gsOnline) gs('saveLead', lead);
      renderPipeline();
    });

    // ── Empty state ──────────────────────────
    if (!cols[estado].length) {
      var empty = document.createElement('div');
      empty.style.cssText = 'font-size:12px;color:var(--gris-400);text-align:center;padding:20px 0;border:2px dashed #E8E8E8;border-radius:8px;';
      empty.textContent = 'Arrastra aquí';
      col.appendChild(empty);
      return;
    }

    // ── Cards ────────────────────────────────
    cols[estado].forEach(function(l) {
      var alerta = alertaReloj(l);
      var dias   = diasDesde(l.fechaAlta);

      var card = document.createElement('div');
      card.setAttribute('draggable', 'true');
      card.setAttribute('data-id', l.id);
      card.style.cssText = 'background:#fff;border:1px solid #E8E8E8;border-radius:10px;padding:12px;cursor:grab;transition:box-shadow 0.15s, opacity 0.15s;user-select:none;' +
        (alerta?.nivel === 'critica' ? 'border-left:3px solid var(--rojo);' :
         alerta?.nivel === 'warn'    ? 'border-left:3px solid var(--amarillo);' :
         dias >= 2 && estado === 'negociacion' ? 'border-left:3px solid var(--amarillo);' : '');

      // Drag events
      card.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', l.id);
        card.style.opacity = '0.4';
        card.style.cursor  = 'grabbing';
      });
      card.addEventListener('dragend', function() {
        card.style.opacity = '1';
        card.style.cursor  = 'grab';
      });

      // Hover + click para editar
      card.addEventListener('mouseover', function() { card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; });
      card.addEventListener('mouseout',  function() { card.style.boxShadow = 'none'; });

      // Nombre
      var nombre = document.createElement('div');
      nombre.style.cssText = 'font-size:13px;font-weight:700;color:var(--negro);margin-bottom:2px;';
      nombre.textContent = l.nombre || '—';
      card.appendChild(nombre);

      // Tel
      if (l.telefono) {
        var tel = document.createElement('div');
        tel.style.cssText = 'font-size:11px;color:var(--gris-500);margin-bottom:6px;';
        tel.textContent = l.telefono;
        card.appendChild(tel);
      }

      // Tags
      var tags = document.createElement('div');
      tags.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;';
      if (l.sucursal) {
        var t1 = document.createElement('span');
        t1.style.cssText = 'font-size:10px;background:var(--gris-100);color:var(--gris-700);padding:2px 7px;border-radius:10px;font-weight:500;';
        t1.textContent = l.sucursal;
        tags.appendChild(t1);
      }
      if (l.agente) {
        var t2 = document.createElement('span');
        t2.style.cssText = 'font-size:10px;background:#EFF6FF;color:#1D4ED8;padding:2px 7px;border-radius:10px;font-weight:500;';
        t2.textContent = l.agente;
        tags.appendChild(t2);
      }
      card.appendChild(tags);

      // Footer
      var footer = document.createElement('div');
      footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';

      var diaEl = document.createElement('span');
      diaEl.style.cssText = 'font-size:11px;font-weight:600;color:' + (dias >= 2 && estado === 'negociacion' ? 'var(--rojo)' : 'var(--gris-500)') + ';';
      diaEl.textContent = dias !== null ? dias + 'd' : '';

      var mrrEl = document.createElement('span');
      mrrEl.style.cssText = 'font-size:12px;font-weight:700;color:#7C3AED;';
      mrrEl.textContent = l.precio ? fmtMXN(l.precio) : '';

      footer.appendChild(diaEl);
      footer.appendChild(mrrEl);
      card.appendChild(footer);

      // Alerta
      if (alerta) {
        var alertaEl = document.createElement('div');
        alertaEl.style.cssText = 'margin-top:6px;font-size:10px;font-weight:700;color:' + (alerta.nivel === 'critica' ? 'var(--rojo)' : '#D97706') + ';';
        alertaEl.textContent = (alerta.nivel === 'critica' ? '🚨 ' : '⚠️ ') + alerta.horas + 'hrs sin instalar';
        card.appendChild(alertaEl);
      }

      // Botón editar pequeño
      var btnEdit = document.createElement('button');
      btnEdit.textContent = 'Editar';
      btnEdit.style.cssText = 'margin-top:8px;width:100%;padding:4px;border-radius:6px;border:1px solid #E0E0E0;background:transparent;font-size:11px;font-weight:500;cursor:pointer;color:var(--gris-500);font-family:Inter,sans-serif;';
      btnEdit.addEventListener('click', function(e) { e.stopPropagation(); abrirModalLead(l.id); });
      card.appendChild(btnEdit);

      col.appendChild(card);
    });
  });
}
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
  document.getElementById('seccion-fecha-real').style.display =
    estado === 'instalado' ? '' : 'none';
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