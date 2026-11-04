// Mappa produttori di Vampiri Italiani (Leaflet). Legge assets/produttori.json.
(function () {
  var el = document.getElementById('mappa-produttori');
  if (!el || typeof L === 'undefined') return;
  var en = document.documentElement.lang === 'en';
  var t = en
    ? { vuota: 'The map is just starting: the first producers are coming.', privato: 'Private grower', assaggiato: 'Tasted by Vampiri Italiani' }
    : { vuota: 'La mappa è appena partita: i primi produttori stanno arrivando.', privato: 'Coltivatore privato', assaggiato: 'Assaggiato da Vampiri Italiani' };

  var mappa = L.map(el, { scrollWheelZoom: false }).setView([42.0, 12.5], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 12,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mappa);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icona(assaggiato) {
    var colore = assaggiato ? '#C9A84C' : '#8B0000';
    return L.divIcon({
      className: '',
      html: '<span style="display:block;width:16px;height:16px;border-radius:50%;background:' + colore +
        ';border:2px solid #F5F0E8;box-shadow:0 0 0 1px #0A0A0A"></span>',
      iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -10]
    });
  }

  fetch('/assets/produttori.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (punti) {
      if (!punti.length) {
        var nota = document.getElementById('mappa-vuota');
        if (nota) nota.textContent = t.vuota;
        return;
      }
      var gruppo = [];
      var perPosto = {};
      punti.forEach(function (p) {
        var k = p.lat + ',' + p.lng;
        (perPosto[k] = perPosto[k] || []).push(p);
      });
      Object.keys(perPosto).forEach(function (k) {
        var lista = perPosto[k];
        var html = lista.map(function (p) {
          return '<div style="margin-bottom:6px"><strong>' + (p.privato ? t.privato : esc(p.nome)) + '</strong><br>' +
            (p.ecotipo ? esc(p.ecotipo) : '') +
            (p.assaggiato ? '<br><em>' + t.assaggiato + '</em>' : '') + '</div>';
        }).join('') + '<div>' + esc(lista[0].comune) + (lista[0].provincia ? ' (' + esc(lista[0].provincia) + ')' : '') + '</div>';
        var assaggiato = lista.some(function (p) { return p.assaggiato; });
        var lat = lista[0].lat, lng = lista[0].lng;
        L.marker([lat, lng], { icon: icona(assaggiato) }).bindPopup(html).addTo(mappa);
        gruppo.push([lat, lng]);
      });
      if (gruppo.length > 1) mappa.fitBounds(gruppo, { padding: [30, 30], maxZoom: 9 });
      else mappa.setView(gruppo[0], 9);
    })
    .catch(function () {});
})();
