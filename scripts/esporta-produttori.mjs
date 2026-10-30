// Legge da Airtable i produttori con Stato = Approvato e scrive assets/produttori.json.
// Esporta solo i campi pubblici. Le coordinate sono arrotondate a 2 decimali (~1 km):
// il punto resta nel comune, mai sull'indirizzo.
import { writeFile } from 'node:fs/promises';

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE || 'appVraSQpDVbq7AJu';
const TABELLA = process.env.AIRTABLE_TABELLA || 'tblvxUaSI1SCCoTRd';
if (!TOKEN) { console.error('Manca AIRTABLE_TOKEN'); process.exit(1); }

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

const tondo = (n) => Math.round(n * 100) / 100;
const punti = righe
  .map((r) => r.fields)
  .filter((f) => Number.isFinite(f.Latitudine) && Number.isFinite(f.Longitudine))
  .map((f) => ({
    nome: f.Nome || '',
    ecotipo: f.Ecotipo || '',
    comune: f.Comune || '',
    provincia: f.Provincia || '',
    lat: tondo(f.Latitudine),
    lng: tondo(f.Longitudine),
    assaggiato: !!f.Assaggiato,
    livello: f.Livello || 'Gratuito',
  }))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

await writeFile('assets/produttori.json', JSON.stringify(punti, null, 1) + '\n');
console.log(`Esportati ${punti.length} produttori (su ${righe.length} approvati).`);
