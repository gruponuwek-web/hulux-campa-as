// ════════════════════════════════════════════
// CONFIGURACIÓN — Catálogos vivos
// ════════════════════════════════════════════

let catalogoTipoActual = null;
let catalogoIdxActual  = null;

function asegurarCatalogos() {
  if (!state.catalogos)              state.catalogos  = {};
  if (!state.catalogos.agentes)      state.catalogos.agentes     = [];
  if (!state.catalogos.sucursales)   state.catalogos.sucursales  = [];
  if (!state.catalogos.paquetes)     state.catalogos.paquetes    = [];
  if (!state.catalogos.promociones)  state.catalogos.promociones = [];
}

// ── Render principal ──────────────────────────
function renderConfig() {
  asegurarCatalogos();
  renderListaCatalogo('agentes',    'lista-agentes');
  renderListaCatalogo('sucursales', 'lista-sucursales');
  renderListaCatalogo('paquetes',   'lista-paquetes');
  renderListaCatalogo('promociones','lista-promociones');
}

function renderListaCatalogo(tipo, contenedorId) {
  const wrap = document.getElementById(contenedorId);
  if (!wrap) return;
  const items = (state.catalogos && state.catalogos[tipo]) || [];

  if (items.length === 0) {
    wrap.innerHTML = '<p style="font-size:13px;color:#AAAAAA;padding:8px 0;">Sin elementos. Agrega el primero.</p>';
    return;
  }

  wrap.innerHTML = '';
  items.forEach(function(item, idx) {
    const div = document.createElement('div');
    div.className = 'catalogo-item';

    const info = document.createElement('div');
    const nombre = document.createElement('div');
    nombre.className = 'catalogo-item-nombre';
    nombre.textContent = item.nombre;
    info.appendChild(nombre);

    if (item.precio) {
      const sub = document.createElement('div');
      sub.className = 'catalogo-item-sub';
      sub.textContent = fmtMXN(item.precio) + ' / mes';
      info.appendChild(sub);
    }

    const acciones = document.createElement('div');
    acciones.style.cssText = 'display:flex;gap:6px;';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn btn-ghost';
    btnEdit.style.cssText = 'padding:4px 10px;font-size:11px;';
    btnEdit.textContent = 'Editar';
    btnEdit.onclick = function() { editarCatalogo(tipo, idx); };

    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-danger';
    btnDel.style.cssText = 'padding:4px 10px;font-size:11px;';
    btnDel.textContent = '×';
    btnDel.onclick = function() { eliminarCatalogo(tipo, idx); };

    acciones.appendChild(btnEdit);
    acciones.appendChild(btnDel);
    div.appendChild(info);
    div.appendChild(acciones);
    wrap.appendChild(div);
  });
}

// ── Poblar selects con catálogos ──────────────
function poblarSelect(selectId, items, placeholder) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = placeholder;
  sel.appendChild(opt0);
  (items || []).forEach(function(item) {
    const opt = document.createElement('option');
    opt.value = item.nombre;
    opt.textContent = item.nombre + (item.precio ? ' · ' + fmtMXN(item.precio) : '');
    sel.appendChild(opt);
  });
  sel.value = current;
}

// ── Modal agregar / editar ────────────────────
function agregarCatalogo(tipo) {
  asegurarCatalogos();
  catalogoTipoActual = tipo;
  catalogoIdxActual  = null;

  var labels = { agentes:'Nombre del agente', sucursales:'Nombre de la sucursal', paquetes:'Nombre del paquete', promociones:'Nombre de la promoción' };
  var titles = { agentes:'Agregar agente', sucursales:'Agregar sucursal', paquetes:'Agregar paquete', promociones:'Agregar promoción' };

  document.getElementById('modal-catalogo-title').textContent = titles[tipo] || 'Agregar';
  document.getElementById('catalogo-label').textContent = labels[tipo] || 'Nombre';
  document.getElementById('catalogo-input').value = '';
  document.getElementById('catalogo-extra').value = '';
  document.getElementById('catalogo-extra-wrap').style.display = tipo === 'paquetes' ? '' : 'none';
  abrirModal('modal-catalogo');
}

function editarCatalogo(tipo, idx) {
  asegurarCatalogos();
  catalogoTipoActual = tipo;
  catalogoIdxActual  = idx;

  var item = state.catalogos[tipo][idx];
  var labels = { agentes:'Nombre del agente', sucursales:'Nombre de la sucursal', paquetes:'Nombre del paquete', promociones:'Nombre de la promoción' };
  var titles = { agentes:'Editar agente', sucursales:'Editar sucursal', paquetes:'Editar paquete', promociones:'Editar promoción' };

  document.getElementById('modal-catalogo-title').textContent = titles[tipo] || 'Editar';
  document.getElementById('catalogo-label').textContent = labels[tipo] || 'Nombre';
  document.getElementById('catalogo-input').value = item.nombre || '';
  document.getElementById('catalogo-extra').value = item.precio || '';
  document.getElementById('catalogo-extra-wrap').style.display = tipo === 'paquetes' ? '' : 'none';
  abrirModal('modal-catalogo');
}

function guardarCatalogo() {
  var nombre = document.getElementById('catalogo-input').value.trim();
  if (!nombre) { alert('Escribe un nombre.'); return; }

  var precio = parseFloat(document.getElementById('catalogo-extra').value) || 0;
  var item = { id: uid(), nombre: nombre };
  if (catalogoTipoActual === 'paquetes' && precio > 0) item.precio = precio;

  asegurarCatalogos();

  if (catalogoIdxActual !== null) {
    var existing = state.catalogos[catalogoTipoActual][catalogoIdxActual];
    state.catalogos[catalogoTipoActual][catalogoIdxActual] = Object.assign({}, existing, item);
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
  asegurarCatalogos();
  state.catalogos[tipo].splice(idx, 1);
  guardarStateLocal();
  renderConfig();
  if (gsOnline) gs('saveCatalogos', state.catalogos);
}
