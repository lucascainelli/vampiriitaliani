// Legge da Airtable i produttori con Stato = Approvato e scrive assets/produttori.json.
// Esporta solo i campi pubblici. Le coordinate sono arrotondate a 2 decimali (~1 km):
// il punto resta nel comune, mai sull'indirizzo.
// Se un record non ha latitudine/longitudine, le ricava dal comune (OpenStreetMap/Nominatim)
// e le conserva in assets/coordinate-comuni.json, così ogni comune si cerca una volta sola.
// A Nominatim va solo il nome del comune e la provincia, mai dati personali.
import { readFile, writeFile } from 'node:fs/promises';

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE || 'appVraSQpDVbq7AJu';
const TABELLA = process.env.AIRTABLE_TABELLA || 'tblvxUaSI1SCCoTRd';
if (!TOKEN) { console.error('Manca AIRTABLE_TOKEN'); process.exit(1); }

const FILE_CACHE = 'assets/coordinate-comuni.json';
let cache = {};
try { cache = JSON.parse(await readFile(FILE_CACHE, 'utf8')); } catch { /* prima volta */ }
let cacheCambiata = false;

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const inItalia = (lat, lng) => lat > 35 && lat < 48 && lng > 6 && lng < 19;

async function coordinateDelComune(comune, provincia) {
  const chiave = `${norm(comune)}|${norm(provincia)}`;
  if (cache[chiave]) return cache[chiave];
  const q = new URLSearchParams({
    q: `${comune}, ${provincia}, Italia`,
    format: 'jsonv2', limit: '1', countrycodes: 'it', featuretype: 'settlement',
  });
  let risultato = null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { 'User-Agent': 'vampiriitaliani.it mappa produttori (info@vampiriitaliani.it)' },
    });
    if (r.ok) {
      const j = await r.json();
      if (j.length) risultato = j[0];
    } else console.warn('Nominatim', r.status);
  } catch (e) { console.warn('Nominatim non raggiungibile:', e.message); }
  await pausa(1100); // limite di Nominatim: 1 richiesta al secondo
  if (!risultato) return null;
  const lat = Number(risultato.lat), lng = Number(risultato.lon);
  if (!inItalia(lat, lng)) return null;
  cache[chiave] = { lat, lng, trovato: risultato.display_name };
  cacheCambiata = true;
  console.log(`Coordinate trovate per ${comune} (${provincia}): ${risultato.display_name}`);
  return cache[chiave];
}

const filtro = encodeURIComponent("AND({Stato}='Approvato',{Consenso GDPR}=1)");
let url = `https://api.airtable.com/v0/${BASE}/${TABELLA}?filterByFormula=${filtro}&pageSize=100`;
const righe = [];
while (url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) { console.error('Airtable', r.status, await r.text()); process.exit(1); }
  const j = await r.json();
  righe.push(...j.records);
  url = j.offset ? `https://api.airtable.com/v0/${BASE}/${TABELLA}?filterByFormula=${filtro}&pageSize=100&offset=${j.offset}` : null;
}

// Scrive le coordinate trovate anche in Airtable (comodo da vedere). Non è obbligatorio:
// se il token è di sola lettura la scrittura fallisce, si segnala e la mappa funziona lo stesso.
let scritturaAirtableOk = true;
async function scriviCoordinateInAirtable(idRecord, lat, lng) {
  if (!scritturaAirtableOk) return;
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABELLA}/${idRecord}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { Latitudine: Math.round(lat * 1e6) / 1e6, Longitudine: Math.round(lng * 1e6) / 1e6 } }),
  });
  if (!r.ok) {
    scritturaAirtableOk = false;
    console.warn(`Coordinate non scritte in Airtable (${r.status}): al token serve il permesso data.records:write. La mappa funziona lo stesso.`);
  }
}

const tondo = (n) => Math.round(n * 100) / 100;
const punti = [];
for (const { id, fields: f } of righe) {
  let lat = f.Latitudine, lng = f.Longitudine;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const c = f.Comune ? await coordinateDelComune(f.Comune, f.Provincia) : null;
    if (!c) { console.warn(`ATTENZIONE: nessuna coordinata per "${f.Comune}" (${f.Provincia}): non compare sulla mappa.`); continue; }
    lat = c.lat; lng = c.lng;
    await scriviCoordinateInAirtable(id, lat, lng);
  }
  punti.push({
    // I privati non compaiono col nome: sulla mappa solo varietà e comune.
    privato: f.Tipo === 'Privato',
    nome: f.Tipo === 'Privato' ? '' : (f.Nome || ''),
    ecotipo: f.Ecotipo || '',
    comune: f.Comune || '',
    provincia: f.Provincia || '',
    lat: tondo(lat),
    lng: tondo(lng),
    assaggiato: !!f.Assaggiato,
    livello: f.Livello || 'Gratuito',
  });
}
punti.sort((a, b) => (a.comune + a.nome).localeCompare(b.comune + b.nome, 'it'));

await writeFile('assets/produttori.json', JSON.stringify(punti, null, 1) + '\n');
if (cacheCambiata) await writeFile(FILE_CACHE, JSON.stringify(cache, null, 1) + '\n');
console.log(`Esportati ${punti.length} produttori (su ${righe.length} approvati).`);
