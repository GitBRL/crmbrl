// Service worker do BRL CRM: o do Angular (cache do app shell; /api nunca entra no cache) mais o
// push. A carga do push é {titulo, corpo, url, tag, notificacaoId, acoes?, persistente?}; o clique
// (no corpo ou num botão de `acoes`) abre a `url` (o ngsw cuida do clique pelo
// `data.onActionClick`). `persistente` mantém a notificação na tela até a pessoa agir: é o caso da
// ligação tocando (Onda E), que abre /atendimento?ligacao=<id>.
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
  // Botões da notificação ({acao, titulo}); no máximo 2, e cada um abre a mesma `url`.
  const acoes = (Array.isArray(carga.acoes) ? carga.acoes : [])
    .filter((a) => a && typeof a.acao === 'string' && typeof a.titulo === 'string')
    .slice(0, 2);
  const aoClicar = { default: { operation: 'navigateLastFocusedOrOpen', url } };
  for (const a of acoes) {
    aoClicar[a.acao] = { operation: 'navigateLastFocusedOrOpen', url };
  }
  evento.waitUntil(
    self.registration.showNotification(String(carga.titulo), {
      body: carga.corpo ? String(carga.corpo) : '',
      tag: carga.tag ? String(carga.tag) : undefined,
      icon: 'icones/icone-192.png',
      badge: 'icones/icone-192.png',
      lang: 'pt-BR',
      actions: acoes.map((a) => ({ action: a.acao, title: a.titulo })),
      requireInteraction: carga.persistente === true,
      renotify: carga.persistente === true && !!carga.tag,
      vibrate: carga.persistente === true ? [300, 150, 300, 150, 300] : undefined,
      data: {
        notificacaoId: carga.notificacaoId ?? null,
        onActionClick: aoClicar,
      },
    }),
  );
});
