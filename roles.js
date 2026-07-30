// ════════════════════════════════════════════
// ROLES — Selección de área de trabajo
// ════════════════════════════════════════════

var rolActual = null; // 'marketing' | 'ventas'

function iniciarPortal() {
  // Revisar si hay rol guardado
  var rolGuardado = localStorage.getItem('hulux_rol');
  if (rolGuardado) {
    seleccionarRol(rolGuardado, true);
  } else {
    mostrarPantallaRol();
  }
}

function mostrarPantallaRol() {
  document.getElementById('pantalla-rol').style.display = 'flex';
  document.getElementById('main-header').style.display = 'none';
  document.getElementById('nav-marketing').style.display = 'none';
  document.getElementById('nav-ventas').style.display = 'none';
  // Ocultar todas las pantallas
  document.querySelectorAll('.screen').forEach(function(s) { s.style.display = 'none'; });
}

function seleccionarRol(rol, sinAnimacion) {
  rolActual = rol;
  localStorage.setItem('hulux_rol', rol);

  // Ocultar pantalla de selección
  document.getElementById('pantalla-rol').style.display = 'none';

  // Mostrar header
  var header = document.getElementById('main-header');
  header.style.display = 'flex';

  // Badge del header
  var badge = document.getElementById('header-rol-badge');
  if (rol === 'marketing') {
    badge.textContent = 'Marketing';
    badge.style.background = 'rgba(242,101,34,0.15)';
    badge.style.borderColor = 'var(--naranja)';
    badge.style.color = 'var(--naranja)';
  } else {
    badge.textContent = 'Ventas';
    badge.style.background = 'rgba(34,197,94,0.15)';
    badge.style.borderColor = 'var(--verde)';
    badge.style.color = 'var(--verde)';
  }

  // Mostrar el nav correcto
  document.getElementById('nav-marketing').style.display = rol === 'marketing' ? 'flex' : 'none';
  document.getElementById('nav-ventas').style.display   = rol === 'ventas'    ? 'flex' : 'none';

  // Mostrar pantallas y activar la primera del rol
  document.querySelectorAll('.screen').forEach(function(s) { s.style.display = ''; });

  if (rol === 'marketing') {
    showScreen('campanas');
  } else {
    showScreen('pipeline');
  }

  // Actualizar badges de alerta
  actualizarBadgesAlerta();
}

function volverSeleccionRol() {
  localStorage.removeItem('hulux_rol');
  rolActual = null;
  mostrarPantallaRol();
}

// ════════════════════════════════════════════
// BADGES DE ALERTA EN EL NAV
// ════════════════════════════════════════════
function actualizarBadgesAlerta() {
  var alertas = state.leads.filter(function(l) {
    if (l.estado === 'contrato') {
      var a = alertaReloj(l);
      return a !== null;
    }
    if (l.estado === 'negociacion') {
      var d = diasDesde(l.fechaAlta);
      return d !== null && d >= 2;
    }
    return false;
  });

  var n = alertas.length;

  // Badge en nav marketing
  var bMkt = document.getElementById('badge-pipeline-mkt');
  if (bMkt) {
    bMkt.style.display = n > 0 ? 'inline' : 'none';
    bMkt.textContent = n;
  }

  // Badge en nav ventas
  var bVta = document.getElementById('badge-pipeline-vta');
  if (bVta) {
    bVta.style.display = n > 0 ? 'inline' : 'none';
    bVta.textContent = n;
  }
}

// ════════════════════════════════════════════
// HISTORIAL DE ESTADOS
// ════════════════════════════════════════════
var ESTADO_LABELS = {
  negociacion: { icon: '🤝', label: 'En negociación', color: 'var(--naranja-deep)' },
  contrato:    { icon: '📄', label: 'Contrato firmado', color: '#5B21B6' },
  instalado:   { icon: '✅', label: 'Instalado', color: 'var(--verde)' },
  cancelado:   { icon: '❌', label: 'Cancelado', color: 'var(--rojo)' },
};

function registrarHistorial(lead, estadoNuevo) {
  if (!lead.historial) lead.historial = [];
  var entrada = {
    estado: estadoNuevo,
    fecha:  new Date().toISOString().slice(0, 16).replace('T', ' '),
    de:     lead.estado || 'negociacion',
  };
  lead.historial.push(entrada);

  // Sincronizar con Sheets
  if (gsOnline) {
    gs('saveHistorial', {
      leadId:   lead.id,
      nombre:   lead.nombre,
      de:       entrada.de,
      a:        estadoNuevo,
      fecha:    entrada.fecha,
    });
  }
  return lead;
}

function renderHistorial(lead) {
  var seccion = document.getElementById('seccion-historial');
  var timeline = document.getElementById('historial-timeline');

  if (!lead || !lead.historial || !lead.historial.length) {
    seccion.style.display = 'none';
    return;
  }

  seccion.style.display = '';
  timeline.innerHTML = '';

  lead.historial.forEach(function(h, idx) {
    var cfg = ESTADO_LABELS[h.a] || { icon: '→', label: h.a, color: 'var(--gris-500)' };
    var cfgDe = ESTADO_LABELS[h.de] || { icon: '·', label: h.de, color: 'var(--gris-400)' };

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:6px 0;' + (idx < lead.historial.length - 1 ? 'border-bottom:1px solid #F5F5F5;' : '');

    // Dot
    var dot = document.createElement('div');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:' + cfg.color + ';margin-top:4px;flex-shrink:0;';

    // Info
    var info = document.createElement('div');
    info.style.flex = '1';

    var cambio = document.createElement('div');
    cambio.style.cssText = 'font-size:12px;font-weight:600;color:var(--negro);';
    cambio.textContent = cfgDe.label + ' → ' + cfg.label;

    var fecha = document.createElement('div');
    fecha.style.cssText = 'font-size:11px;color:var(--gris-500);margin-top:1px;';
    fecha.textContent = h.fecha;

    info.appendChild(cambio);
    info.appendChild(fecha);
    row.appendChild(dot);
    row.appendChild(info);
    timeline.appendChild(row);
  });
}

// ════════════════════════════════════════════
// ACTUALIZAR showScreen PARA BADGES
// ════════════════════════════════════════════
var _showScreenOriginal = showScreen;
showScreen = function(id) {
  _showScreenOriginal(id);
  actualizarBadgesAlerta();
};
