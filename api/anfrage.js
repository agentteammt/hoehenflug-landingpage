// Formular-Endpunkt für die Höhenflug-Landingpage → versendet per Lettermint.
// Läuft als Serverless Function (Vercel: /api/anfrage.js; Netlify: netlify/functions/anfrage.js mit kleinem Adapter).
// Der Lettermint-Token bleibt auf dem Server — niemals in die Seite schreiben.
//
// Umgebungsvariablen:
//   LETTERMINT_PROJECT_TOKEN  Project-API-Token (Sending)
//   MAIL_FROM                 verifizierte Absenderadresse, z. B. "Beyond Marketing <hoehenflug@team-mt.de>"
//   LEAD_TO                   Empfänger der Anfragen, z. B. "martina.manich@team-mt.de"
//   LETTERMINT_ROUTE          optional: Route-Slug in Lettermint

const API = 'https://api.lettermint.co/v1/send';
const esc = s => String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 500);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  if (b.hp) return res.status(200).json({ ok: true }); // Honeypot: Bots bekommen ein stilles OK

  const email = esc(b.email), name = esc(b.name), website = esc(b.website), company = esc(b.company);
  const message = String(b.message ?? '').trim().slice(0, 4000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || !website || b.consent !== true) return res.status(422).json({ error: 'invalid' });
  const checks = Array.isArray(b.checks) && b.checks.length ? b.checks.map(esc).join(', ') : 'keine Vorauswahl';

  const send = payload => fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-lettermint-token': process.env.LETTERMINT_PROJECT_TOKEN },
    body: JSON.stringify({ from: process.env.MAIL_FROM, route: process.env.LETTERMINT_ROUTE || undefined, ...payload }),
  });

  const lead = await send({
    to: [process.env.LEAD_TO],
    reply_to: [email],
    subject: `Check-Anfrage (${checks}) — ${name}${company ? ', ' + company : ''}`,
    tag: 'hoehenflug-lead',
    text: [
      'Neue Anfrage über die Höhenflug-Landingpage (IT-Unternehmertag 2026)', '',
      `Gewünschte Checks: ${checks}`,
      `Website:           ${website}`,
      `Name:              ${name}`,
      `Unternehmen:       ${company || '—'}`,
      `E-Mail:            ${email}`, '',
      'Nachricht:', message || '—', '',
      `Einwilligung: ja · ${new Date().toISOString()} · ${esc(b.page)}`,
    ].join('\n'),
  });
  if (!lead.ok) return res.status(502).json({ error: 'mail' });

  // Eingangsbestätigung an den Absender — gleicher Wortlaut wie auf der Seite, kein Ergebnisversprechen
  send({
    to: [email],
    subject: 'Ihre Anfrage bei Beyond Marketing',
    tag: 'hoehenflug-bestaetigung',
    text: `Guten Tag ${name},\n\ndanke — wir haben Ihre Anfrage (${checks}). Wir sehen uns Ihre Sichtbarkeit an und melden uns innerhalb von zwei Werktagen mit einem Terminvorschlag.\n\nBeyond Marketing · team::mt GmbH`,
  }).catch(() => {});

  return res.status(200).json({ ok: true });
}
