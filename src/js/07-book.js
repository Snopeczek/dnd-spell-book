/* 07-book.js — księga postaci jako rozkładówka z zakładkami:
   „Karta postaci” (lewa strona: klasa, poziom, cecha, statystyki; prawa: sloty, spis zaklęć, notatki)
   oraz zakładki C i 1–9 z zaklęciami postaci (lewa: lista z przygotowywaniem; prawa: karta zaklęcia).
   Tu też: dodawanie/usuwanie zaklęć z księgi, tworzenie postaci, korekty i ręczne sloty. */
'use strict';

const Book = (() => {
  let root = null;

  /* Liczniki do limitów (zaklęcia „zawsze przygotowane” nie liczą się do limitów). */
  function counts(ch, ver) {
    const s = Store.cur();
    let cantrips = 0, leveled = 0, prepared = 0;
    for (const [id, st] of Object.entries(ch.spells)) {
      const sp = Data.spell(ver, s, id);
      if (!sp || st.always) continue;
      if (sp.l === 0) cantrips++;
      else { leveled++; if (st.prep) prepared++; }
    }
    return { cantrips, leveled, prepared };
  }

  /* Odświeżenie po zmianie księgi: bieżący widok i grubość grzbietów na regale. */
  function afterChange() {
    const kind = Store.app.open && Store.app.open.kind;
    if (kind === 'compendium') Compendium.refresh();
    else if (kind === 'class') ClassBook.refresh();
    else App.render();
    Bookcase.update(); // grubość grzbietu księgi postaci zależy od liczby zaklęć
  }

  /* Dodaje zaklęcie do księgi wskazanej postaci (nie musi być aktywna). Przy pełnym limicie – ostrzeżenie
     z wyborem „Anuluj” / „Dodaj mimo to”. onDone(true) po dodaniu, onDone(false) po anulowaniu. */
  function addTo(ch, sp, onDone = () => {}) {
    const ver = Store.app.ver;
    const add = () => {
      const cast = Rules.casting(ch, ver);
      const c = counts(ch, ver);
      const prep = sp.l > 0 && cast.mode === 'prepared' && (cast.limit == null || c.prepared < cast.limit);
      Store.commit(() => { ch.spells[sp.id] = { prep: !!prep, always: false }; },
        { render: false, undo: `Dodano ${sp.n} do księgi: ${ch.name}.` });
      afterChange();
      onDone(true);
    };
    const lim = limitReached(ch, ver, sp);
    if (!lim) { add(); return; }
    // limit klasy osiągnięty: ostrzeżenie; „Dodaj mimo to” dla featów, przedmiotów, cech rasy
    const cast = Rules.casting(ch, ver);
    Dlg.confirm({
      title: lim.title,
      text: `${esc(ch.name)} ma już <b>${lim.used} z ${lim.max}</b> ${lim.what} (${esc(cast.clsName)}, poziom ${cast.lvl}). `
        + `Kolejne zaklęcie przekroczy limit klasy. Dodaj je mimo to tylko wtedy, gdy postać ma je z innego źródła (feat, przedmiot, cecha rasy) `
        + `albo zwiększ limit w „Korekty i sloty”.`,
      ok: 'Dodaj mimo to', danger: false, onOk: add, onCancel: () => onDone(false),
    });
  }

  function toggleSpell(id) {
    const ver = Store.app.ver, s = Store.cur(), ch = Store.activeChar(s);
    if (!ch) return;
    const sp = Data.spell(ver, s, id);
    if (ch.spells[id]) {
      Store.commit(() => {
        delete ch.spells[id];
        if (ch.ribbons) { ch.ribbons = ch.ribbons.filter(x => x !== id); if (!ch.ribbons.length) delete ch.ribbons; }
      }, { undo: `Usunięto ${sp ? sp.n : 'zaklęcie'} z księgi.`, render: false });
      afterChange();
    } else if (sp) {
      addTo(ch, sp);
    }
  }

  /* Czy zaklęcie wolno upuścić na księgę postaci (przeciąganie): tylko z listy klasy postaci.
     Wyjątki: własna klasa (bez listy SRD) i własne zaklęcia bez przypisanych klas. */
  function fitsClass(ch, sp) {
    if (ch.cls === 'custom') return true;
    const c = sp.c || [];
    const ver = Store.app.ver;
    return Rules.classesOf(ch, ver).some(p => Data.inClass(ver, p.cls, sp)) || (sp.hb && !c.length);
  }

  /* Czy dodanie zaklęcia przekroczy limit klasy? Cantripy – zawsze; zaklęcia z poziomem – tylko klasy „znające” zaklęcia
     (w klasach przygotowujących nadmiarowe zaklęcie trafia do księgi jako nieprzygotowane). */
  function limitReached(ch, ver, sp) {
    const cast = Rules.casting(ch, ver);
    const c = counts(ch, ver);
    if (sp.l === 0 && cast.cantrips != null && c.cantrips >= cast.cantrips)
      return { title: 'Limit cantripów osiągnięty', used: c.cantrips, max: cast.cantrips, what: 'cantripów' };
    if (sp.l > 0 && cast.mode === 'known' && cast.limit != null && c.leveled >= cast.limit)
      return { title: 'Limit znanych zaklęć osiągnięty', used: c.leveled, max: cast.limit, what: 'znanych zaklęć' };
    return null;
  }

  const SHEET = -1; // zakładka „Karta postaci”
  function view(ch) {
    const s = Store.cur();
    return (s.charView[ch.id] = s.charView[ch.id] || { tab: SHEET, sel: null });
  }
  function bookSpells(ch, ver) {
    const s = Store.cur();
    return Object.keys(ch.spells).map(id => Data.spell(ver, s, id) || { id, n: '(usunięte zaklęcie)', l: 0, s: '', ct: '', r: '', missing: true })
      .sort((a, b) => a.l - b.l || a.n.localeCompare(b.n));
  }

  function render(el) {
    root = el;
    const ver = Store.app.ver, s = Store.cur();
    const ch = Store.activeChar(s);
    if (!ch) { el.innerHTML = ''; return; }
    const v = view(ch);
    const spells = bookSpells(ch, ver);
    const n = ClassBook.countByLevel(spells);
    const key = 'char:' + ch.id, rc = Ribbons.count(key, ver);
    if (v.tab === Ribbons.RIB ? !rc : (v.tab !== SHEET && !n[v.tab])) { v.tab = SHEET; v.sel = null; }
    if (v.sel && !ch.spells[v.sel]) v.sel = null;
    const icon = Bookcase.charIcon(ch);
    const tabs = `<button type="button" class="bm bm-sheet" role="tab" data-lv="${SHEET}" aria-selected="${v.tab === SHEET}" style="--i:0" title="Karta postaci">
        <span class="bm-ico">${icon}</span><span class="bm-n">karta</span></button>` + Ribbons.tabHtml(rc, v.tab === Ribbons.RIB) + ClassBook.tabsHtml(n, v.tab);
    el.innerHTML = `<section class="classbook charbook" style="--cover:${Bookcase.charColor(ch)}">
      ${ClassBook.spreadHtml({ tabs, left: '<div id="cb-left"></div>' })}
    </section>`;
    const left = $('#cb-left', el), right = $('#detail', el);
    if (v.tab === SHEET) {
      right.classList.add('static');
      renderSheet(left, ch);
      renderSheetRight(right, ch, n);
    } else {
      renderLevel(left, ch, v.tab, v.tab === Ribbons.RIB ? spells.filter(sp => Ribbons.has(key, sp.id)) : spells.filter(sp => sp.l === v.tab));
      renderCard(false);
    }
    $$('.bm', el).forEach(b => b.onclick = () => goTab(Number(b.dataset.lv)));
    App.fitBook();
  }

  /* Przejście do zakładki z przewróceniem kartek. */
  function goTab(to) {
    const ch = Store.activeChar();
    if (!ch || !root) return;
    const v = view(ch);
    if (to === v.tab || ClassBook.isTurning()) return;
    ClassBook.turnPage(root, v.tab, to, () => { v.tab = to; v.sel = null; Store.save(); render(root); });
  }

  /* Prawa strona zakładki poziomu: karta wybranego zaklęcia. */
  function renderCard(open) {
    const ver = Store.app.ver, s = Store.cur(), ch = Store.activeChar(s);
    const box = $('#detail', root);
    if (!box || !ch) return;
    const v = view(ch);
    const sp = v.sel ? Data.spell(ver, s, v.sel) : null;
    box.innerHTML = sp
      ? SpellCard.html(sp, ver, { ch, ctx: 'book', closable: true })
      : '<div class="empty panel"><p>Wybierz zaklęcie z listy, aby zobaczyć pełny opis.</p></div>';
    box.classList.toggle('open', !!(sp && open));
    box.onclick = e => { if (e.target === box) box.classList.remove('open'); };
  }

  /* Prawa strona karty postaci: sloty, spis zaklęć według poziomów, notatki. */
  function renderSheetRight(box, ch, n) {
    const ver = Store.app.ver, s = Store.cur();
    const cast = Rules.casting(ch, ver);
    const slotCols = cast.slots.map((k, i) => (k ? `<th>${i + 1}</th>` : '')).join('');
    const slotVals = cast.slots.map(k => (k ? `<td>${k}</td>` : '')).join('');
    const extra = [];
    if (cast.pact) extra.push(`Pact slots: ${cast.pact.n} × poziom ${cast.pact.lvl} (odnawiane na krótkim odpoczynku).`);
    if (cast.arcana.length) extra.push(`Mystic Arcanum: poziom ${cast.arcana.join(', ')} (raz na długi odpoczynek).`);
    const slots = slotCols
      ? `<div class="slot-table-wrap"><table class="slot-table"><thead><tr><th>Poziom</th>${slotCols}</tr></thead><tbody><tr><th>Sloty</th>${slotVals}</tr></tbody></table></div>`
      : (extra.length ? '' : '<p class="muted small" style="margin:0">Na tym poziomie postać nie ma jeszcze slotów zaklęć.</p>');
    const total = n.reduce((a, b) => a + b, 0);
    let index;
    if (!total) {
      index = `<div class="empty panel"><p>Księga jest pusta. Dodaj zaklęcia z księgi klasy albo z Kompendium: przyciskiem „+” przy zaklęciu lub na jego karcie.</p>
        <button class="btn primary" data-goto>${ch.cls === 'custom' ? 'Otwórz Kompendium' : 'Otwórz księgę klasy ' + esc(cast.clsName)}</button></div>`;
    } else {
      const prepAt = l => Object.entries(ch.spells).filter(([id, st]) => (st.prep || st.always) && Data.spell(ver, s, id)?.l === l).length;
      index = '<div class="toc">' + n.map((k, l) => (k ? `<button type="button" class="toc-row" data-toc="${l}">
          <span>${l === 0 ? 'Cantrips' : 'Poziom ' + l}</span><span class="toc-dots"></span>
          <span>${k}${l > 0 && cast.mode === 'prepared' ? ` <span class="muted small">(przyg. ${prepAt(l)})</span>` : ''}</span></button>` : '')).join('') + '</div>';
    }
    box.innerHTML = `<h3 style="margin-top:0">Sloty zaklęć</h3>${slots}
      ${extra.map(x => `<p class="small" style="margin:6px 0 0">${x}</p>`).join('')}
      ${ch.override ? '<p class="hint">Sloty ustawione ręcznie (Korekty i sloty).</p>' : ''}
      <h3>Zaklęcia w księdze</h3>${index}
      <h3>Notatki</h3>
      <textarea rows="4" data-k="notes" placeholder="np. zaklęcia z podklasy, przedmioty, featy">${esc(ch.notes)}</textarea>
      ${lookHtml(ch)}`;
    const g = $('[data-goto]', box);
    if (g) g.onclick = () => App.openBook(ch.cls === 'custom' ? { kind: 'compendium' } : { kind: 'class', id: ch.cls });
    $$('[data-toc]', box).forEach(b => b.onclick = () => goTab(Number(b.dataset.toc)));
    $('[data-k=notes]', box).onchange = e => Store.commit(() => { ch.notes = e.target.value; }, { render: false });
    // wygląd księgi: zmiana od razu widoczna na regale, w nagłówku i na okładce (przewinięcie strony zachowane)
    $$('input[name=lk-color], input[name=lk-emb]', box).forEach(r => r.onchange = () => {
      const color = (box.querySelector('input[name=lk-color]:checked') || {}).value || '';
      const emblem = (box.querySelector('input[name=lk-emb]:checked') || {}).value || '';
      const st = box.scrollTop;
      Store.commit(() => {
        if (color || emblem) ch.look = { color: color || null, emblem: emblem || null };
        else delete ch.look;
      });
      const nb = $('#detail');
      if (nb) nb.scrollTop = st;
    });
  }

  /* Sekcja „Wygląd księgi” na karcie postaci: kolor skóry i emblemat (pierwsza opcja = automatyczne). */
  function lookHtml(ch) {
    const look = ch.look || {};
    // emblemat własnej klasy jest już pierwszą opcją („emblemat klasy”), więc nie powtarza się na liście
    const own = look.emblem && look.emblem === ch.cls;
    const auto = Bookcase.autoColor(ch.id), cur = Bookcase.charColor(ch);
    const clsIcon = Bookcase.charIcon({ ...ch, look: null });
    const colors = [`<label class="swatch auto" style="--c:${auto}" title="Automatyczny (stały dla postaci)">
        <input type="radio" name="lk-color" value="" ${!look.color ? 'checked' : ''} aria-label="Kolor automatyczny"><span>A</span></label>`]
      .concat(Bookcase.PALETTE.map(c => `<label class="swatch" style="--c:${c}">
        <input type="radio" name="lk-color" value="${c}" ${look.color === c ? 'checked' : ''} aria-label="Kolor ${c}"><span></span></label>`)).join('');
    const embs = [`<label class="emb" style="--c:${cur}" title="Emblemat klasy">
        <input type="radio" name="lk-emb" value="" ${!look.emblem || own ? 'checked' : ''} aria-label="Emblemat klasy"><span>${clsIcon}</span></label>`]
      .concat(ClassBook.EMBLEM_IDS.filter(e => e !== ch.cls).map(e => `<label class="emb" style="--c:${cur}" title="${e}">
        <input type="radio" name="lk-emb" value="${e}" ${look.emblem === e ? 'checked' : ''} aria-label="Emblemat ${e}"><span>${ClassBook.emblem(e, '')}</span></label>`)).join('');
    return `<h3>Wygląd księgi</h3>
      <div class="field"><span>Kolor skóry</span><div class="swatches">${colors}</div></div>
      <div class="field" style="margin-top:10px"><span>Emblemat (pierwszy: emblemat klasy)</span><div class="emblems">${embs}</div></div>`;
  }

  /* Lewa strona zakładki poziomu: zaklęcia postaci z tego poziomu. */
  function renderLevel(box, ch, l, list) {
    const ver = Store.app.ver, s = Store.cur();
    const cast = Rules.casting(ch, ver);
    const key = 'char:' + ch.id, rib = l === Ribbons.RIB;
    const prepHere = list.filter(sp => ch.spells[sp.id].prep || ch.spells[sp.id].always).length;
    const info = [];
    if (l > 0 && cast.mode === 'prepared') info.push(`Przygotowane na tym poziomie: ${prepHere} z ${list.length}.`);
    if (l > 0 && cast.mode === 'known') info.push(`Znane zaklęcia (limit liczony łącznie na karcie postaci).`);
    const row = sp => {
      const st = ch.spells[sp.id];
      let lead;
      if (sp.l === 0 || sp.missing) lead = '<span style="width:18px"></span>';
      else if (cast.mode === 'known') lead = `<span class="tag ${st.always ? 'ok' : ''}" title="Zaklęcie znane">${st.always ? '★' : 'zn.'}</span>`;
      else lead = `<input type="checkbox" class="prep" data-prep="${esc(sp.id)}" ${st.prep || st.always ? 'checked' : ''} ${st.always ? 'disabled' : ''} title="Przygotowane" aria-label="Przygotowane: ${esc(sp.n)}">`;
      const warn = !sp.missing && !Rules.onClassList(sp, ch) ? '<span class="tag warn">spoza listy klasy</span>' : '';
      return `<div class="book-row${view(ch).sel === sp.id ? ' sel' : ''}" style="--sc:${sp.missing ? 'var(--danger)' : schoolVar(sp.s)}">
        ${lead}
        <div><span class="nm" data-open="${esc(sp.id)}" tabindex="0">${esc(sp.n)}</span>${sp.missing ? '' : SpellCard.tags(sp)}${warn}
          ${st.always ? '<span class="tag ok">zawsze przygotowane</span>' : ''}
          <div class="meta">${sp.missing ? 'Tego zaklęcia nie ma już w danych.' : SpellCard.meta(sp)}</div></div>
        <div class="row" style="gap:2px">
          ${sp.missing ? '' : Ribbons.btn(key, sp.id, sp.n)}
          ${sp.missing || sp.l === 0 ? '' : `<button class="iconbtn" data-always="${esc(sp.id)}" aria-pressed="${!!st.always}" title="Zawsze przygotowane (np. z podklasy); nie liczy się do limitu">★</button>`}
          <button class="iconbtn" data-rm="${esc(sp.id)}" title="Usuń z księgi" aria-label="Usuń ${esc(sp.n)} z księgi">×</button>
        </div></div>`;
    };
    // zakładka „Wstążki”: zaklęcia ze wszystkich poziomów, z nagłówkami poziomów
    let rows = '', last = null;
    for (const sp of list) {
      if (rib && sp.l !== last) { rows += `<div class="book-subhead">${sp.l === 0 ? 'Cantrips' : 'Poziom ' + sp.l}</div>`; last = sp.l; }
      rows += row(sp);
    }
    box.innerHTML = `<div class="listhead"><h3 style="margin:0">${ClassBook.volName(l)}</h3>
        ${ch.cls === 'custom' || rib ? '' : `<button type="button" class="btn small" data-more style="margin-left:auto">+ Dodaj z księgi klasy</button>`}</div>
      ${info.map(x => `<p class="hint" style="margin:0 0 8px">${x}</p>`).join('')}
      ${l > 0 && cast.maxLevel < l ? '<div class="warnbox" style="margin-bottom:10px">Postać nie ma jeszcze slotów tego poziomu.</div>' : ''}
      <div class="book-rows">${rows}</div>`;
    const more = $('[data-more]', box);
    if (more) more.onclick = () => {
      s.shelf = { cls: ch.cls, lvl: l, sel: null, q: '' }; Store.save();
      App.openBook({ kind: 'class', id: ch.cls });
    };
    const pick = id => {
      view(ch).sel = id; Store.save();
      $$('.book-row', box).forEach(r => r.classList.toggle('sel', r.querySelector('.nm')?.dataset.open === id));
      renderCard(true);
    };
    box.onclick = e => {
      const t = e.target;
      const r = t.closest('[data-rib]');
      if (r) {
        // wstążka: przerysowanie księgi (licznik na zakładce, lista „Wstążki”) z zachowaniem przewinięcia strony
        Ribbons.toggle(key, r.dataset.rib);
        const page = $('.page.listcol', root), st = page ? page.scrollTop : 0;
        render(root);
        const np = $('.page.listcol', root); if (np) np.scrollTop = st;
        return;
      }
      if (t.dataset.rm) toggleSpell(t.dataset.rm);
      else if (t.dataset.always) Store.commit(() => { const st = ch.spells[t.dataset.always]; st.always = !st.always; });
      else if (t.dataset.open) pick(t.dataset.open);
    };
    box.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.open) { e.preventDefault(); pick(e.target.dataset.open); } };
    $$('[data-prep]', box).forEach(cb => cb.onchange = () => Store.commit(() => { ch.spells[cb.dataset.prep].prep = cb.checked; }));
  }

  /* Pusta księga „Nowa postać” na regale: tworzy postać i od razu otwiera jej księgę. */
  function addChar() {
    const ver = Store.app.ver;
    const ch = newChar(ver, { name: 'Postać ' + (Store.cur().chars.length + 1) });
    Store.commit(s => { s.chars.push(ch); s.active = ch.id; }, { render: false });
    App.openBook({ kind: 'char', id: ch.id });
    const inp = $('.sheet-head .name');
    if (inp) { inp.focus(); inp.select(); }
  }

  function renderSheet(box, ch) {
    const ver = Store.app.ver, s = Store.cur();
    const cast = Rules.casting(ch, ver);
    const c = counts(ch, ver);
    const taken = (ch.multi || []).map(m => m.cls); // klasa główna nie może powtarzać klasy z multiklasy
    const clsOpts = Data.classes(ver).map(k => `<option value="${k.id}" ${ch.cls === k.id ? 'selected' : ''} ${taken.includes(k.id) ? 'disabled' : ''}>${esc(k.n)}</option>`).join('') +
      `<option value="custom" ${ch.cls === 'custom' ? 'selected' : ''}>Własna klasa…</option>`;
    const abOpts = Object.keys(ABILITIES).map(a => `<option ${ch.ab === a ? 'selected' : ''}>${a}</option>`).join('');
    const stat = (v, k, over = false) => `<div class="stat${over ? ' over' : ''}"><div class="v">${v}</div><div class="k">${k}</div></div>`;
    const limLabel = cast.mixed ? 'Znane i przygotowane' : cast.mode === 'known' ? 'Znane zaklęcia' : 'Przygotowane';
    const limUsed = cast.mode === 'known' || cast.mixed ? c.leveled : c.prepared;

    let stats = stat(cast.dc, 'Spell save DC') + stat(signed(cast.atk), 'Spell attack') + stat(signed(cast.pb), 'Premia biegłości');
    if (cast.cantrips != null) stats += stat(`${c.cantrips}/${cast.cantrips}`, 'Cantrips', c.cantrips > cast.cantrips);
    else stats += stat(c.cantrips, 'Cantrips');
    if (cast.limit != null) stats += stat(`${limUsed}/${cast.limit}`, limLabel, limUsed > cast.limit);
    else stats += stat(limUsed, limLabel);
    stats += stat(cast.maxLevel || '—', 'Najwyższy slot');

    const warn = [];
    for (const p of cast.parts) if (p.C && !p.active) warn.push(`${esc(p.n)} zyskuje czarowanie od poziomu ${p.C.from} (w tej klasie).`);
    if (cast.limit != null && limUsed > cast.limit) warn.push(`Przekroczony limit: ${limLabel.toLowerCase()} ${limUsed}/${cast.limit}. To dozwolone (featy, przedmioty), ale sprawdź, czy tak ma być.`);
    if (cast.cantrips != null && c.cantrips > cast.cantrips) warn.push(`Więcej cantripów niż limit (${c.cantrips}/${cast.cantrips}).`);

    box.innerHTML = `
      <div class="sheet-head">
        <label class="field"><span>Imię postaci</span><input type="text" class="name" value="${esc(ch.name)}" data-k="name"></label>
        <label class="field"><span>Klasa</span><select data-k="cls">${clsOpts}</select></label>
        ${ch.cls === 'custom' ? `<label class="field"><span>Nazwa klasy</span><input type="text" data-k="customName" value="${esc(ch.customName)}" placeholder="np. Artificer"></label>
          <label class="field"><span>Cecha</span><select data-k="ab">${abOpts}</select></label>` : ''}
        <label class="field"><span>${cast.multi ? 'Poziom klasy' : 'Poziom'}</span><input type="number" min="1" max="${20 - (cast.lvl - cast.parts[0].lvl)}" value="${cast.parts[0].lvl}" data-k="lvl"></label>
        <label class="field"><span>Wartość ${cast.ab} (${signed(cast.mod)})</span><input type="number" min="1" max="30" value="${esc(ch.score)}" data-k="score"></label>
      </div>
      ${multiHtml(ch, cast, ver)}
      <div class="row" style="margin:-4px 0 14px">
        <button class="btn" data-adv>Korekty i sloty</button>
        <button class="btn danger" data-del>Usuń postać</button>
      </div>
      <div class="stats">${stats}</div>
      ${cast.multi ? `<p class="hint" style="margin:-4px 0 10px">${cast.parts.filter(p => p.C || p.primary).map(p => `${esc(p.n)}: DC ${p.dc}, atak ${signed(p.atk)} (${p.ab})`).join('; ')}.
        ${cast.casterLevel ? `Sloty z tabeli multiklasy dla poziomu czarującego ${cast.casterLevel}.` : ''}
        Limity cantripów i zaklęć są zsumowane dla wszystkich klas.</p>` : ''}
      ${warn.map(w => `<div class="warnbox" style="margin-bottom:10px">${w}</div>`).join('')}
`;

    const set = (k, v, render = true) => Store.commit(() => { ch[k] = v; }, { render });
    $$('[data-k]', box).forEach(inp => {
      inp.onchange = () => {
        const k = inp.dataset.k;
        let v = inp.value;
        if (k === 'lvl') v = clamp(parseInt(v, 10) || 1, 1, 20 - (cast.lvl - cast.parts[0].lvl)); // łącznie maks. 20
        if (k === 'score') v = clamp(parseInt(v, 10) || 10, 1, 30);
        if (k === 'name') v = v.trim() || 'Bez imienia';
        set(k, v, !['notes'].includes(k));
      };
    });
    $('[data-del]', box).onclick = () => {
      Store.commit(st => {
        st.chars = st.chars.filter(x => x.id !== ch.id);
        st.active = st.chars[0]?.id || null;
      }, { undo: `Usunięto postać ${ch.name}.` });
    };
    $('[data-adv]', box).onclick = () => advancedDialog(ch);
    bindMulti(box, ch, cast, ver);
  }

  /* ---------- multiklasa ---------- */
  /* Klasy, które można dodać: z listy wersji (SRD + własne), bez klas, które postać już ma, bez jednorazowej „Własnej klasy”. */
  function freeClasses(ch, ver) {
    const have = [ch.cls, ...(ch.multi || []).map(m => m.cls)];
    return Data.classes(ver).filter(k => !have.includes(k.id));
  }
  function multiHtml(ch, cast, ver) {
    const rows = (ch.multi || []).map((m, i) => {
      const opts = Data.classes(ver).filter(k => k.id === m.cls || !(k.id === ch.cls || (ch.multi || []).some(x => x.cls === k.id)))
        .map(k => `<option value="${k.id}" ${k.id === m.cls ? 'selected' : ''}>${esc(k.n)}</option>`).join('');
      const p = cast.parts.find(x => x.cls === m.cls);
      const maxL = 20 - (cast.lvl - (p ? p.lvl : 0));
      return `<div class="mc-row">
        <label class="field"><span>Klasa ${i + 2}</span><select data-mc="${i}" data-f="cls">${opts}</select></label>
        <label class="field"><span>Poziom</span><input type="number" min="1" max="${maxL}" value="${p ? p.lvl : 1}" data-mc="${i}" data-f="lvl"></label>
        <label class="field"><span>Wartość ${p ? p.ab : ''} (${p ? signed(p.mod) : '+0'})</span><input type="number" min="1" max="30" value="${esc(m.score ?? 10)}" data-mc="${i}" data-f="score"></label>
        <button type="button" class="iconbtn" data-mcdel="${i}" title="Usuń klasę z multiklasy" aria-label="Usuń klasę ${p ? esc(p.n) : ''}">×</button>
      </div>`;
    }).join('');
    const canAdd = cast.lvl < 20 && freeClasses(ch, ver).length && ch.cls !== 'custom';
    return `<div class="multi">${rows}
      <div class="row" style="gap:8px"><button type="button" class="btn small" data-mcadd ${canAdd ? '' : 'disabled'}
        title="${ch.cls === 'custom' ? 'Jednorazowa własna klasa nie łączy się z multiklasą' : cast.lvl >= 20 ? 'Łączny poziom postaci to już 20' : ''}">+ Dodaj klasę (multiklasa)</button>
        ${cast.multi ? `<span class="muted small">Poziom postaci: ${cast.lvl} (premia biegłości ${signed(cast.pb)})</span>` : ''}</div></div>`;
  }
  function bindMulti(box, ch, cast, ver) {
    const add = $('[data-mcadd]', box);
    if (add) add.onclick = () => {
      const free = freeClasses(ch, ver);
      if (!free.length || cast.lvl >= 20) return;
      Store.commit(() => { ch.multi = [...(ch.multi || []), { cls: free[0].id, lvl: 1, score: 10 }]; });
    };
    $$('[data-mc]', box).forEach(inp => inp.onchange = () => {
      const i = Number(inp.dataset.mc), f = inp.dataset.f, m = ch.multi[i];
      let v = inp.value;
      if (f === 'lvl') { const p = cast.parts.find(x => x.cls === m.cls); v = clamp(parseInt(v, 10) || 1, 1, 20 - (cast.lvl - (p ? p.lvl : 0))); }
      if (f === 'score') v = clamp(parseInt(v, 10) || 10, 1, 30);
      Store.commit(() => { ch.multi[i] = { ...m, [f]: v }; });
    });
    $$('[data-mcdel]', box).forEach(b => b.onclick = () => {
      const i = Number(b.dataset.mcdel), m = ch.multi[i];
      Store.commit(() => { ch.multi = ch.multi.filter((_, j) => j !== i); if (!ch.multi.length) delete ch.multi; },
        { undo: `Usunięto klasę ${(Data.cls(ver, m.cls) || {}).n || ''} z multiklasy.` });
    });
  }

  function openCard(id, ctx) {
    const ver = Store.app.ver, s = Store.cur();
    const sp = Data.spell(ver, s, id);
    if (!sp) return;
    Dlg.open({
      title: sp.n, wide: true, kind: 'card',
      body: SpellCard.html(sp, ver, { ch: Store.activeChar(s), ctx }),
      foot: '<button class="btn" data-x>Zamknij</button>',
      onOpen(d) {
        d.querySelector('.card-head h2').remove();
        d.querySelector('[data-x]').onclick = Dlg.close;
      },
    });
  }

  function advancedDialog(ch) {
    const ver = Store.app.ver;
    const base = Rules.casting({ ...ch, override: null }, ver);
    const o = ch.override || { slots: base.slots.slice(), pactN: base.pact ? base.pact.n : 0, pactL: base.pact ? base.pact.lvl : 1 };
    const adj = ch.adj || { c: 0, s: 0 };
    Dlg.open({
      title: 'Korekty i sloty', wide: true,
      body: `<p class="hint" style="margin:0">Do obsługi featów, przedmiotów, multiclassu i własnych klas. Korekty dodają się do wartości z tabel klasy.</p>
        <div class="grid2">
          <label class="field"><span>Dodatkowe cantripy</span><input type="number" id="a-c" value="${Number(adj.c) || 0}"></label>
          <label class="field"><span>Dodatkowe ${base.mode === 'known' ? 'znane' : 'przygotowane'} zaklęcia</span><input type="number" id="a-s" value="${Number(adj.s) || 0}"></label>
          <label class="field"><span>Premia do DC</span><input type="number" id="a-dc" value="${Number(ch.dcBonus) || 0}"></label>
          <label class="field"><span>Premia do ataku zaklęciem</span><input type="number" id="a-atk" value="${Number(ch.atkBonus) || 0}"></label>
        </div>
        <label class="chk"><input type="checkbox" id="a-ov" ${ch.override ? 'checked' : ''}> Ustaw sloty ręcznie (zamiast z tabeli klasy)</label>
        <div id="a-slots" ${ch.override ? '' : 'hidden'}>
          <div class="slotedit">${o.slots.map((n, i) => `<label>Poz. ${i + 1}<input type="number" min="0" max="9" data-sl="${i}" value="${n}"></label>`).join('')}</div>
          <div class="grid2" style="margin-top:10px">
            <label class="field"><span>Pact slots (liczba, odnawiane na krótkim odpoczynku)</span><input type="number" min="0" max="9" id="a-pn" value="${o.pactN}"></label>
            <label class="field"><span>Poziom pact slotów</span><input type="number" min="1" max="5" id="a-pl" value="${o.pactL}"></label>
          </div>
        </div>`,
      foot: '<button class="btn" data-x>Anuluj</button><button class="btn primary" data-ok>Zapisz</button>',
      onOpen(d) {
        const ov = d.querySelector('#a-ov');
        ov.onchange = () => { d.querySelector('#a-slots').hidden = !ov.checked; };
        d.querySelector('[data-x]').onclick = Dlg.close;
        d.querySelector('[data-ok]').onclick = () => {
          const num = sel => parseInt(d.querySelector(sel).value, 10) || 0;
          Store.commit(() => {
            ch.adj = { c: num('#a-c'), s: num('#a-s') };
            ch.dcBonus = num('#a-dc'); ch.atkBonus = num('#a-atk');
            ch.override = ov.checked ? {
              slots: $$('[data-sl]', d).map(x => clamp(parseInt(x.value, 10) || 0, 0, 9)),
              pactN: clamp(num('#a-pn'), 0, 9), pactL: clamp(num('#a-pl') || 1, 1, 5),
            } : null;
          }, { toast: 'Zapisano korekty.' });
          Dlg.close();
        };
      },
    });
  }

  return { render, toggleSpell, addTo, fitsClass, counts, openCard, addChar, limitReached };
})();
