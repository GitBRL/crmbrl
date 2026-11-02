/**
 * Exemplos prontos que a tela de Integrações mostra: o `curl` para mandar um lead a um webhook
 * de entrada (R8.2, R8.3) e o código que confere a assinatura de um webhook de saída (R9.3).
 */

/** Corpo de exemplo quando não há outro (formato do modelo Genérico). */
export const CORPO_DE_EXEMPLO: Readonly<Record<string, string>> = {
  name: 'Maria Souza',
  email: 'maria@empresa.com.br',
  phone: '(11) 98765-4321',
  utm_source: 'site',
};

/** Texto entre aspas simples para o shell (a aspa simples vira `'\''`). */
export function aspasDoShell(texto: string): string {
  return `'${texto.replaceAll("'", `'\\''`)}'`;
}

/**
 * `curl` que manda um lead ao endereço do webhook de entrada. Com assinatura, calcula o
 * `X-Assinatura` com o `openssl` (o segredo vai no lugar de `SEU_SEGREDO` quando não é
 * conhecido).
 */
export function exemploCurlEntrada(
  url: string,
  corpo: unknown = CORPO_DE_EXEMPLO,
  assinatura: { readonly exige: boolean; readonly segredo?: string | null } = { exige: false },
): string {
  const json = aspasDoShell(JSON.stringify(corpo ?? CORPO_DE_EXEMPLO));
  const endereco = aspasDoShell(url);
  if (!assinatura.exige) {
    return [
      `curl -X POST ${endereco} \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  --data-raw ${json}`,
    ].join('\n');
  }
  const segredo = aspasDoShell(assinatura.segredo || 'SEU_SEGREDO');
  return [
    `CORPO=${json}`,
    `ASSINATURA=$(printf '%s' "$CORPO" | openssl dgst -sha256 -hmac ${segredo} | sed 's/^.* //')`,
    `curl -X POST ${endereco} \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H "X-Assinatura: sha256=$ASSINATURA" \\`,
    `  --data-raw "$CORPO"`,
  ].join('\n');
}

/** Node.js (Express): confere `X-CRM-Assinatura` e o horário antes de usar o evento. */
export const EXEMPLO_ASSINATURA_NODE = `import { createHmac, timingSafeEqual } from 'node:crypto';
import express from 'express';

const SEGREDO = process.env.CRM_WEBHOOK_SEGREDO; // mostrado ao criar o destino
const app = express();

// Leia o corpo BRUTO: a assinatura vale para os bytes exatos que chegaram.
app.post('/webhooks/brl-crm', express.raw({ type: 'application/json' }), (req, res) => {
  const timestamp = req.get('X-CRM-Timestamp') ?? '';
  const recebida = req.get('X-CRM-Assinatura') ?? '';
  const esperada =
    'sha256=' + createHmac('sha256', SEGREDO).update(\`\${timestamp}.\${req.body}\`).digest('hex');

  const confere =
    recebida.length === esperada.length &&
    timingSafeEqual(Buffer.from(recebida), Buffer.from(esperada));
  const recente = Math.abs(Date.now() / 1000 - Number(timestamp)) < 300; // até 5 minutos

  if (!confere || !recente) {
    return res.status(401).end();
  }

  const evento = JSON.parse(req.body.toString('utf8'));
  // evento.id é o mesmo em todas as tentativas: use-o para não processar duas vezes.
  res.status(200).end();
});`;

/** Python (Flask): a mesma conferência. */
export const EXEMPLO_ASSINATURA_PYTHON = `import hashlib, hmac, os, time
from flask import Flask, abort, request

SEGREDO = os.environ["CRM_WEBHOOK_SEGREDO"].encode()
app = Flask(__name__)

@app.post("/webhooks/brl-crm")
def receber():
    timestamp = request.headers.get("X-CRM-Timestamp", "")
    recebida = request.headers.get("X-CRM-Assinatura", "")
    corpo = request.get_data()  # bytes exatos que chegaram
    esperada = "sha256=" + hmac.new(
        SEGREDO, timestamp.encode() + b"." + corpo, hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(recebida, esperada):
        abort(401)
    if abs(time.time() - int(timestamp or 0)) > 300:  # até 5 minutos
        abort(401)

    evento = request.get_json()
    # evento["id"] é o mesmo em todas as tentativas: use-o para não processar duas vezes.
    return "", 200`;
