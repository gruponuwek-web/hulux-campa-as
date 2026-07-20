// ════════════════════════════════════════════
// AJUSTES — Catálogos vivos
// Escrito desde cero con DOM puro
// ════════════════════════════════════════════

// ── Variables de estado local ────────────────
var ajusteTipoActual = null;
var ajusteIdxActual  = null;

// ── Categorías disponibles ───────────────────
var AJUSTE_CATS = {
  agentes:     { label: 'Agentes vendedores', icon: '👤', conPrecio: false },
  sucursales:  { label: 'Sucursales',         icon: '🏢', conPrecio: false },
  paquetes:    { label: 'Paquetes',           icon: '📦', conPrecio: true  },
  promociones: { label: 'Promociones',        icon: '🎁', conPrecio: false },
};

// ── Garantizar estructura del state ──────────
function ajustesInit() {
  if (!state.catalogos) state.catalogos = {};
  Object.keys(AJUSTE_CATS).forEach(function(k) {
    if (!Array.isArray(state.catalogos[k])) state.catalogos[k] = [];
  });
}

// ════════════════════════════════════════════
// RENDER PRINCIPAL
// ════════════════════════════════════════════
function renderAjustes() {
  ajustesInit();

  var wrap = document.getElementById('ajustes-contenido');
  if (!wrap) return;
  wrap.innerHTML = '';

  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;';

  Object.keys(AJUSTE_CATS).forEach(function(tipo) {
    grid.appendChild(crearSeccionAjuste(tipo));
  });

  wrap.appendChild(grid);
}

function crearSeccionAjuste(tipo) {
  var cat   = AJUSTE_CATS[tipo];
  var items = state.catalogos[tipo] || [];

  // Card contenedor
  var card = document.createElement('div');
  card.className = 'card';
  card.style.minHeight = '160px';

  // Header de la card
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';

  var titulo = document.createElement('div');
  titulo.className = 'card-title';
  titulo.style.marginBottom = '0';
  titulo.textContent = cat.icon + ' ' + cat.label.toUpperCase();

  var btnAgregar = document.createElement('button');
  btnAgregar.textContent = '+ Agregar';
  btnAgregar.style.cssText = 'padding:6px 14px;border-radius:8px;border:2px solid var(--naranja);background:transparent;color:var(--naranja);font-family:Inter,sans-serif;font-size:12px;font-weight:700;cursor:pointer;';
  btnAgregar.addEventListener('mouseover', function() { this.style.background = 'var(--naranja-light)'; });
  btnAgregar.addEventListener('mouseout',  function() { this.style.background = 'transparent'; });
  btnAgregar.addEventListener('click', function() { abrirAjusteModal(tipo, null); });

  header.appendChild(titulo);
  header.appendChild(btnAgregar);
  card.appendChild(header);

  // Lista de items
  var lista = document.createElement('div');
  lista.id = 'ajuste-lista-' + tipo;
  renderListaAjuste(lista, tipo, items, cat.conPrecio);
  card.appendChild(lista);

  return card;
}

function renderListaAjuste(lista, tipo, items, conPrecio) {
  lista.innerHTML = '';

  if (!items || items.length === 0) {
    var vacio = document.createElement('p');
    vacio.style.cssText = 'font-size:13px;color:#AAAAAA;padding:4px 0;';
    vacio.textContent = 'Sin elementos. Agrega el primero.';
    lista.appendChild(vacio);
    return;
  }

  items.forEach(function(item, idx) {
    var fila = document.createElement('div');
    fila.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F5F5F5;';

    // Info
    var info = document.createElement('div');

    var nombre = document.createElement('div');
    nombre.style.cssText = 'font-size:13px;font-weight:500;color:#0F0F0F;';
    nombre.textContent = item.nombre || '—';
    info.appendChild(nombre);

    if (conPrecio && item.precio) {
      var precio = document.createElement('div');
      precio.style.cssText = 'font-size:11px;color:#666666;margin-top:1px;';
      precio.textContent = fmtMXN(item.precio) + ' / mes';
      info.appendChild(precio);
    }

    // Acciones
    var acciones = document.createElement('div');
    acciones.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

    var btnEdit = document.createElement('button');
    btnEdit.textContent = 'Editar';
    btnEdit.style.cssText = 'padding:4px 10px;border-radius:6px;border:1.5px solid #E0E0E0;background:transparent;font-family:Inter,sans-serif;font-size:11px;font-weight:500;cursor:pointer;color:#333;';
    btnEdit.addEventListener('click', function() { abrirAjusteModal(tipo, idx); });

    var btnDel = document.createElement('button');
    btnDel.textContent = '×';
    btnDel.style.cssText = 'padding:4px 9px;border-radius:6px;border:1.5px solid #FFCDD2;background:transparent;font-family:Inter,sans-serif;font-size:13px;font-weight:700;cursor:pointer;color:#EF4444;';
    btnDel.addEventListener('click', function() { eliminarAjuste(tipo, idx); });

    acciones.appendChild(btnEdit);
    acciones.appendChild(btnDel);

    fila.appendChild(info);
    fila.appendChild(acciones);
    lista.appendChild(fila);
  });
}

// ════════════════════════════════════════════
// MODAL AGREGAR / EDITAR
// ════════════════════════════════════════════
function abrirAjusteModal(tipo, idx) {
  ajustesInit();
  ajusteTipoActual = tipo;
  ajusteIdxActual  = idx;

  var cat     = AJUSTE_CATS[tipo];
  var esEditar = idx !== null && idx !== undefined;
  var item    = esEditar ? (state.catalogos[tipo][idx] || {}) : {};

  // Título
  document.getElementById('ajuste-modal-titulo').textContent =
    (esEditar ? 'Editar ' : 'Agregar ') + cat.label.toLowerCase();

  // Campo nombre
  var inputNombre = document.getElementById('ajuste-input-nombre');
  inputNombre.value = item.nombre || '';
  inputNombre.placeholder = 'Nombre de ' + cat.label.toLowerCase().slice(0,-1);

  // Campo precio (solo paquetes)
  var wrapPrecio = document.getElementById('ajuste-wrap-precio');
  var inputPrecio = document.getElementById('ajuste-input-precio');
  wrapPrecio.style.display = cat.conPrecio ? '' : 'none';
  inputPrecio.value = item.precio || '';

  // Abrir modal
  document.getElementById('modal-ajustes').classList.add('open');

  // Focus
  setTimeout(function() { inputNombre.focus(); }, 100);
}

function cerrarAjusteModal() {
  document.getElementById('modal-ajustes').classList.remove('open');
  ajusteTipoActual = null;
  ajusteIdxActual  = null;
}

function guardarAjuste() {
  ajustesInit();

  var nombre = (document.getElementById('ajuste-input-nombre').value || '').trim();
  if (!nombre) {
    document.getElementById('ajuste-input-nombre').style.borderColor = 'var(--rojo)';
    setTimeout(function() {
      document.getElementById('ajuste-input-nombre').style.borderColor = '';
    }, 1500);
    return;
  }

  var precio = parseFloat(document.getElementById('ajuste-input-precio').value) || 0;
  var cat    = AJUSTE_CATS[ajusteTipoActual];

  var item = { nombre: nombre };
  if (cat.conPrecio && precio > 0) item.precio = precio;

  if (ajusteIdxActual !== null && ajusteIdxActual !== undefined) {
    // Editar existente — preservar id
    var old = state.catalogos[ajusteTipoActual][ajusteIdxActual] || {};
    item.id = old.id || uid();
    state.catalogos[ajusteTipoActual][ajusteIdxActual] = item;
  } else {
    // Nuevo
    item.id = uid();
    state.catalogos[ajusteTipoActual].push(item);
  }

  guardarStateLocal();
  if (gsOnline) gs('saveCatalogos', state.catalogos);

  cerrarAjusteModal();
  renderAjustes();
}

function eliminarAjuste(tipo, idx) {
  if (!confirm('¿Eliminar este elemento? Esta acción no se puede deshacer.')) return;
  ajustesInit();
  state.catalogos[tipo].splice(idx, 1);
  guardarStateLocal();
  if (gsOnline) gs('saveCatalogos', state.catalogos);
  renderAjustes();
}

// ════════════════════════════════════════════
// POBLAR SELECTS (usado por pipeline y reportes)
// ════════════════════════════════════════════
function poblarSelect(selectId, items, placeholder) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  var current = sel.value;
  sel.innerHTML = '';

  var opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = placeholder || 'Selecciona...';
  sel.appendChild(opt0);

  (items || []).forEach(function(item) {
    var opt = document.createElement('option');
    opt.value = item.nombre;
    opt.textContent = item.nombre + (item.precio ? ' · ' + fmtMXN(item.precio) : '');
    sel.appendChild(opt);
  });

  if (current) sel.value = current;
}
