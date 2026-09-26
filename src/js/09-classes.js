/* 09-classes.js — własne klasy (np. Artificer z własnego podręcznika): edytor, usuwanie, lista zaklęć klasy.
   Program nie zawiera treści spoza SRD: klasę dostarcza plik kopii zapasowej, a jej dane wpisuje użytkownik.
   Klasa: { id, n, ab, caster, mode, color, emblem, rows: [{c, p}] × 20, spells: [id] }.
   Sloty wylicza Data.cls z typu czarującego (jak w tabelach pojedynczych klas SRD). Edytor otwiera przycisk
   „Edytuj klasę” w księdze klasy. */
'use strict';

const Classes = (() => {
  const COLORS = ['#7b3a2c', '#8c3a5e', '#94701f', '#3e6a3a', '#2e5f8e', '#4b3372', '#243f6b', '#5a5f66', '#6a4a2e', '#2e4f60', '#9e3b2b', '#56682e'];
  const CASTERS = [
    ['full', 'Pełny (jak Wizard)'],
    ['halfUp', 'Półczarujący od 1. poz.'],
    ['halfDown', 'Półczarujący od 2. poz. (Paladin 2014)'],
    ['third', 'Jedna trzecia od 3. poz.'],
    ['pact', 'Pakt (jak Warlock)'],
    ['none', 'Bez slotów (tylko cantripy)'],
  ];

  function blank() {
    return {
      id: uid('cc'), n: '', ab: 'INT', caster: 'halfUp', mode: 'prepared', color: COLORS[5], emblem: 'gear',
      rows: Array.from({ length: 20 }, () => ({ c: 0, p: '' })), spells: [],
    };
  }

  function editor(id) {
    const ver = Store.app.ver, s = Store.cur();
    const existing = id ? s.classes.find(c => c.id === id) : null;
    const cc = JSON.parse(JSON.stringify(existing || blank()));
    const srdOpts = Object.keys(Data.srd(ver).classes).sort()
      .map(k => `<option value="${k}">${esc(Data.srd(ver).classes[k].n)}</option>`).join('');
    const rowsHtml = cc.rows.map((r, i) => `<tr><th>${i + 1}</th>
        <td><input type="number" min="0" max="20" data-c="${i}" value="${Number(r.c) || 0}" aria-label="Cantripy na poziomie ${i + 1}"></td>
        <td><input type="number" min="0" max="40" data-p="${i}" value="${r.p === '' || r.p == null ? '' : Number(r.p)}" placeholder="—" aria-label="Zaklęcia na poziomie ${i + 1}"></td></tr>`).join('');
    Dlg.open({
      title: existing ? `Edytuj klasę: ${cc.n}` : 'Nowa klasa', wide: true, kind: 'class-editor',
      body: `
        <p class="hint" style="margin:0">Dane klasy wpisujesz sam (np. ze swojego podręcznika); są zapisywane tylko u Ciebie (wersja ${ver}). Sloty program liczy z typu czarującego.</p>
        <div class="grid3">
          <label class="field" style="grid-column:span 2"><span>Nazwa klasy</span><input type="text" id="k-n" value="${esc(cc.n)}"></label>
          <label class="field"><span>Cecha rzucania</span><select id="k-ab">${Object.keys(ABILITIES).map(a => `<option value="${a}" ${cc.ab === a ? 'selected' : ''}>${ABILITIES[a]}</option>`).join('')}</select></label>
          <label class="field" style="grid-column:span 2"><span>Typ czarującego</span>
            <select id="k-caster">${CASTERS.map(([k, l]) => `<option value="${k}" ${cc.caster === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field"><span>Zaklęcia z poziomem</span><select id="k-mode">
            <option value="prepared" ${cc.mode === 'prepared' ? 'selected' : ''}>Przygotowywane</option>
            <option value="known" ${cc.mode === 'known' ? 'selected' : ''}>Znane</option></select></label>
        </div>
        <div class="field"><span>Kolor okładki</span><div class="swatches">${COLORS.map(c => `<label class="swatch" style="--c:${c}">
            <input type="radio" name="k-color" value="${c}" ${cc.color === c ? 'checked' : ''} aria-label="Kolor ${c}"><span></span></label>`).join('')}</div></div>
        <div class="field"><span>Emblemat</span><div class="emblems">${ClassBook.EMBLEM_IDS.map(e => `<label class="emb" style="--c:${cc.color}" title="${e}">
            <input type="radio" name="k-emb" value="${e}" ${cc.emblem === e ? 'checked' : ''} aria-label="Emblemat ${e}"><span>${ClassBook.emblem(e, '')}</span></label>`).join('')}</div></div>
        <div class="field"><span>Cantripy i zaklęcia na poziomach (puste pole „zaklęcia” = bez limitu)</span>
          <div class="row" style="margin-bottom:6px"><span class="small muted">Wypełnij jak klasa z SRD:</span>
            <select id="k-copy">${srdOpts}</select><button type="button" class="btn small" data-copy>Wypełnij</button></div>
          <div class="lvl-table-wrap"><table class="lvl-table"><thead><tr><th>Poziom</th><th>Cantripy</th><th id="k-phead">${cc.mode === 'known' ? 'Znane' : 'Przygotowane'}</th></tr></thead>
            <tbody>${rowsHtml}</tbody></table></div>
        </div>
        <p class="hint" id="k-err" style="color:var(--danger)" hidden>Podaj nazwę klasy.</p>`,
      foot: `${existing ? '<button class="btn danger" data-del style="margin-right:auto">Usuń klasę</button>' : ''}
        <button class="btn" data-x>Anuluj</button><button class="btn primary" data-ok>${existing ? 'Zapisz zmiany' : 'Utwórz klasę'}</button>`,
      onOpen(d) {
        const g = sel => d.querySelector(sel);
        g('#k-n').focus();
        g('#k-mode').onchange = e => { g('#k-phead').textContent = e.target.value === 'known' ? 'Znane' : 'Przygotowane'; };
        $$('input[name=k-color]', d).forEach(r => r.onchange = () => $$('.emb', d).forEach(e => e.style.setProperty('--c', r.value)));
        g('[data-copy]').onclick = () => {
          const t = Data.srd(ver).classes[g('#k-copy').value].t;
          for (let i = 0; i < 20; i++) {
            const row = t[String(i + 1)] || {};
            g(`[data-c="${i}"]`).value = row.c || 0;
            g(`[data-p="${i}"]`).value = 'p' in row ? row.p : 'k' in row ? row.k : '';
          }
        };
        g('[data-x]').onclick = Dlg.close;
        const del = g('[data-del]');
        if (del) del.onclick = () => { Dlg.close(); remove(cc.id); };
        g('[data-ok]').onclick = () => {
          const n = g('#k-n').value.trim();
          if (!n) { g('#k-err').hidden = false; g('#k-n').focus(); return; }
          Object.assign(cc, {
            n, ab: g('#k-ab').value, caster: g('#k-caster').value, mode: g('#k-mode').value,
            color: (d.querySelector('input[name=k-color]:checked') || {}).value || cc.color,
            emblem: (d.querySelector('input[name=k-emb]:checked') || {}).value || cc.emblem,
            rows: Array.from({ length: 20 }, (_, i) => {
              const p = g(`[data-p="${i}"]`).value.trim();
              return { c: clamp(parseInt(g(`[data-c="${i}"]`).value, 10) || 0, 0, 20), p: p === '' ? '' : clamp(parseInt(p, 10) || 0, 0, 40) };
            }),
          });
          Dlg.close();
          if (existing) {
            Store.commit(st => { const i = st.classes.findIndex(c => c.id === cc.id); st.classes[i] = cc; }, { undo: `Zapisano zmiany w klasie ${n}.` });
          } else {
            Store.commit(st => { st.classes.push(cc); }, { render: false, undo: `Utworzono klasę ${n}.` });
            App.openBook({ kind: 'class', id: cc.id });
          }
        };
      },
    });
  }

  /* Usunięcie klasy (z „Cofnij”). Postacie tej klasy dostają jednorazową „Własną klasę” o tej samej nazwie,
     cesze i slotach (ręcznych, według ich poziomu). */
  function remove(id) {
    const ver = Store.app.ver, s = Store.cur();
    const cc = s.classes.find(c => c.id === id);
    if (!cc) return;
    const C = Data.cls(ver, id);
    Store.commit(st => {
      for (const ch of st.chars) {
        if (ch.cls !== id) continue;
        const row = C.t[String(clamp(Number(ch.lvl) || 1, 1, 20))];
        const pactIdx = C.pact ? row.s.findIndex(x => x > 0) : -1;
        ch.cls = 'custom'; ch.customName = cc.n; ch.ab = cc.ab;
        ch.override = C.pact
          ? { slots: Array(9).fill(0), pactN: pactIdx >= 0 ? row.s[pactIdx] : 0, pactL: pactIdx >= 0 ? pactIdx + 1 : 1 }
          : { slots: row.s.slice(), pactN: 0, pactL: 1 };
      }
      st.homebrew.forEach(h => { h.c = (h.c || []).filter(x => x !== id); });
      st.classes = st.classes.filter(c => c.id !== id);
      delete st.ribbons['class:' + id];
      if (st.shelf.cls === id) st.shelf = { cls: null, lvl: null, sel: null, q: '' };
    }, { undo: `Usunięto klasę ${cc.n}.` });
  }

  /* Dodanie zaklęcia do listy własnej klasy (przeciąganie na grzbiet jej księgi). */
  function addSpell(id, sp) {
    const cc = Store.cur().classes.find(c => c.id === id);
    if (!cc || cc.spells.includes(sp.id)) return false;
    Store.commit(() => { cc.spells.push(sp.id); }, { render: false, undo: `Dodano ${sp.n} do listy klasy ${cc.n}.` });
    const o = Store.app.open;
    if (o && o.kind === 'class' && o.id === id) ClassBook.render($('#view'));
    else if (o && o.kind === 'compendium') Compendium.refresh();
    Bookcase.update();
    return true;
  }

  function unlist(id, spId) {
    const s = Store.cur(), cc = s.classes.find(c => c.id === id);
    if (!cc) return;
    const sp = Data.spell(Store.app.ver, s, spId);
    Store.commit(() => { cc.spells = cc.spells.filter(x => x !== spId); }, { undo: `Usunięto ${sp ? sp.n : 'zaklęcie'} z listy klasy ${cc.n}.` });
  }

  return { editor, remove, addSpell, unlist };
})();
