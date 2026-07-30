// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
(async function() {
  var hoy = new Date();
  document.getElementById('header-fecha').textContent =
    hoy.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  await cargarState();

  // Mostrar pantalla de selección de rol
  iniciarPortal();

  // Revisión periódica de alertas cada 5 minutos
  setInterval(function() {
    actualizarBadgesAlerta();
    var hayAlertas = state.leads.some(function(l) { return alertaReloj(l); });
    if (hayAlertas && document.getElementById('screen-pipeline').classList.contains('active')) {
      renderPipeline();
    }
  }, 5 * 60 * 1000);
})();