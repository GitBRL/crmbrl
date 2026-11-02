// Service worker do BRL CRM: o do Angular (cache do app shell; /api nunca entra no cache) mais o
// push. A carga do push é {titulo, corpo, url, tag, notificacaoId}; o clique abre a `url`
// (o ngsw cuida do clique pelo `data.onActionClick`).
importScripts('./ngsw-worker.js');

/** Só rotas do próprio CRM: texto começando com uma barra (e não "//"). */
function rotaSegura(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/inicio';
}

self.addEventListener('push', (evento) => {
  let carga = null;
  try {
    carga = evento.data ? evento.data.json() : null;
  } catch {
    carga = null;
  }
  if (!carga || carga.notification || !carga.titulo) {
    return; // formato do ngsw ou sem título: o ngsw trata (ou ignora)
  }
  const url = new URL(rotaSegura(carga.url), self.registration.scope).href;
  evento.waitUntil(
    self.registration.showNotification(String(carga.titulo), {
      body: carga.corpo ? String(carga.corpo) : '',
      tag: carga.tag ? String(carga.tag) : undefined,
      icon: 'icones/icone-192.png',
      badge: 'icones/icone-192.png',
      lang: 'pt-BR',
      data: {
        notificacaoId: carga.notificacaoId ?? null,
        onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url } },
      },
    }),
  );
});
