// The one shared copy of the schedule. Stored in Cloudflare KV (binding PLANNER) under key "state".
// GET returns it ({} when empty). PUT replaces it if it is not older than what is stored.
const KEY = 'state';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestGet({ env }) {
  const raw = await env.PLANNER.get(KEY);
  return new Response(raw || '{}', { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export async function onRequestPut({ request, env }) {
  let incoming;
  try { incoming = await request.json(); } catch (e) { return json({ error: 'Not JSON' }, 400); }
  if (!incoming || !Array.isArray(incoming.jobs) || !Array.isArray(incoming.crew)) return json({ error: 'Missing jobs or crew' }, 400);
  const raw = await env.PLANNER.get(KEY);
  if (raw) {
    try {
      const cur = JSON.parse(raw);
      if ((cur.updatedAt || 0) > (incoming.updatedAt || 0)) return json({ stale: true, state: cur }, 409);
    } catch (e) { /* stored copy unreadable: overwrite it */ }
  }
  const text = JSON.stringify(incoming);
  if (text.length > 20 * 1024 * 1024) return json({ error: 'Too large' }, 413);
  await env.PLANNER.put(KEY, text);
  return json({ ok: true, updatedAt: incoming.updatedAt || 0 });
}
