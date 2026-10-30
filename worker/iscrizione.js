// Cloudflare Worker: riceve l'iscrizione alla mappa dal sito e la scrive in Airtable.
// Il token Airtable (con permesso di scrittura) sta qui come secret e non arriva mai al browser.
//
// Variabili del Worker:
//   AIRTABLE_TOKEN   (secret, obbligatoria)  token con data.records:write sulla base della mappa
//   AIRTABLE_BASE    (facoltativa)           default: appVraSQpDVbq7AJu
//   AIRTABLE_TABELLA (facoltativa)           default: tblvxUaSI1SCCoTRd
//   TURNSTILE_SECRET (secret, facoltativa)   se presente, richiede il controllo anti-bot di Cloudflare

const BASE_DEFAULT = 'appVraSQpDVbq7AJu';
const TABELLA_DEFAULT = 'tblvxUaSI1SCCoTRd';
const ORIGINI = ['https://vampiriitaliani.it', 'https://www.vampiriitaliani.it'];
const MAX_BODY = 6000;

const pulisci = (v, max) =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function risposta(corpo, stato, origine) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (ORIGINI.includes(origine)) {
    h['Access-Control-Allow-Origin'] = origine;
    h['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(corpo), { status: stato, headers: h });
}

export function valida(d) {
  const e = {};
  const tipo = pulisci(d.tipo, 20);
  if (!['Azienda', 'Privato'].includes(tipo)) e.tipo = 'Scegli azienda o privato.';
  const nome = pulisci(d.nome, 120);
  if (nome.length < 2) e.nome = 'Scrivi il nome.';
  const ecotipo = pulisci(d.ecotipo, 120);
  if (ecotipo.length < 2) e.ecotipo = 'Scrivi la varietà o l\'ecotipo.';
  const comune = pulisci(d.comune, 80);
  if (comune.length < 2) e.comune = 'Scrivi il comune.';
  const provincia = pulisci(d.provincia, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(provincia)) e.provincia = 'Scrivi la sigla della provincia, due lettere.';
  const email = pulisci(d.email, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = 'Controlla l\'indirizzo email.';
  const telefono = pulisci(d.telefono, 30);
  if (!/^[+0-9][0-9 ()./-]{5,}$/.test(telefono)) e.telefono = 'Controlla il numero di telefono.';
  if (d.consenso !== true) e.consenso = 'Serve il consenso per pubblicare.';
  return { errori: e, dati: { tipo, nome, ecotipo, comune, provincia, email, telefono } };
}

async function controlloTurnstile(token, secret, ip) {
  const f = new FormData();
  f.append('secret', secret);
  f.append('response', token || '');
  if (ip) f.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: f });
  const j = await r.json().catch(() => ({}));
  return !!j.success;
}

export default {
  async fetch(request, env) {
    const origine = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      const h = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      };
      if (ORIGINI.includes(origine)) { h['Access-Control-Allow-Origin'] = origine; h['Vary'] = 'Origin'; }
      return new Response(null, { status: 204, headers: h });
    }
    if (request.method !== 'POST') return risposta({ ok: false, errore: 'Metodo non consentito.' }, 405, origine);
    if (origine && !ORIGINI.includes(origine)) return risposta({ ok: false, errore: 'Origine non consentita.' }, 403, origine);

    const testo = await request.text();
    if (testo.length > MAX_BODY) return risposta({ ok: false, errore: 'Richiesta troppo grande.' }, 413, origine);
    let d;
    try { d = JSON.parse(testo); } catch { return risposta({ ok: false, errore: 'Richiesta non valida.' }, 400, origine); }
    if (!d || typeof d !== 'object') return risposta({ ok: false, errore: 'Richiesta non valida.' }, 400, origine);

    // Anti-spam: campo trappola che i bot riempiono e le persone non vedono, e tempo minimo di compilazione.
    if (pulisci(d.sito, 200) !== '') return risposta({ ok: true }, 200, origine); // finto successo, non scriviamo nulla
    const impiegato = Number(d.secondi);
    if (!Number.isFinite(impiegato) || impiegato < 2) return risposta({ ok: false, errore: 'Riprova tra qualche secondo.' }, 429, origine);

    if (env.TURNSTILE_SECRET) {
      const ok = await controlloTurnstile(d.turnstile, env.TURNSTILE_SECRET, request.headers.get('CF-Connecting-IP'));
      if (!ok) return risposta({ ok: false, errore: 'Controllo anti-bot non superato. Ricarica la pagina e riprova.' }, 400, origine);
    }

    const { errori, dati } = valida(d);
    if (Object.keys(errori).length) return risposta({ ok: false, errori }, 422, origine);
    if (!env.AIRTABLE_TOKEN) return risposta({ ok: false, errore: 'Servizio non configurato.' }, 500, origine);

    const base = env.AIRTABLE_BASE || BASE_DEFAULT;
    const tabella = env.AIRTABLE_TABELLA || TABELLA_DEFAULT;
    const r = await fetch(`https://api.airtable.com/v0/${base}/${tabella}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          Tipo: dati.tipo,
          Nome: dati.nome,
          Ecotipo: dati.ecotipo,
          Comune: dati.comune,
          Provincia: dati.provincia,
          Email: dati.email,
          Telefono: dati.telefono,
          'Consenso GDPR': true,
          Stato: 'In attesa',
          Livello: 'Gratuito',
        },
      }),
    });
    if (!r.ok) {
      console.log('Airtable', r.status, (await r.text()).slice(0, 300));
      return risposta({ ok: false, errore: 'Non siamo riusciti a registrare l\'iscrizione. Riprova o scrivi a info@vampiriitaliani.it.' }, 502, origine);
    }
    return risposta({ ok: true }, 200, origine);
  },
};
