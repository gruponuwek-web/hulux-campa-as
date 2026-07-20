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

