# Articoli del sito Vampiri Italiani

Ogni articolo è un file `.md` in `contenuti/articoli/`. Le foto stanno in `contenuti/articoli/img/`.
Al salvataggio, GitHub rigenera da solo le pagine (elenco, articoli, categorie, tag, sitemap, feed).

## Nuovo articolo
Crea `contenuti/articoli/AAAA-MM-GG-titolo.md`:

    ---
    titolo: "Il titolo"
    data: 2026-11-03
    categorie: [Cronache]
    tag: [pungenza, metodo]
    sommario: "Due righe per l'elenco e per Google."
    copertina: foto.jpg
    alt_copertina: "Cosa si vede nella foto"
    edg_url: https://www.errantedelgusto.it/vecchio-indirizzo/   (solo per articoli spostati)
    ---
    Testo in Markdown. Foto nel testo: ![descrizione](foto2.jpg "didascalia")

`bozza: true` = non pubblicato. `esempio: true` = compare solo nell'anteprima.

## Comandi
- `npm install` (una volta)
- `npm run anteprima` → cartella `anteprima/` (per vedere gli articoli con `esempio: true`)
- `npm run build` → scrive nella radice del repository

## File
- `build-articoli.mjs` generatore · `assets/` stili (copiati dalla home)
- `.github/workflows/articoli.yml` rigenerazione automatica
- `.pages.yml` editor nel browser (Pages CMS), da collegare con l'account GitHub
- `redirect-edg.txt` generato: vecchio indirizzo → nuovo, per i 301 su Errante del Gusto
- `snippet-home-cronache.html` sostituisce la sezione Cronache della home

Attenzione: `articoli/` nella radice viene riscritta a ogni build, niente file a mano lì dentro.

## Video
In testata: `video: https://www.youtube.com/watch?v=...` nel blocco in alto. Nel testo: una riga `{{video: https://youtube.com/shorts/...}}`.
Accetta YouTube (anche Shorts, in formato verticale) e Vimeo. Usa la categoria `Video` per raccoglierli.
