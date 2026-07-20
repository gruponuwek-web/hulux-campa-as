// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
(async function() {
  var hoy = new Date();
  document.getElementById('header-fecha').textContent =
    hoy.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  await cargarState();
  renderCampanas();

  // Revisión periódica de alertas cada 5 minutos
  setInterval(function() {
    var hayAlertas = state.leads.some(function(l) { return alertaReloj(l); });
    if (hayAlertas) renderPipeline();
  }, 5 * 60 * 1000);
})();
