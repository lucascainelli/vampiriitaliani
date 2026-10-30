# Worker "iscrizione" (modulo della mappa produttori)

Riceve l'iscrizione da `iscriviti-mappa.html` e la scrive in Airtable con Stato "In attesa".
Il token Airtable resta qui, nel Worker, e non arriva mai al browser.

## Attivazione (una volta sola)

1. **Token Airtable con scrittura.** airtable.com/create/tokens → nome "Mappa produttori - modulo sito",
   permesso `data.records:write`, solo sulla base "Vampiri Italiani — Mappa produttori". Copialo.
2. **Cloudflare** → Workers & Pages → Create → Create Worker → nome `vampiri-iscrizione` → Deploy.
3. **Edit code**: cancella tutto, incolla il contenuto di `worker/iscrizione.js` → Deploy.
4. **Settings → Variables and Secrets** → Add → tipo **Secret**, nome `AIRTABLE_TOKEN`, valore: il token del punto 1.
5. Il Worker risponde all'indirizzo `https://vampiri-iscrizione.luca-scainelli.workers.dev`, già scritto in `iscriviti-mappa.html`
   (costante `URL_INVIO`). Se un giorno `vampiriitaliani.it` passa da Cloudflare, si può usare invece la route
   `vampiriitaliani.it/api/iscrizione` e mettere `/api/iscrizione` in `URL_INVIO`.
6. Prova: compila il modulo sul sito. La riga compare in Airtable con Stato "In attesa".

## Anti-spam

- Campo trappola nascosto e tempo minimo di compilazione (sempre attivi).
- Facoltativo: Cloudflare Turnstile. Crea un widget in Cloudflare → Turnstile; metti la "secret key" nel Worker come
  Secret `TURNSTILE_SECRET` e la "site key" in `iscriviti-mappa.html` (costante `TURNSTILE_SITEKEY`).

## Se cambia qualcosa

Dopo ogni modifica a `iscrizione.js`, incolla di nuovo il codice nel Worker (Edit code → Deploy).
