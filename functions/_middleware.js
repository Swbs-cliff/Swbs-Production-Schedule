// Password gate for the whole site. One shared shop password (Cloudflare secret APP_PASSWORD).
// A correct login sets a long-lived cookie so the shop monitor stays signed in.
const COOKIE = 'swbs_auth';
const YEAR = 60 * 60 * 24 * 365;

async function token(secret) {
  const data = new TextEncoder().encode('swbs-planner:' + secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function cookieValue(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}

function loginPage(error) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in · Shop Production Planner</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#f3f4f6;font:16px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}
form{background:#1e1e1e;padding:32px 36px;border-top:4px solid #D62828;width:min(360px,90vw)}
h1{margin:0 0 4px;font:700 22px/1.2 'Arial Narrow',Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}
p{margin:0 0 20px;color:#9ca3af;font-size:14px}
input{width:100%;box-sizing:border-box;padding:12px;font:inherit;border:2px solid #333;background:#111;color:inherit}
button{margin-top:14px;width:100%;padding:12px;border:0;border-radius:9999px;background:#D62828;color:#fff;font:600 15px system-ui;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.err{color:#f87171;margin:12px 0 0;font-size:14px}
</style></head><body>
<form method="POST" action="/login">
<h1>Southwest Body Shop</h1><p>Production Planner</p>
<input type="password" name="password" placeholder="Shop password" autofocus required>
<input type="hidden" name="next" value="">
<button type="submit">Sign in</button>
${error ? '<p class="err">That password didn\'t match. Try again.</p>' : ''}
</form>
<script>document.querySelector('[name=next]').value=location.pathname+location.hash;</script>
</body></html>`;
  return new Response(html, { status: error ? 401 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (!env.APP_PASSWORD) return new Response('APP_PASSWORD is not set on this site.', { status: 500 });
  const good = await token(env.APP_PASSWORD);

  if (url.pathname === '/login' && request.method === 'POST') {
    const form = await request.formData();
    if (String(form.get('password') || '') !== env.APP_PASSWORD) return loginPage(true);
    let dest = String(form.get('next') || '/');
    if (!dest.startsWith('/') || dest.startsWith('//')) dest = '/';
    return new Response(null, { status: 303, headers: {
      Location: dest,
      'Set-Cookie': `${COOKIE}=${good}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax`,
    } });
  }
  if (url.pathname === '/logout') {
    return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }

  if (cookieValue(request, COOKIE) !== good) {
    if (url.pathname.startsWith('/api/')) return new Response('Sign in first', { status: 401 });
    return loginPage(false);
  }
  const res = await next();
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    const r = new Response(res.body, res);
    r.headers.set('Cache-Control', 'no-store');
    return r;
  }
  return res;
}
