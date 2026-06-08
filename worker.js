// Cloudflare Worker belépőpont — API útvonalak + statikus asset kiszolgálás
// v2 — secrets aktívak (ANTHROPIC_API_KEY, SYNC_TOKEN)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/ping') {
      if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401 });
      return new Response('ok', { status: 200 });
    }
    if (url.pathname === '/api/claude') {
      return handleClaude(request, env);
    }
    if (url.pathname === '/api/store') {
      return handleStore(request, env);
    }

    // Minden más: statikus fájlok kiszolgálása (index.html, assets/, stb.)
    return env.ASSETS.fetch(request);
  }
};

// SYNC_TOKEN ellenőrzés segédfüggvény
function checkAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  return auth === 'Bearer ' + env.SYNC_TOKEN;
}

// POST /api/claude — Claude API proxy
async function handleClaude(request, env) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401 });

  const body = await request.json();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET /api/store — összes kulcs lekérése
// PUT /api/store — egy kulcs mentése
async function handleStore(request, env) {
  if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401 });

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT key, value, updated_at FROM store').all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'PUT') {
    const { key, value, updated_at } = await request.json();
    await env.DB.prepare(
      'INSERT INTO store (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at'
    ).bind(key, value, updated_at).run();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
