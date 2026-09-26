// Tylko do pracy nad kodem bez budowania (np. przez `python -m http.server` w src/).
// W zbudowanej aplikacji ten plik jest zastąpiony osadzonymi danymi.
(function () {
  function get(p) { var x = new XMLHttpRequest(); x.open('GET', p, false); x.send(); return JSON.parse(x.responseText); }
  window.SRD = { '2014': get('data/srd-2014.json'), '2024': get('data/srd-2024.json') };
})();
