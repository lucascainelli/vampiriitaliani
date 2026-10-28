// Genera le pagine articoli del sito Vampiri Italiani da file Markdown.
//
//   npm run build        → scrive nella radice del repository (sito vero)
//   npm run anteprima    → scrive in ./anteprima, includendo gli articoli di esempio
//
// Sorgenti:  contenuti/articoli/*.md  e  contenuti/articoli/img/*
// Risultato: articoli/ (elenco, articoli, categorie, tag, immagini), sitemap-articoli.xml,
//            articoli/feed.xml, articoli/ultimi.json, redirect-edg.txt

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { Marked } from 'marked';
import sharp from 'sharp';

const SITO = 'https://vampiriitaliani.it';
const NOME = 'Vampiri Italiani';
const SRC = 'contenuti/articoli';

const args = process.argv.slice(2);
const conEsempi = args.includes('--con-esempi');
const chiaro = args.includes('--chiaro'); // corpo dell'articolo su pannello color pergamena
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : '.';
const OUT_ART = path.join(out, 'articoli');

// ---------- utilità ----------
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(String);
const dataIT = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dataISO = (d) => d.toISOString().slice(0, 10);
const scrivi = (file, testo) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, testo); };
const noTag = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const taglia = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '').replace(/[\s.,;:!?\-–—]+$/, '') + '…' : s);

// ---------- immagini ----------
const IMG_SRC = path.join(SRC, 'img');
const immagini = new Map(); // nome file → { base, w, h }
async function preparaImmagini() {
  if (!fs.existsSync(IMG_SRC)) return;
  for (const nome of fs.readdirSync(IMG_SRC)) {
    if (!/\.(jpe?g|png|webp)$/i.test(nome)) continue;
    const base = slugify(path.parse(nome).name);
    const img = sharp(path.join(IMG_SRC, nome), { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    const w = meta.width, h = meta.height;
    for (const larg of [800, 1600]) {
      if (larg > w && larg !== 800) continue;
      await img.clone().resize({ width: Math.min(larg, w) }).webp({ quality: 78 })
        .toFile(path.join(OUT_ART, 'img', `${base}-${larg}.webp`));
    }
    await img.clone().resize({ width: Math.min(1600, w) }).jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(OUT_ART, 'img', `${base}.jpg`));
    await img.clone().resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 80 })
      .toFile(path.join(OUT_ART, 'img', `${base}-og.jpg`));
    immagini.set(nome, { base, w, h, larghe: w >= 1600 ? [800, 1600] : [800] });
  }
}

function pictureHTML(nome, alt, { eager = false, sizes = '(max-width: 780px) 100vw, 740px' } = {}) {
  const i = immagini.get(path.basename(nome));
  if (!i) return `<img src="${esc(nome)}" alt="${esc(alt)}" loading="lazy">`;
  const srcset = i.larghe.map((l) => `/articoli/img/${i.base}-${l}.webp ${Math.min(l, i.w)}w`).join(', ');
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="${sizes}">` +
    `<img src="/articoli/img/${i.base}.jpg" alt="${esc(alt)}" width="${i.w}" height="${i.h}"${i.h > i.w * 1.1 ? ' class="ver"' : ''} ` +
    `${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
}

// ---------- video ----------
// Accetta link YouTube (watch, youtu.be, shorts, embed) e Vimeo. Restituisce l'HTML dell'incorporamento.
function videoHTML(url, titolo = 'Video') {
  url = String(url).trim();
  let src = '', verticale = false, m;
  if ((m = url.match(/youtube\.com\/shorts\/([\w-]{6,})/))) { src = `https://www.youtube-nocookie.com/embed/${m[1]}`; verticale = true; }
  else if ((m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/))([\w-]{6,})/))) src = `https://www.youtube-nocookie.com/embed/${m[1]}`;
  else if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) src = `https://player.vimeo.com/video/${m[1]}`;
  if (!src) { console.warn(`! video non riconosciuto: ${url}`); return ''; }
  return `<div class="video${verticale ? ' verticale' : ''}"><iframe src="${src}" title="${esc(titolo)}" loading="lazy" ` +
    `allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

// ---------- markdown ----------
const marked = new Marked({
  gfm: true,
  renderer: {
    image({ href, title, text }) {
      const fig = pictureHTML(href, text);
      return `<figure>${fig}${title ? `<figcaption>${esc(title)}</figcaption>` : ''}</figure>`;
    },
    link({ href, title, tokens }) {
      const testo = this.parser.parseInline(tokens);
      const esterno = /^https?:\/\//i.test(href) && !href.startsWith(SITO);
      return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${esterno ? ' target="_blank" rel="noopener"' : ''}>${testo}</a>`;
    },
  },
});

// ---------- lettura articoli ----------
const OGGI = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
function leggiArticoli() {
  const file = fs.readdirSync(SRC).filter((f) => f.endsWith('.md'));
  const articoli = [];
  for (const f of file) {
    const { data, content } = matter(fs.readFileSync(path.join(SRC, f), 'utf8'));
    if (data.bozza) continue;
    if (!conEsempi && String(data.data instanceof Date ? data.data.toISOString() : data.data).slice(0, 10) > OGGI) continue; // programmato: esce nel giorno indicato
    if (data.esempio && !conEsempi) continue;
    if (!data.titolo || !data.data) { console.warn(`! ${f}: mancano titolo o data, saltato`); continue; }
    const d = new Date(data.data);
    const slug = data.slug ? slugify(data.slug) : slugify(path.parse(f).name.replace(/^\d{4}-\d{2}-\d{2}-?/, ''));
    const conVideo = content.replace(/^\{\{\s*video:\s*(\S+?)\s*\}\}\s*$/gm, (_, u) => `\n${videoHTML(u, data.titolo)}\n`);
    const html = marked.parse(conVideo).replace(/<p>(<figure>[\s\S]*?<\/figure>)<\/p>/g, '$1');
    const testoPuro = noTag(html);
    const categorie = lista(data.categorie).map((nome) => ({ nome, slug: slugify(nome) }));
    const tag = lista(data.tag).map((nome) => ({ nome, slug: slugify(nome) }));
    articoli.push({
      slug, titolo: String(data.titolo), data: d, categorie, tag, html,
      sommario: data.sommario ? String(data.sommario) : '',
      estratto: taglia(data.sommario ? String(data.sommario) : noTag(html.replace(/<h[1-6][\s\S]*?<\/h[1-6]>/g, '').replace(/<figure[\s\S]*?<\/figure>/g, '')), 190),
      copertina: data.copertina || '', didascaliaCopertina: data.didascalia_copertina ? String(data.didascalia_copertina) : '', altCopertina: data.alt_copertina || data.titolo,
      video: data.video || '', edgUrl: data.edg_url || '', minuti: Math.max(1, Math.round(testoPuro.split(' ').length / 200)),
      url: `/articoli/${slug}/`,
    });
  }
  const visti = new Set();
  for (const a of articoli) { if (visti.has(a.slug)) throw new Error(`Slug duplicato: ${a.slug}`); visti.add(a.slug); }
  return articoli.sort((a, b) => b.data - a.data);
}

// ---------- template ----------
const NAV = `<nav>
  <a href="/" class="nav-brand">Vampiri <span>Italiani</span></a>
  <ul class="nav-links">
    <li><a href="/aderisci.html">Diventa Vampiro</a></li>
    <li><a href="/#manifesto">Manifesto</a></li>
    <li><a href="/#varieta">Varietà</a></li>
    <li><a href="/parole-aglio.html">Le Parole</a></li>
    <li><a href="/articoli/" style="color:var(--gold)">Articoli</a></li>
    <li><a href="/custode.html">Covi</a></li>
    <li><a href="/#masterclass">Masterclass</a></li>
    <li><a href="/#prima-notte">31 Ottobre</a></li>
    <li><a href="/#fiere">Fiere</a></li>
    <li><a href="/cofanetto.html">Cofanetto</a></li>
    <li><a href="/#fondatore">Chi siamo</a></li>
  </ul>
  <div class="lang-switcher"><a href="/articoli/" class="active">IT</a><a href="/index_en.html">EN</a></div>
</nav>`;

const FOOTER = `<footer>
  <div class="footer-logo">Vampiri Italiani <span style="font-size:0.5em; letter-spacing:0.15em; vertical-align:middle; opacity:0.75;">APS</span></div>
  <div class="footer-sub">Prima Associazione Italiana di Assaggiatori di Aglio · Est. 2026</div>
  <div class="footer-links">
    <a href="/">vampiriitaliani.it</a>
    <a href="/articoli/">Articoli</a>
    <a href="https://www.errantedelgusto.it" target="_blank" rel="noopener">errantedelgusto.it</a>
    <a href="/parole-aglio.html">Le Parole dell'Aglio</a>
  </div>
  <div class="footer-copy">L'aglio non morde. Noi sì.</div>
</footer>`;

function pagina({ titolo, descrizione, url, corpo, og = `${SITO}/og-vampiri.jpg`, tipo = 'website', extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1MCWKGRL88"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-1MCWKGRL88");</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titolo)}</title>
<meta name="description" content="${esc(descrizione)}">
<link rel="canonical" href="${SITO}${url}">
<link rel="alternate" type="application/rss+xml" title="${NOME} — Articoli" href="/articoli/feed.xml">
<meta property="og:type" content="${tipo}">
<meta property="og:locale" content="it_IT">
<meta property="og:site_name" content="${NOME}">
<meta property="og:title" content="${esc(titolo)}">
<meta property="og:description" content="${esc(descrizione)}">
<meta property="og:url" content="${SITO}${url}">
<meta property="og:image" content="${og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${og}">
<link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/base.css">
<link rel="stylesheet" href="/assets/articoli.css">
${extraHead}
</head>
<body>
${NAV}
${corpo}
${FOOTER}
</body>
</html>
`;
}

const chipCat = (c) => `<a class="chip" href="/articoli/categoria/${c.slug}/">${esc(c.nome)}</a>`;

function cardHTML(a) {
  const img = a.copertina
    ? `<div class="card-img">${pictureHTML(a.copertina, a.altCopertina, { sizes: '(max-width: 780px) 100vw, 360px' })}</div>`
    : `<div class="card-img"></div>`;
  return `<a class="card" href="${a.url}">${img}<div class="card-body">
    <div class="card-meta">${dataIT(a.data)}${a.categorie[0] ? ' · ' + esc(a.categorie[0].nome) : ''}</div>
    <div class="card-title">${esc(a.titolo)}</div>
    <p class="card-excerpt">${esc(a.estratto)}</p></div></a>`;
}

function filtri(categorie, attiva) {
  const voci = [`<a href="/articoli/"${!attiva ? ' class="attivo"' : ''}>Tutti</a>`]
    .concat(categorie.map((c) => `<a href="/articoli/categoria/${c.slug}/"${attiva === c.slug ? ' class="attivo"' : ''}>${esc(c.nome)}</a>`));
  return `<div class="filtri">${voci.join('')}</div>`;
}

function elenco({ titolo, sottotitolo, eyebrow, articoli, categorie, attiva, url, descrizione }) {
  const corpo = `<main class="pagina"><div class="pagina-inner">
  <div class="section-eyebrow">${esc(eyebrow)}</div>
  <h1 class="section-title">${esc(titolo)}</h1>
  <p class="section-subtitle">${esc(sottotitolo)}</p>
  ${filtri(categorie, attiva)}
  ${articoli.length ? `<div class="griglia">${articoli.map(cardHTML).join('')}</div>` : '<p class="vuoto">Ancora nessun articolo.</p>'}
</div></main>`;
  return pagina({ titolo: `${titolo} — ${NOME}`, descrizione, url, corpo });
}

function paginaArticolo(a, tutti) {
  const altri = tutti.filter((x) => x.slug !== a.slug).slice(0, 3);
  const og = a.copertina && immagini.get(path.basename(a.copertina))
    ? `${SITO}/articoli/img/${immagini.get(path.basename(a.copertina)).base}-og.jpg` : `${SITO}/og-vampiri.jpg`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: a.titolo, description: a.estratto,
    datePublished: dataISO(a.data), image: og, inLanguage: 'it',
    author: { '@type': 'Person', name: 'Luca Scainelli' },
    publisher: { '@type': 'Organization', name: 'Vampiri Italiani APS', url: SITO },
    mainEntityOfPage: `${SITO}${a.url}`,
  };
  const cop = a.copertina ? `<figure class="copertina">${pictureHTML(a.copertina, a.altCopertina, { eager: true })}${a.didascaliaCopertina ? `<figcaption>${esc(a.didascaliaCopertina)}</figcaption>` : ''}</figure>` : '';
  const corpo = `<main class="pagina"><article class="articolo${chiaro ? ' chiaro' : ''}">
  <div class="briciole"><a href="/">Home</a> · <a href="/articoli/">Articoli</a>${a.categorie[0] ? ` · <a href="/articoli/categoria/${a.categorie[0].slug}/">${esc(a.categorie[0].nome)}</a>` : ''}</div>
  <h1>${esc(a.titolo)}</h1>
  <div class="articolo-meta"><time datetime="${dataISO(a.data)}">${dataIT(a.data)}</time><span class="sep">✦</span><span>Luca Scainelli</span><span class="sep">✦</span><span>${a.minuti} min di lettura</span></div>
  ${cop}
  <div class="pannello">
  ${a.video ? videoHTML(a.video, a.titolo) : ''}
  ${a.sommario ? `<p class="sommario">${esc(a.sommario)}</p>` : ''}
  <div class="testo">${a.html}</div>
  </div>
  ${a.categorie.length + a.tag.length ? `<div class="articolo-tag">${a.categorie.map(chipCat).join('')}${a.tag.map((t) => `<a class="chip" href="/articoli/tag/${t.slug}/">#${esc(t.nome)}</a>`).join('')}</div>` : ''}
  <div class="invito"><p>L'aglio si capisce assaggiandolo, e meglio in compagnia.</p><a class="btn-primary" href="/aderisci.html"><span>Diventa Vampiro</span></a></div>
</article>
${altri.length ? `<section class="altri"><h2>Altri articoli</h2><div class="griglia">${altri.map(cardHTML).join('')}</div></section>` : ''}
</main>`;
  return pagina({
    titolo: `${a.titolo} — ${NOME}`, descrizione: a.estratto, url: a.url, corpo, og, tipo: 'article',
    extraHead: `<meta property="article:published_time" content="${dataISO(a.data)}">\n<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
  });
}

// ---------- feed, sitemap, json, redirect ----------
function feedXML(articoli) {
  const voci = articoli.slice(0, 20).map((a) => `  <item>
    <title>${esc(a.titolo)}</title>
    <link>${SITO}${a.url}</link>
    <guid isPermaLink="true">${SITO}${a.url}</guid>
    <pubDate>${a.data.toUTCString()}</pubDate>
    <description>${esc(a.estratto)}</description>
  </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${NOME} — Articoli</title>
  <link>${SITO}/articoli/</link>
  <description>Articoli dei Vampiri Italiani, prima associazione italiana di assaggiatori di aglio.</description>
  <language>it</language>
${voci}
</channel></rss>
`;
}

function sitemapXML(articoli, categorie, tag) {
  const u = (loc, lastmod) => `  <url><loc>${SITO}${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
  const righe = [u('/articoli/', articoli[0] && dataISO(articoli[0].data))]
    .concat(articoli.map((a) => u(a.url, dataISO(a.data))))
    .concat(categorie.map((c) => u(`/articoli/categoria/${c.slug}/`)))
    .concat(tag.map((t) => u(`/articoli/tag/${t.slug}/`)));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${righe.join('\n')}
</urlset>
`;
}

// ---------- main ----------
async function main() {
  fs.rmSync(OUT_ART, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT_ART, 'img'), { recursive: true });
  if (out !== '.') { // anteprima: porta con sé gli stili
    fs.cpSync('assets', path.join(out, 'assets'), { recursive: true });
  }
  await preparaImmagini();
  const articoli = leggiArticoli();

  const mappa = (chiave) => {
    const m = new Map();
    for (const a of articoli) for (const x of a[chiave]) if (!m.has(x.slug)) m.set(x.slug, x);
    return [...m.values()].sort((p, q) => p.nome.localeCompare(q.nome, 'it'));
  };
  const categorie = mappa('categorie');
  const tag = mappa('tag');

  scrivi(path.join(OUT_ART, 'index.html'), elenco({
    eyebrow: 'Dal Covo', titolo: 'Articoli', sottotitolo: "Indagini sensoriali, storie e metodo dell'aglio",
    articoli, categorie, attiva: '', url: '/articoli/',
    descrizione: "Gli articoli dei Vampiri Italiani: indagini sensoriali, storie e metodo per assaggiare l'aglio.",
  }));
  for (const c of categorie) {
    scrivi(path.join(OUT_ART, 'categoria', c.slug, 'index.html'), elenco({
      eyebrow: 'Categoria', titolo: c.nome, sottotitolo: `Articoli in «${c.nome}»`,
      articoli: articoli.filter((a) => a.categorie.some((x) => x.slug === c.slug)), categorie, attiva: c.slug,
      url: `/articoli/categoria/${c.slug}/`, descrizione: `Articoli dei Vampiri Italiani nella categoria ${c.nome}.`,
    }));
  }
  for (const t of tag) {
    scrivi(path.join(OUT_ART, 'tag', t.slug, 'index.html'), elenco({
      eyebrow: 'Tag', titolo: `#${t.nome}`, sottotitolo: `Articoli con il tag «${t.nome}»`,
      articoli: articoli.filter((a) => a.tag.some((x) => x.slug === t.slug)), categorie, attiva: '',
      url: `/articoli/tag/${t.slug}/`, descrizione: `Articoli dei Vampiri Italiani con il tag ${t.nome}.`,
    }));
  }
  for (const a of articoli) scrivi(path.join(OUT_ART, a.slug, 'index.html'), paginaArticolo(a, articoli));

  scrivi(path.join(OUT_ART, 'feed.xml'), feedXML(articoli));
  scrivi(path.join(out, 'sitemap-articoli.xml'), sitemapXML(articoli, categorie, tag));
  scrivi(path.join(OUT_ART, 'ultimi.json'), JSON.stringify(articoli.slice(0, 3).map((a) => ({
    titolo: a.titolo, url: a.url, data: dataISO(a.data), dataIT: dataIT(a.data), estratto: a.estratto,
    immagine: a.copertina && immagini.get(path.basename(a.copertina)) ? `/articoli/img/${immagini.get(path.basename(a.copertina)).base}-800.webp` : '',
  })), null, 1));
  const redirect = articoli.filter((a) => a.edgUrl).map((a) => `${a.edgUrl}\t${SITO}${a.url}`);
  scrivi(path.join(out, 'redirect-edg.txt'), redirect.join('\n') + (redirect.length ? '\n' : ''));
  const htaccess = articoli.filter((a) => a.edgUrl).map((a) => `Redirect 301 ${new URL(a.edgUrl).pathname} ${SITO}${a.url}`);
  scrivi(path.join(out, 'redirect-edg.htaccess'), htaccess.join('\n') + (htaccess.length ? '\n' : ''));

  console.log(`✓ ${articoli.length} articoli, ${categorie.length} categorie, ${tag.length} tag → ${path.resolve(out)}`);
  if (redirect.length) console.log(`✓ ${redirect.length} redirect per EDG in redirect-edg.txt`);
}
main().catch((e) => { console.error(e); process.exit(1); });
