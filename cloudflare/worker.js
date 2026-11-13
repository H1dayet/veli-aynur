// Serves the invitation (static files) at huselabs.az/veli-aynur/ and handles the RSVP form.
//   POST /veli-aynur/api/rsvp          → saves one answer to D1
//   GET  /veli-aynur/<ADMIN_PATH>      → admin page (ADMIN_PATH is a Worker secret, so the link isn't in this public repo)
//   GET  /veli-aynur/<ADMIN_PATH>.csv  → same data as CSV for Excel / Google Sheets
//   POST /veli-aynur/<ADMIN_PATH>/delete (id=…) → deletes one answer, back to the admin page
// Everything else is a static file from ./site.
const PREFIX = '/veli-aynur';
const CORS = { 'access-control-allow-origin': '*' };   // the GitHub Pages copy posts here too

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...CORS } });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const key = (name) => name.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === `${PREFIX}/api/rsvp`) {
      if (request.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, 'access-control-allow-methods': 'POST' } });
      if (request.method !== 'POST') return json({ ok: false }, 405);
      return saveRsvp(request, env);
    }

    const admin = env.ADMIN_PATH && `${PREFIX}/${env.ADMIN_PATH}`;
    if (admin && pathname === `${admin}/delete` && request.method === 'POST') {
      const id = parseInt((await request.formData()).get('id'), 10);
      if (id > 0) await env.DB.prepare('DELETE FROM rsvp WHERE id = ?').bind(id).run();
      return Response.redirect(new URL(admin, request.url).href, 303);   // 303: reload the page with GET, no resubmit
    }
    if (admin && (pathname === admin || pathname === `${admin}.csv`)) {
      const { results } = await env.DB.prepare('SELECT * FROM rsvp ORDER BY id DESC').all();
      const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
      return pathname.endsWith('.csv')
        ? new Response(toCsv(results), { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="veli-aynur-rsvp.csv"' } })
        : new Response(adminPage(results, `${admin}.csv`, `${admin}/delete`), { headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
    }

    return env.ASSETS.fetch(request);
  },
};

async function saveRsvp(request, env) {
  let f;
  try { f = await request.formData(); } catch { return json({ ok: false, error: 'bad request' }, 400); }
  if (f.get('website')) return json({ ok: true });   // honeypot: hidden field only bots fill in
  const name = String(f.get('name') || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const attending = f.get('attending');
  if (!name || (attending !== 'yes' && attending !== 'no')) return json({ ok: false, error: 'missing fields' }, 400);
  const yes = attending === 'yes';
  const guests = yes ? Math.min(Math.max(parseInt(f.get('guests'), 10) || 1, 1), 10) : 0;
  const comment = yes ? String(f.get('comment') || '').trim().slice(0, 500) : '';
  await env.DB.prepare('INSERT INTO rsvp (name, attending, guests, comment) VALUES (?, ?, ?, ?)')
    .bind(name, yes ? 1 : 0, guests, comment || null).run();
  return json({ ok: true });
}

// Rows arrive newest first; a guest who answered twice counts once, with their latest answer.
function latestPerGuest(rows) {
  const seen = new Set();
  return rows.map((r) => ({ ...r, current: !seen.has(key(r.name)) && seen.add(key(r.name)) }));
}

function toCsv(rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Дата (UTC)', 'Имя', 'Придёт', 'Гостей', 'Комментарий', 'Актуальный ответ'].map(cell).join(';')];
  for (const r of latestPerGuest(rows)) {
    lines.push([r.created_at, r.name, r.attending ? 'Да' : 'Нет', r.guests, r.comment, r.current ? 'Да' : 'Нет (есть новее)'].map(cell).join(';'));
  }
  return '﻿' + lines.join('\r\n');   // BOM + ";" so Excel opens Cyrillic correctly
}

function adminPage(rows, csvHref, deleteHref) {
  const all = latestPerGuest(rows);
  const cur = all.filter((r) => r.current);
  const yes = cur.filter((r) => r.attending);
  const people = yes.reduce((n, r) => n + r.guests, 0);
  const no = cur.length - yes.length;
  const tr = (r) => `<tr class="${r.current ? '' : 'old'}${r.attending ? ' yes' : ' no'}">
    <td><time datetime="${esc(r.created_at)}">${esc(r.created_at)}</time></td>
    <td>${esc(r.name)}${r.current ? '' : ' <small>(старый ответ)</small>'}</td>
    <td>${r.attending ? 'Придёт' : 'Не сможет'}</td>
    <td>${r.attending ? r.guests : '—'}</td>
    <td>${esc(r.comment) || ''}</td>
    <td><form method="post" action="${esc(deleteHref)}" data-name="${esc(r.name)}"><input type="hidden" name="id" value="${r.id}"><button class="del" title="Удалить">Удалить</button></form></td></tr>`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Ответы гостей · Вели &amp; Айнур</title>
<style>
  :root { --navy: #0a1730; --ink: #1a2f58; --gold: #a8874a; --ivory: #f7f3ea; --muted: #5d6a82; }
  * { box-sizing: border-box; margin: 0; }
  body { font: 16px/1.5 system-ui, sans-serif; background: var(--ivory); color: var(--ink); padding: 20px 16px 40px; }
  h1 { font: 600 1.4rem Georgia, serif; margin-bottom: 4px; }
  .sub { color: var(--muted); font-size: .9rem; margin-bottom: 18px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 18px; }
  .stat { background: #fff; border: 1px solid #e3dccb; border-radius: 10px; padding: 12px 14px; }
  .stat b { display: block; font-size: 1.8rem; line-height: 1.1; }
  .stat span { color: var(--muted); font-size: .85rem; }
  .bar { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 10px; }
  a.btn { background: var(--navy); color: #fff; text-decoration: none; padding: 9px 16px; border-radius: 999px; font-size: .9rem; }
  .wrap { overflow-x: auto; background: #fff; border: 1px solid #e3dccb; border-radius: 10px; }
  table { border-collapse: collapse; width: 100%; min-width: 640px; font-size: .92rem; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #eee7d8; vertical-align: top; }
  th { background: #faf7f0; font-weight: 600; color: var(--muted); font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
  tr.yes td:nth-child(3) { color: #2f7a4b; font-weight: 600; }
  tr.no td:nth-child(3) { color: #a33a3a; font-weight: 600; }
  tr.old td { opacity: .45; }
  td:nth-child(5) { max-width: 320px; white-space: pre-wrap; }
  button.del { background: none; border: 1px solid #d9b3b3; color: #a33a3a; border-radius: 999px; padding: 4px 12px; font: inherit; font-size: .82rem; cursor: pointer; }
  button.del:hover { background: #a33a3a; color: #fff; }
  .empty { padding: 28px; text-align: center; color: var(--muted); }
</style></head><body>
<h1>Ответы гостей</h1>
<p class="sub">Вели &amp; Айнур · 04.12.2026 · обновите страницу, чтобы увидеть новые ответы</p>
<div class="stats">
  <div class="stat"><b>${people}</b><span>человек придут</span></div>
  <div class="stat"><b>${yes.length}</b><span>ответов «да»</span></div>
  <div class="stat"><b>${no}</b><span>не смогут</span></div>
  <div class="stat"><b>${cur.length}</b><span>всего ответили</span></div>
</div>
<div class="bar"><span class="sub" style="margin:0">Если гость ответил несколько раз, считается последний ответ.</span><a class="btn" href="${esc(csvHref)}">Скачать CSV</a></div>
<div class="wrap">${all.length
    ? `<table><thead><tr><th>Когда</th><th>Имя</th><th>Ответ</th><th>Гостей</th><th>Комментарий</th><th></th></tr></thead><tbody>${all.map(tr).join('')}</tbody></table>`
    : '<p class="empty">Пока никто не ответил.</p>'}</div>
<script>
  // deleting is permanent, so ask first
  for (const f of document.querySelectorAll('form[data-name]')) {
    f.addEventListener('submit', (e) => {
      if (!confirm('Удалить ответ «' + f.dataset.name + '»? Это нельзя отменить.')) e.preventDefault();
    });
  }
  // show times in the viewer's own timezone
  for (const t of document.querySelectorAll('time')) {
    t.textContent = new Date(t.dateTime).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
</script>
</body></html>`;
}
