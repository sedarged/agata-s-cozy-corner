export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <title>Strona nie załadowała się</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #faf2e3; color: #4a3728; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.5rem; margin: 0 0 0.5rem; font-family: Georgia, "Times New Roman", serif; }
      p { color: #7a6758; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 9999px; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #4a3728; color: #faf2e3; }
      .secondary { background: transparent; color: #4a3728; border-color: #c9a86a; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Strona nie załadowała się</h1>
      <p>Coś poszło nie tak. Spróbuj odświeżyć albo wróć do biblioteki.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Spróbuj ponownie</button>
        <a class="secondary" href="/">Wróć do biblioteki</a>
      </div>
    </div>
  </body>
</html>`;
}
