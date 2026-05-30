export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <title>Erro no servidor — Ballas Gang</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #0a0a0f; color: #e2e2e2; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; border: 1px solid #27272a; border-radius: 1rem; background: #13131a; }
      .icon { font-size: 2.5rem; margin-bottom: 1rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; font-weight: 600; letter-spacing: 0.02em; }
      p { color: #a1a1aa; margin: 0 0 1.5rem; line-height: 1.6; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.5rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; transition: opacity 0.2s; }
      a:hover, button:hover { opacity: 0.85; }
      .primary { background: #a855f7; color: #fff; border-color: #a855f7; }
      .secondary { background: transparent; color: #e2e2e2; border-color: #27272a; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">⚠️</div>
      <h1>Algo falhou do nosso lado</h1>
      <p>O servidor não conseguiu processar o pedido. Podes tentar recarregar ou voltar mais tarde.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar de novo</button>
        <a class="secondary" href="/">Voltar à base</a>
      </div>
    </div>
  </body>
</html>`;
}
