/* 10-settings.js — księga „Ustawienia i dane” na regale: kopia zapasowa, import, czyszczenie wersji, motyw, licencje. */
'use strict';

const ATTRIBUTION = {
  '2014': 'This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.',
  '2024': 'This work includes material from the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
};

const Settings = (() => {
  function exportData(versions) {
    const out = { app: 'dnd-spell-book', format: 1, exported: new Date().toISOString(), versions: {} };
    for (const v of versions) {
      const s = Store.vs[v];
      out.versions[v] = { chars: s.chars, homebrew: s.homebrew, classes: s.classes || [] };
    }
    return JSON.stringify(out, null, 2);
  }

  /* Import dodaje postacie, własne zaklęcia i własne klasy (z nowymi identyfikatorami i przemapowaniem odwołań:
     zaklęcia w księgach, wstążki, klasy postaci, listy zaklęć klas); niczego nie nadpisuje. */
  function importData(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return 'To nie jest poprawny plik JSON.'; }
    if (!data || data.app !== 'dnd-spell-book' || !data.versions) return 'Ten plik nie jest kopią zapasową DnD Spell Book.';
    const snap = JSON.stringify({ 2014: Store.vs['2014'], 2024: Store.vs['2024'] });
    let nc = 0, nh = 0, nk = 0;
    for (const v of Store.VERSIONS) {
      const src = data.versions[v];
      if (!src) continue;
      const s = Store.vs[v];
      const map = {};
      for (const h of src.homebrew || []) {
        const id = uid('hb'); map[h.id] = id;
        s.homebrew.push({ ...h, id, hb: true }); nh++;
      }
      // własne klasy: nowe id; ich listy zaklęć wskazują na przemapowane własne zaklęcia
      const cmap = {};
      for (const k of src.classes || []) {
        const id = uid('cc'); cmap[k.id] = id;
        s.classes.push({ ...k, id, spells: (k.spells || []).map(x => map[x] || x) }); nk++;
      }
      s.homebrew.forEach(h => { if (h.c) h.c = h.c.map(x => cmap[x] || x); });
      for (const c of src.chars || []) {
        const spells = {};
        for (const [k, st] of Object.entries(c.spells || {})) spells[map[k] || k] = st;
        const extra = c.ribbons ? { ribbons: c.ribbons.map(x => map[x] || x) } : {};
        const ch = newChar(v, { ...c, id: uid('ch'), spells, cls: cmap[c.cls] || c.cls, ...extra });
        if (ch.conc) ch.conc.id = map[ch.conc.id] || ch.conc.id;
        s.chars.push(ch); nc++;
        if (!s.active) s.active = ch.id;
      }
      Store.migrateCustomClasses(s, v); // postać z klasą, której nie ma w kopii ani w SRD
      Store.save(v);
    }
    App.render();
    const parts = [`${nc} ${plural(nc, 'postać', 'postacie', 'postaci')}`, `${nh} ${plural(nh, 'własne zaklęcie', 'własne zaklęcia', 'własnych zaklęć')}`];
    if (nk) parts.push(`${nk} ${plural(nk, 'własną klasę', 'własne klasy', 'własnych klas')}`);
    Toast.show(`Zaimportowano: ${parts.join(', ')}.`, () => {
      const o = JSON.parse(snap);
      for (const v of Store.VERSIONS) { Store.vs[v] = o[v]; Store.save(v); }
      App.render(); Toast.show('Cofnięto import.');
    });
    return null;
  }

  /* Otwiera księgę „Ustawienia i dane” (np. z linku w stopce). */
  function open() { App.openBook({ kind: 'settings' }); }

  function render(el) {
    const ver = Store.app.ver, other = ver === '2014' ? '2024' : '2014';
    const s = Store.cur();
    const th = Store.app.theme;
    el.innerHTML = `<div class="settings">
      <section class="panel">
        <h3>Kopia zapasowa</h3>
        <p class="small">Dane zapisują się automatycznie w przeglądarce (localStorage). Wyczyszczenie danych przeglądarki je usunie, więc co jakiś czas zrób kopię do pliku.</p>
        ${Store.storageOk ? '' : '<div class="warnbox" style="margin-bottom:10px">Przeglądarka blokuje zapis danych. Zmiany znikną po zamknięciu; zrób kopię zapasową.</div>'}
        <div class="row">
          <button class="btn primary" data-exp="both">Zapisz kopię (obie wersje)</button>
          <button class="btn" data-exp="cur">Tylko ${ver}</button>
          <button class="btn ghost" data-showjson>Pokaż jako tekst</button>
        </div>
        <textarea id="json-out" rows="6" readonly hidden style="margin-top:10px"></textarea>
        <h3>Wczytaj kopię</h3>
        <p class="small" style="margin-top:0">Wczytanie <b>dodaje</b> postacie i własne zaklęcia do odpowiednich wersji. Nic nie zostaje nadpisane; można cofnąć.</p>
        <div class="row">
          <label class="btn">Wybierz plik…<input type="file" accept=".json,application/json" id="imp-file" hidden></label>
          <button class="btn ghost" data-paste>Wklej tekst</button>
        </div>
        <div id="paste-box" hidden style="margin-top:10px">
          <textarea id="imp-text" rows="5" placeholder="Wklej zawartość kopii zapasowej"></textarea>
          <button class="btn" data-imp-text style="margin-top:6px">Wczytaj wklejony tekst</button>
        </div>
        <p class="hint" id="imp-err" style="color:var(--danger)" hidden></p>
      </section>

      <section class="panel">
        <h3>Wygląd</h3>
        <div class="row">
          ${[['auto', 'Jak w systemie'], ['light', 'Jasny'], ['dark', 'Ciemny']].map(([k, l]) =>
            `<label class="chk"><input type="radio" name="theme" value="${k}" ${th === k ? 'checked' : ''}> ${l}</label>`).join('')}
        </div>
        <h3>Wyczyść dane wersji ${ver}</h3>
        <p class="small" style="margin-top:0">Usuwa w wersji ${ver}: wszystkie postacie z księgami (${s.chars.length}), własne zaklęcia (${s.homebrew.length}), własne klasy (${(s.classes || []).length}), filtry Kompendium i zapamiętaną zakładkę księgi klasy.<br>
          Zostaje: wersja ${other} w całości i motyw. Można cofnąć.</p>
        <button class="btn danger" data-clear ${s.chars.length || s.homebrew.length || (s.classes || []).length ? '' : 'disabled'}>Wyczyść dane wersji ${ver}</button>
      </section>

      <section class="panel legal" style="grid-column:1/-1">
        <h3>Źródła i licencje</h3>
        <p>Dane o zaklęciach i klasach pochodzą z dokumentów System Reference Document i zostały pobrane z projektu
          <b>5e-bits/5e-database</b> (licencja MIT; ${esc(Data.srd('2014').source)}). Na potrzeby programu zostały przetworzone:
          skrócone do potrzebnych pól, przeformatowane, a tabele obrażeń i leczenia dla wersji 2024 wyliczone z opisów.</p>
        <p><b>Wersja 2014 (SRD 5.1).</b> ${esc(ATTRIBUTION['2014'])}</p>
        <p><b>Wersja 2024 (SRD 5.2).</b> ${esc(ATTRIBUTION['2024'])}</p>
        <p class="muted">DnD Spell Book nie jest produktem Wizards of the Coast i nie jest przez nich wspierany. Program zawiera wyłącznie treści z SRD; zaklęcia spoza SRD możesz dodać jako własne.</p>
      </section>
    </div>`;

    $$('[data-exp]', el).forEach(b => b.onclick = () => {
      const both = b.dataset.exp === 'both';
      const date = new Date().toISOString().slice(0, 10);
      download(`dnd-spell-book-${both ? 'kopia' : ver}-${date}.json`, exportData(both ? Store.VERSIONS : [ver]));
    });
    $('[data-showjson]', el).onclick = () => {
      const t = $('#json-out', el); t.hidden = false; t.value = exportData(Store.VERSIONS); t.select();
    };
    const showErr = msg => { const e = $('#imp-err', el); e.hidden = !msg; e.textContent = msg || ''; };
    $('#imp-file', el).onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      f.text().then(t => showErr(importData(t)));
      e.target.value = '';
    };
    $('[data-paste]', el).onclick = () => { $('#paste-box', el).hidden = false; $('#imp-text', el).focus(); };
    $('[data-imp-text]', el).onclick = () => showErr(importData($('#imp-text', el).value));
    $$('input[name=theme]', el).forEach(r => r.onchange = () => { Store.app.theme = r.value; Store.saveApp(); App.applyTheme(); });
    $('[data-clear]', el).onclick = () => Dlg.confirm({
      title: `Wyczyścić dane wersji ${ver}?`,
      text: `Zostaną usunięte wszystkie postacie, ich księgi, własne zaklęcia i własne klasy wersji ${ver}. Wersja ${other} pozostanie bez zmian. Po wyczyszczeniu możesz jeszcze kliknąć „Cofnij”.`,
      ok: 'Wyczyść',
      onOk: () => Store.replaceVersion(ver, Store.defaultVS(), `Wyczyszczono dane wersji ${ver}.`),
    });
  }

  return { render, open, exportData, importData };
})();
