# Pagina «In radio»

La pagina https://vampiriitaliani.it/radio/ elenca le puntate di *Segreti in Tavola* (Radio Dimensione Suono Soft).
Le puntate stanno tutte in un solo file: `contenuti/radio.yml`. Al salvataggio GitHub rigenera la pagina da solo
(in un paio di minuti), come per gli articoli.

## Aggiungere una puntata

### Dall'editor nel browser (Pages CMS)
1. Apri Pages CMS e scegli **In radio**.
2. Aggiungi una voce alla lista **Puntate**: data, titolo, descrizione, link.
3. Salva.

### Direttamente su GitHub
1. Apri `contenuti/radio.yml` e premi la matita (Modifica).
2. Copia questo blocco e incollalo subito sotto la riga `puntate:`, sopra le altre puntate:

       - data: 2026-11-27
         titolo: "Il titolo della puntata"
         descrizione: "Due o tre righe su cosa si racconta."
         link: https://www.dimensionesuonosoft.it/news/indirizzo-della-puntata/

3. Premi **Commit changes**.

Regole:
- **Rientri**: il trattino `-` va con due spazi davanti, le altre righe con quattro. Gli spazi contano, i tab no.
- **Data** nel formato `AAAA-MM-GG`.
- **Virgolette** attorno a titolo e descrizione (soprattutto se c'è un `:`). Se dentro al testo servono le virgolette, usa «caporali».
- L'ordine nel file non conta: la pagina mette sempre la più recente in alto.

## Puntate future
Una puntata con data futura compare in cima come **Prossima puntata** («In onda il …»). Il link si può lasciare vuoto
(o togliere la riga) finché la radio non pubblica la pagina; quando esce, aggiungi il link. Dal giorno della messa
in onda passa da sola fra quelle **Da riascoltare** (la rigenerazione automatica gira ogni mattina).

`bozza: true` nasconde una puntata senza cancellarla.

## File
- `contenuti/radio.yml` le puntate
- `build-articoli.mjs` genera anche `radio/index.html` (non modificarlo a mano: viene riscritto a ogni build)
- `assets/articoli.css` stili della pagina (sezione «pagina In radio»)
