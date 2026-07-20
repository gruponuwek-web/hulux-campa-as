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
