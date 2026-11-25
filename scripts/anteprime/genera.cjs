// Genera le immagini di anteprima (1200×630) che compaiono quando si condivide una pagina
// su WhatsApp, Facebook, Telegram, LinkedIn…
//
//   node scripts/anteprime/genera.cjs
//
// Serve Playwright (Chromium). Le immagini finiscono in assets/og/ (e og-vampiri.jpg nella radice).
// Per una nuova pagina: aggiungi una voce a PAGINE e rilancia.

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const RADICE = path.resolve(__dirname, '../..');
const fileUrl = (p) => 'file://' + path.join(RADICE, p);

// ---------- disegni (oro su nero) ----------
const ORO = `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#E8C96A"/><stop offset=".5" stop-color="#C9A84C"/><stop offset="1" stop-color="#8a6f2e"/></linearGradient></defs>`;
const DISEGNI = {
  microfono: `<svg viewBox="0 0 220 300" fill="none">${ORO}
    <defs><pattern id="r" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 0H10M0 0V10" stroke="#0a0a0a" stroke-width="1.6"/></pattern></defs>
    <rect x="60" y="10" width="100" height="160" rx="50" fill="url(#g)"/><rect x="60" y="10" width="100" height="160" rx="50" fill="url(#r)" opacity=".55"/>
    <rect x="56" y="82" width="108" height="16" rx="3" fill="#0a0a0a" stroke="#E8C96A" stroke-width="3"/>
    <path d="M38 110v20a72 72 0 0 0 144 0v-20" stroke="url(#g)" stroke-width="9" stroke-linecap="round"/>
    <path d="M110 202v60" stroke="#C9A84C" stroke-width="9"/><path d="M62 270h96" stroke="#C9A84C" stroke-width="10" stroke-linecap="round"/>
    <path d="M18 70c-14 20-14 60 0 80M2 55c-22 32-22 78 0 110M202 70c14 20 14 60 0 80M218 55c22 32 22 78 0 110" stroke="#C0392B" stroke-width="4" stroke-linecap="round"/></svg>`,
  segnaposto: `<svg viewBox="0 0 220 300" fill="none">${ORO}
    <ellipse cx="110" cy="262" rx="80" ry="18" stroke="#C0392B" stroke-width="3" opacity=".8"/><ellipse cx="110" cy="262" rx="40" ry="9" stroke="#C0392B" stroke-width="3"/>
    <path d="M110 255C70 200 40 160 40 110a70 70 0 0 1 140 0c0 50-30 90-70 145z" fill="url(#g)"/>
    <circle cx="110" cy="108" r="30" fill="#0a0a0a"/><circle cx="110" cy="108" r="14" fill="#C0392B"/></svg>`,
  libro: `<svg viewBox="0 0 260 220" fill="none">${ORO}
    <path d="M130 40C100 20 50 18 14 30v160c36-12 86-10 116 10z" fill="url(#g)"/><path d="M130 40c30-20 80-22 116-10v160c-36-12-86-10-116 10z" fill="url(#g)"/>
    <path d="M130 40v160" stroke="#0a0a0a" stroke-width="4"/>
    <path d="M34 70c25-6 55-5 78 4M34 95c25-6 55-5 78 4M34 120c25-6 55-5 78 4M34 145c25-6 55-5 78 4M148 74c23-9 53-10 78-4M148 99c23-9 53-10 78-4M148 124c23-9 53-10 78-4M148 149c23-9 53-10 78-4" stroke="#0a0a0a" stroke-width="3" opacity=".7"/>
    <path d="M200 8l-8 70" stroke="#C0392B" stroke-width="5" stroke-linecap="round"/></svg>`,
  penna: `<svg viewBox="0 0 220 300" fill="none">${ORO}
    <path d="M190 10C110 30 60 110 50 230l20 4C90 140 130 70 190 10z" fill="url(#g)"/>
    <path d="M190 10C150 60 110 120 70 234" stroke="#0a0a0a" stroke-width="3"/>
    <path d="M50 230l-14 50 30-42" fill="#C9A84C"/><path d="M20 285h180" stroke="#C0392B" stroke-width="4" stroke-linecap="round"/></svg>`,
  tessera: `<svg viewBox="0 0 300 200" fill="none">${ORO}
    <rect x="6" y="6" width="288" height="188" rx="14" fill="#1a0b0b" stroke="url(#g)" stroke-width="6"/>
    <rect x="22" y="22" width="256" height="156" rx="8" stroke="#C9A84C" stroke-width="1.5" opacity=".6"/>
    <text x="150" y="70" text-anchor="middle" font-family="Cinzel Decorative" font-weight="700" font-size="26" fill="#F5F0E8">Vampiri <tspan fill="#C0392B">Italiani</tspan></text>
    <text x="150" y="102" text-anchor="middle" font-family="Cinzel" font-size="13" letter-spacing="5" fill="#E8C96A">TESSERA SOCIO</text>
    <path d="M60 140h180M60 160h120" stroke="#C9A84C" stroke-width="2" opacity=".5"/><circle cx="240" cy="152" r="14" fill="#C0392B"/></svg>`,
};

// ---------- pagine ----------
const PAGINE = [
  { file: 'og-vampiri.jpg', tipo: 'marchio', sotto: 'Prima associazione italiana di assaggiatori di aglio' },
  { file: 'assets/og/home-en.jpg', tipo: 'marchio', sotto: "Italy's first garlic tasting association" },
  { file: 'assets/og/radio.jpg', occhiello: "L'aglio in onda", titolo: 'In radio', sotto: '<em>Segreti in Tavola</em><br>Radio Dimensione Suono Soft', disegno: 'microfono' },
  { file: 'assets/og/articoli.jpg', occhiello: 'Dal Covo', titolo: 'Articoli', sotto: "Indagini sensoriali, storie e metodo dell'aglio", disegno: 'penna' },
  { file: 'assets/og/parole.jpg', occhiello: "Il lessico dell'assaggio", titolo: "Le Parole dell'Aglio", sotto: 'Cosa dire al posto di «forte»', disegno: 'libro' },
  { file: 'assets/og/mappa.jpg', occhiello: 'Coltivi aglio?', titolo: 'La mappa dei produttori', sotto: 'Entra nella mappa: è gratis', disegno: 'segnaposto' },
  { file: 'assets/og/aderisci.jpg', occhiello: 'Entra nel Covo', titolo: 'Diventa Vampiro', sotto: 'Socio, alleato o Custode di un Covo', disegno: 'tessera' },
  { file: 'assets/og/aderisci-en.jpg', occhiello: 'Join the Lair', titolo: 'Become a Vampire', sotto: 'Member, producer, pizzeria or restaurant', disegno: 'tessera' },
  { file: 'assets/og/custode.jpg', occhiello: 'Custodi dei Covi', titolo: 'Apri il tuo Covo', sotto: 'Porta le serate di assaggio nella tua provincia', foto: 'assets/prima-notte-1.jpg' },
  { file: 'assets/og/cofanetto.jpg', occhiello: 'Tre agli neri italiani', titolo: 'Il Cofanetto Nero', sotto: 'Il primo cofanetto di assaggio dei Vampiri', foto: 'ner-01-delfanti.jpg' },
  { file: 'assets/og/cofanetto-en.jpg', occhiello: 'Three Italian black garlics', titolo: 'The Black Garlic Box', sotto: 'Our first tasting box', foto: 'ner-01-delfanti.jpg' },
  { file: 'assets/og/journal-en.jpg', occhiello: 'Vampiri Italiani', titolo: 'Journal', sotto: 'Protocols, measurements and field notes', disegno: 'penna' },
  { file: 'assets/og/metodo-en.jpg', occhiello: 'Journal', titolo: 'The Method', sotto: 'The 100-point scale and the session rules', disegno: 'libro' },
  { file: 'assets/og/aglio-nero-en.jpg', occhiello: 'Journal', titolo: "They Call It Fermented. It Isn't.", sotto: 'What really happens to black garlic', foto: 'ner-02-nerofermento.jpg' },
  { file: 'assets/og/quanto-dura-en.jpg', occhiello: 'Journal', titolo: 'How Long Does Garlic Really Last?', sotto: 'Three sessions, one blind assessor', logo: true },
  { file: 'assets/og/due-teste-en.jpg', occhiello: 'Journal', titolo: 'Two Heads of Garlic and a Night in Separate Rooms', sotto: 'How a garlic tasting association began', logo: true },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@400;600&family=EB+Garamond:ital@0;1&display=block');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#0a0a0a;color:#F5F0E8;font-family:'EB Garamond',serif;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 28% 50%,rgba(139,0,0,.45) 0%,transparent 70%)}
.marchio-p .glow{background:radial-gradient(ellipse 55% 75% at 50% 45%,rgba(139,0,0,.5) 0%,transparent 70%)}
.cornice{position:absolute;inset:22px;border:1px solid rgba(201,168,76,.55)}
.cornice::after{content:'';position:absolute;inset:8px;border:1px solid rgba(201,168,76,.2)}
.occhiello{font-family:'Cinzel',serif;font-size:22px;letter-spacing:.38em;text-transform:uppercase;color:#E8C96A}
.firma{font-family:'Cinzel Decorative',serif;font-weight:700;font-size:28px;letter-spacing:.04em}
.firma span,.marchio h1 span{color:#C0392B}
.vis{position:absolute;left:90px;top:80px;width:380px;height:470px;display:flex;align-items:center;justify-content:center}
.vis svg{width:100%;height:100%}
.vis img.logo{max-width:300px;filter:drop-shadow(0 0 40px rgba(192,57,43,.45))}
.vis img.foto{width:100%;height:100%;object-fit:cover;border:2px solid #C9A84C;box-shadow:0 0 50px rgba(201,168,76,.15)}
.testo{position:absolute;left:530px;right:80px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center}
.testo h1{font-family:'Cinzel Decorative',serif;font-weight:900;line-height:1.05;margin:20px 0 24px;text-shadow:0 0 40px rgba(192,57,43,.35)}
.sotto{font-size:34px;line-height:1.3}.sotto em{color:#E8C96A}
.filo{width:120px;height:1px;background:#C9A84C;margin:28px 0 24px}
.marchio{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.marchio img{height:150px;margin-bottom:18px;filter:drop-shadow(0 0 30px rgba(192,57,43,.4))}
.marchio h1{font-family:'Cinzel Decorative',serif;font-weight:900;font-size:92px;line-height:1.02;text-shadow:0 0 40px rgba(192,57,43,.35)}
.marchio h1 span{display:block}
.marchio .occhiello{font-size:20px;letter-spacing:.28em}
.marchio .filo{width:140px;margin:26px 0 22px}`;

function html(p) {
  if (p.tipo === 'marchio') {
    return `<body class="marchio-p"><div class="glow"></div><div class="cornice"></div><div class="marchio">
      <img src="${fileUrl('assets/aglio-logo.png')}"><h1>Vampiri<span>Italiani</span></h1><div class="filo"></div><div class="occhiello">${p.sotto}</div></div></body>`;
  }
  const n = p.titolo.length;
  const size = n <= 10 ? 100 : n <= 18 ? 78 : n <= 26 ? 62 : n <= 36 ? 52 : 44;
  const vis = p.foto ? `<img class="foto" src="${fileUrl(p.foto)}">` : p.logo ? `<img class="logo" src="${fileUrl('assets/aglio-logo.png')}">` : DISEGNI[p.disegno];
  return `<body><div class="glow"></div><div class="cornice"></div><div class="vis">${vis}</div>
    <div class="testo"><div class="occhiello">${p.occhiello}</div><h1 style="font-size:${size}px">${p.titolo}</h1>
    <div class="sotto">${p.sotto}</div><div class="filo"></div><div class="firma">Vampiri <span>Italiani</span></div></div></body>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const p of PAGINE) {
    const tmp = path.join(require('node:os').tmpdir(), 'anteprima-vampiri.html');
    fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>${html(p)}</html>`);
    await page.goto('file://' + tmp, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(RADICE, p.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
    console.log('✓', p.file);
  }
  await browser.close();
})();
