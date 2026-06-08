// Claude API proxy — az Anthropic kulcs szerver-oldalon marad
export async function onRequestPost(context) {
  const { request, env } = context;

  // SYNC_TOKEN ellenőrzés
  const auth = request.headers.get('Authorization') || '';
  if (auth !== 'Bearer ' + env.SYNC_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Kérés továbbítása az Anthropic API-ra
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
