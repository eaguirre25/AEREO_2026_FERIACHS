const bootTimeout = window.setTimeout(showBootError, 15000);

window.addEventListener('error', event => {
  const status = document.querySelector('#status');
  if (status?.textContent.includes('Preparando')) showBootError();
  console.error('No se pudo cargar un recurso de la experiencia:', event.error ?? event.target);
}, true);

window.addEventListener('aereo:ready', () => window.clearTimeout(bootTimeout), { once: true });

function showBootError() {
  const status = document.querySelector('#status');
  if (!status || !status.textContent.includes('Preparando')) return;
  status.textContent = 'No se pudo iniciar la experiencia. Verificá tu conexión y recargá la página.';
  status.classList.add('error');
}
