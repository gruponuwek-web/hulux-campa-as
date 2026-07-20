// ════════════════════════════════════════════
// DASHBOARD VENTAS
// ════════════════════════════════════════════

let dashTabActual = 'marketing';
let dashMesVentasSeleccionado = null;

function switchDashTab(tab) {
  dashTabActual = tab;
  document.getElementById('dash-marketing').style.display = tab === 'marketing' ? '' : 'none';
  document.getElementById('dash-ventas').style.display    = tab === 'ventas'    ? '' : 'none';

  var btnMkt = document.getElementById('dash-tab-mkt');
  var btnVta = document.getElementById('dash-tab-vta');

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

function getMesesConLeads() {
  var meses = {};
  state.leads.forEach(function(l) {
    var fecha = l.fechaInstalacionReal || l.fechaContrato || l.fechaAlta;
    if (fecha) meses[fecha.slice(0,7)] = true;
  });
  var arr = Object.keys(meses).sort();
  if (!arr.length) arr.push(new Date().toISOString().slice(0,7));
  return arr;
}

function navMesVentas(dir) {
  var meses = getMesesConLeads();
  var idx = meses.indexOf(dashMesVentasSeleccionado);
  var newIdx = Math.max(0, Math.min(meses.length - 1, idx + dir));
  dashMesVentasSeleccionado = meses[newIdx];
  document.getElementById('dash-mes-ventas').value = dashMesVentasSeleccionado;
  renderDashVentas();
}

function renderDashVentas() {
  var meses = getMesesConLeads();
  if (!dashMesVentasSeleccionado || meses.indexOf(dashMesVentasSeleccionado) === -1) {
    dashMesVentasSeleccionado = meses[meses.length - 1];
  }

  // Dropdown
  var sel = document.getElementById('dash-mes-ventas');
  sel.innerHTML = '';
  meses.forEach(function(m) {
    var opt = document.createElement('option');
    opt.value = m; opt.textContent = labelMes(m);
    sel.appendChild(opt);
  });
  sel.value = dashMesVentasSeleccionado;

  // Flechas
  var btns = document.querySelectorAll('#dash-ventas-content .btn-ghost');
  if (btns[0]) btns[0].disabled = meses.indexOf(dashMesVentasSeleccionado) === 0;
  if (btns[1]) btns[1].disabled = meses.indexOf(dashMesVentasSeleccionado) === meses.length - 1;

  var mes = dashMesVentasSeleccionado;

  // Filtrar leads del mes
  var leadsDelMes = state.leads.filter(function(l) {
    var fecha = l.fechaInstalacionReal || l.fechaContrato || l.fechaAlta;
    return fecha && fecha.slice(0,7) === mes;
  });

  var instalados  = leadsDelMes.filter(function(l) { return l.estado === 'instalado'; });
  var contratos   = leadsDelMes.filter(function(l) { return l.estado === 'contrato'; });
  var cancelados  = leadsDelMes.filter(function(l) { return l.estado === 'cancelado'; });

  var mrrReal     = instalados.reduce(function(a,l)  { return a + (l.precio||0); }, 0);
  var mrrPrevisto = contratos.reduce(function(a,l)   { return a + (l.precio||0); }, 0) + mrrReal;
  var mrrCancelado= cancelados.reduce(function(a,l)  { return a + (l.precio||0); }, 0);
  var mrrDiff     = mrrPrevisto > 0 ? Math.round(mrrReal / mrrPrevisto * 100) : 0;

  // HULUX 24
  var conGap     = instalados.filter(function(l) { return l.gapInstalacionHoras !== null && l.gapInstalacionHoras !== undefined; });
  var cumplieron = conGap.filter(function(l) { return l.gapInstalacionHoras <= 24; });
  var tasaH24    = conGap.length > 0 ? Math.round(cumplieron.length / conGap.length * 100) : null;
  var gapProm    = conGap.length > 0 ? Math.round(conGap.reduce(function(a,l){ return a + l.gapInstalacionHoras; }, 0) / conGap.length) : null;

  // Agrupaciones
  var porAgente  = {}, porCanal = {}, porPaquete = {}, porCausa = {};

  leadsDelMes.forEach(function(l) {
    var ag = l.agente || 'Sin asignar';
    if (!porAgente[ag]) porAgente[ag] = { leads:0, instalados:0, cancelados:0, mrr:0 };
    porAgente[ag].leads++;
    if (l.estado === 'instalado') { porAgente[ag].instalados++; porAgente[ag].mrr += l.precio||0; }
    if (l.estado === 'cancelado') porAgente[ag].cancelados++;
  });

  instalados.forEach(function(l) {
    var c = l.canal || 'Sin canal';
    if (!porCanal[c]) porCanal[c] = { count:0, mrr:0 };
    porCanal[c].count++; porCanal[c].mrr += l.precio||0;

    var p = l.paquete || 'Sin paquete';
    if (!porPaquete[p]) porPaquete[p] = { count:0, mrr:0 };
    porPaquete[p].count++; porPaquete[p].mrr += l.precio||0;
  });

  cancelados.forEach(function(l) {
    var c = l.causaCancelacion || 'Sin causa';
    if (!porCausa[c]) porCausa[c] = { count:0, mrr:0 };
    porCausa[c].count++; porCausa[c].mrr += l.precio||0;
  });

  var wrap = document.getElementById('dash-ventas-kpis');
  wrap.innerHTML = '';

  // ── KPIs ────────────────────────────────────
  var h24Color = tasaH24 === null ? 'var(--gris-300)' : (tasaH24 >= 80 ? 'var(--verde)' : 'var(--rojo)');
  var h24Delta = gapProm !== null ? ('Gap prom: ' + gapProm + 'hrs') : 'Sin datos';

  var kpiGrid = crearDiv('', 'kpi-grid', 'margin-bottom:14px;');
  kpiGrid.appendChild(crearKpi('MRR Real', mrrReal > 0 ? fmtMXN(mrrReal) : '—', instalados.length + ' clientes instalados', mrrDiff + '% del previsto', mrrDiff >= 80 ? 'up' : mrrDiff >= 50 ? 'neutral' : 'down', 'var(--verde)'));
  kpiGrid.appendChild(crearKpi('MRR Previsto', mrrPrevisto > 0 ? fmtMXN(mrrPrevisto) : '—', (contratos.length + instalados.length) + ' contratos totales', 'Diferencia: ' + fmtMXN(mrrPrevisto - mrrReal), 'neutral', '#7C3AED'));
  kpiGrid.appendChild(crearKpi('MRR Cancelado', mrrCancelado > 0 ? fmtMXN(mrrCancelado) : '—', cancelados.length + ' cancelaciones', (mrrPrevisto > 0 ? Math.round(mrrCancelado/mrrPrevisto*100) : 0) + '% del previsto perdido', cancelados.length === 0 ? 'up' : 'down', 'var(--rojo)'));
  kpiGrid.appendChild(crearKpi('HULUX 24', tasaH24 !== null ? tasaH24 + '%' : '—', 'instalaciones a tiempo', h24Delta, tasaH24 === null ? 'neutral' : (tasaH24 >= 80 ? 'up' : 'down'), h24Color));
  wrap.appendChild(kpiGrid);

  // ── Grid 4 tarjetas ──────────────────────────
  var grid4 = crearDiv('', '', 'display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;');

  grid4.appendChild(crearCardAgente(porAgente));
  grid4.appendChild(crearCardBarras('📡 Cierres por canal', porCanal, 'mrr', '#7C3AED', 'var(--verde)', ' clientes'));
  grid4.appendChild(crearCardBarras('📦 Paquetes más vendidos', porPaquete, 'count', 'var(--naranja-deep)', 'var(--naranja)', ' ventas'));
  grid4.appendChild(crearCardCausa(porCausa));

  wrap.appendChild(grid4);

  // ── Tabla detalle ────────────────────────────
  wrap.appendChild(crearTablaInstalados(instalados));
}

// ── Helpers de construcción DOM ───────────────

function crearDiv(id, className, style) {
  var d = document.createElement('div');
  if (id) d.id = id;
  if (className) d.className = className;
  if (style) d.style.cssText = style;
  return d;
}

function crearKpi(label, value, sub, delta, deltaClass, color) {
  var card = document.createElement('div');
  card.className = 'kpi-card';

  var lbl = document.createElement('div');
  lbl.className = 'kpi-label';
  lbl.textContent = label;

  var val = document.createElement('div');
  val.className = 'kpi-value big';
  val.style.color = color || '';
  val.textContent = value;

  var s = document.createElement('div');
  s.className = 'kpi-sub';
  s.textContent = sub;

  var d = document.createElement('div');
  d.className = 'kpi-delta ' + (deltaClass || 'neutral');
  d.textContent = delta;

  card.appendChild(lbl); card.appendChild(val);
  card.appendChild(s);   card.appendChild(d);
  return card;
}

function crearCardAgente(porAgente) {
  var card = document.createElement('div');
  card.className = 'card';

  var title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = '👤 Por agente vendedor';
  card.appendChild(title);

  if (!Object.keys(porAgente).length) {
    var empty = document.createElement('p');
    empty.style.cssText = 'font-size:13px;color:var(--gris-400);';
    empty.textContent = 'Sin datos';
    card.appendChild(empty);
    return card;
  }

  // Header
  var hdr = crearGrid5('Agente', 'L', '✅', '❌', 'MRR', true);
  card.appendChild(hdr);

  Object.entries(porAgente).sort(function(a,b){ return b[1].mrr - a[1].mrr; }).forEach(function(entry) {
    var ag = entry[0], d = entry[1];
    var row = crearGrid5(ag, d.leads, d.instalados, d.cancelados, d.mrr > 0 ? fmtMXN(d.mrr) : '—', false);
    card.appendChild(row);
  });

  return card;
}

function crearGrid5(c1, c2, c3, c4, c5, isHeader) {
  var row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 40px 40px 40px 72px;gap:6px;padding:5px 0;border-bottom:1px solid ' + (isHeader ? '#F0F0F0' : '#FAFAFA') + ';align-items:center;';

  var makeCell = function(text, align, color, bold) {
    var d = document.createElement('div');
    d.style.cssText = 'font-size:' + (isHeader ? '10px' : '12px') + ';text-align:' + (align||'left') + ';' + (color ? 'color:'+color+';' : '') + (bold ? 'font-weight:700;' : '') + (isHeader ? 'text-transform:uppercase;font-weight:700;' : '');
    d.textContent = text;
    return d;
  };

  row.appendChild(makeCell(c1, 'left', isHeader ? 'var(--gris-500)' : null, false));
  row.appendChild(makeCell(c2, 'center', isHeader ? 'var(--gris-500)' : 'var(--gris-500)', !isHeader));
  row.appendChild(makeCell(c3, 'center', isHeader ? 'var(--verde)' : 'var(--verde)', !isHeader));
  row.appendChild(makeCell(c4, 'center', isHeader ? 'var(--rojo)' : 'var(--rojo)', !isHeader));
  row.appendChild(makeCell(c5, 'right', isHeader ? '#7C3AED' : '#7C3AED', !isHeader));
  return row;
}

function crearCardBarras(title, data, metrica, colorLabel, colorBarra, sufijo) {
  var card = document.createElement('div');
  card.className = 'card';

  var t = document.createElement('div');
  t.className = 'card-title';
  t.textContent = title;
  card.appendChild(t);

  if (!Object.keys(data).length) {
    var empty = document.createElement('p');
    empty.style.cssText = 'font-size:13px;color:var(--gris-400);';
    empty.textContent = 'Sin datos';
    card.appendChild(empty);
    return card;
  }

  var maxVal = Math.max.apply(null, Object.values(data).map(function(d){ return d[metrica]; }).concat([1]));

  Object.entries(data).sort(function(a,b){ return b[1][metrica] - a[1][metrica]; }).forEach(function(entry) {
    var nombre = entry[0], d = entry[1];
    var val = d[metrica];
    var pctVal = Math.round(val / maxVal * 100);
    var display = metrica === 'mrr' ? (fmtMXN(d.mrr) + ' · ' + d.count + sufijo) : (d.count + sufijo + ' · ' + fmtMXN(d.mrr));

    var wrap = crearDiv('', '', 'margin-bottom:10px;');
    var row = crearDiv('', '', 'display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;');

    var lbl = document.createElement('span');
    lbl.style.fontWeight = '600';
    lbl.textContent = nombre;

    var val2 = document.createElement('span');
    val2.style.cssText = 'color:' + colorLabel + ';font-weight:700;';
    val2.textContent = display;

    row.appendChild(lbl); row.appendChild(val2);
    wrap.appendChild(row);

    var track = crearDiv('', '', 'height:8px;background:var(--gris-100);border-radius:4px;overflow:hidden;');
    var fill  = crearDiv('', '', 'height:100%;width:' + pctVal + '%;background:' + colorBarra + ';border-radius:4px;');
    track.appendChild(fill);
    wrap.appendChild(track);
    card.appendChild(wrap);
  });

  return card;
}

function crearCardCausa(porCausa) {
  var card = document.createElement('div');
  card.className = 'card';

  var t = document.createElement('div');
  t.className = 'card-title';
  t.textContent = '❌ Cancelados por causa';
  card.appendChild(t);

  if (!Object.keys(porCausa).length) {
    var msg = document.createElement('p');
    msg.style.cssText = 'font-size:13px;color:var(--gris-400);';
    msg.textContent = 'Sin cancelaciones este mes 🎉';
    card.appendChild(msg);
    return card;
  }

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:grid;grid-template-columns:1fr 36px 72px;gap:6px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #F0F0F0;';
  ['Causa','#','MRR perdido'].forEach(function(txt, i) {
    var d = document.createElement('div');
    d.style.cssText = 'font-size:10px;font-weight:700;color:var(--gris-500);text-transform:uppercase;text-align:' + (i===0?'left':i===1?'center':'right') + ';';
    d.textContent = txt;
    hdr.appendChild(d);
  });
  card.appendChild(hdr);

  Object.entries(porCausa).sort(function(a,b){ return b[1].mrr - a[1].mrr; }).forEach(function(entry) {
    var causa = entry[0], d = entry[1];
    var row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 36px 72px;gap:6px;padding:5px 0;border-bottom:1px solid #FAFAFA;align-items:center;';

    var c1 = document.createElement('div'); c1.style.fontSize = '12px'; c1.style.fontWeight = '500'; c1.textContent = causa;
    var c2 = document.createElement('div'); c2.style.cssText = 'font-size:12px;text-align:center;font-weight:700;color:var(--rojo);'; c2.textContent = d.count;
    var c3 = document.createElement('div'); c3.style.cssText = 'font-size:12px;text-align:right;font-weight:700;color:var(--rojo);'; c3.textContent = d.mrr > 0 ? fmtMXN(d.mrr) : '—';

    row.appendChild(c1); row.appendChild(c2); row.appendChild(c3);
    card.appendChild(row);
  });

  return card;
}

function crearTablaInstalados(instalados) {
  var card = document.createElement('div');
  card.className = 'card';

  var title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = '✅ Detalle de instalaciones del mes';
  card.appendChild(title);

  var wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  var table = document.createElement('table');
  var cols = ['Cliente','Sucursal','Agente','Canal','Paquete','MRR','Prog.','Real','Gap','HULUX 24'];
  var thead = document.createElement('thead');
  var tr = document.createElement('tr');
  cols.forEach(function(c) { var th = document.createElement('th'); th.textContent = c; tr.appendChild(th); });
  thead.appendChild(tr);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  if (!instalados.length) {
    var td = document.createElement('td');
    td.colSpan = 10;
    td.style.cssText = 'text-align:center;color:var(--gris-400);padding:24px;';
    td.textContent = 'Sin instalaciones este mes';
    var trEmpty = document.createElement('tr');
    trEmpty.appendChild(td);
    tbody.appendChild(trEmpty);
  } else {
    instalados.forEach(function(l) {
      var gap    = l.gapInstalacionHoras;
      var cumple = gap !== null && gap !== undefined && gap <= 24;
      var gapColor = gap > 24 ? 'var(--rojo)' : (gap <= 24 ? 'var(--verde)' : 'var(--gris-400)');
      var row = document.createElement('tr');
      var cells = [
        { text: l.nombre,                style: 'font-weight:600;font-size:13px;' },
        { text: l.sucursal || '—',       style: 'font-size:12px;' },
        { text: l.agente || '—',         style: 'font-size:12px;' },
        { text: l.canal || '—',          style: 'font-size:11px;color:var(--gris-500);' },
        { text: l.paquete || '—',        style: 'font-size:12px;' },
        { text: fmtMXN(l.precio),        style: 'font-family:monospace;color:#7C3AED;font-weight:700;' },
        { text: l.fechaInstalacion || '—',     style: 'font-size:12px;' },
        { text: l.fechaInstalacionReal || '—', style: 'font-size:12px;' },
        { text: gap !== null && gap !== undefined ? gap + 'hrs' : '—', style: 'font-family:monospace;font-size:12px;color:' + gapColor + ';font-weight:700;' },
        { text: gap !== null && gap !== undefined ? (cumple ? '✅' : '❌') : '—', style: 'text-align:center;' },
      ];
      cells.forEach(function(c) {
        var td = document.createElement('td');
        td.style.cssText = c.style;
        td.textContent = c.text;
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  card.appendChild(wrap);
  return card;
}

// ── HULUX 24 ─────────────────────────────────
function calcularGapHoras(fechaProg, fechaReal) {
  if (!fechaProg || !fechaReal) return null;
  var diff = new Date(fechaReal + 'T00:00:00') - new Date(fechaProg + 'T00:00:00');
  return Math.round(diff / 3600000);
}

function calcularHulux24() {
  var badge = document.getElementById('hulux24-badge');
  if (!badge) return;
  var prog = document.getElementById('l-fecha-instalacion') && document.getElementById('l-fecha-instalacion').value;
  var real = document.getElementById('l-fecha-instalacion-real') && document.getElementById('l-fecha-instalacion-real').value;
  if (!prog || !real) { badge.style.display = 'none'; return; }
  var horas = calcularGapHoras(prog, real);
  badge.style.display = '';
  badge.innerHTML = '';
  var inner = document.createElement('div');
  if (horas <= 24) {
    inner.style.cssText = 'background:#DCFCE7;border:1px solid #BBF7D0;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:#166534;';
    inner.textContent = '✅ HULUX 24 cumplido — instalado en ' + horas + ' horas';
  } else {
    inner.style.cssText = 'background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:#991B1B;';
    inner.textContent = '⚠️ HULUX 24 incumplido — ' + horas + ' horas (' + (horas - 24) + 'hrs de retraso)';
  }
  badge.appendChild(inner);
}
