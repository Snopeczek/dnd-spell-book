/* 06-compendium.js — Kompendium: rozkładówka z zakładkami poziomów (Cantrips, 1–9) ze wszystkimi zaklęciami wersji.
   Filtry z boku i wyszukiwarka zmieniają liczby na zakładkach; lista pokazuje zaklęcia pod wybraną zakładką. */
'use strict';

const Compendium = (() => {
  let root = null;
  const COVER = '#6a5842';
  const KEY = 'compendium:'; // klucz wstążek tej księgi

  /* Zaklęcia pasujące do filtrów (bez podziału na poziomy). */
  function filtered(ver, s) {
    const f = s.filters;
    const q = f.q.trim().toLowerCase();
    const ch = Store.activeChar(s);
    return Data.spells(ver, s).filter(sp => {
      if (q) {
        const inName = sp.n.toLowerCase().includes(q);
        if (!inName && !(f.desc && (sp.x || []).join(' ').toLowerCase().includes(q))) return false;
      }
      if (f.schools.length && !f.schools.includes(sp.s)) return false;
      if (f.cls && !Data.inClass(ver, f.cls, sp)) return false;
      if (f.conc !== 'any' && sp.co !== (f.conc === 'yes')) return false;
      if (f.rit !== 'any' && sp.ri !== (f.rit === 'yes')) return false;
      if (f.src === 'srd' && sp.hb) return false;
      if (f.src === 'hb' && !sp.hb) return false;
      if (f.noM && (sp.cp || []).includes('M')) return false;
      if (f.char && (!ch || !ch.spells[sp.id])) return false;
      return true;
    });
  }

  function render(el) {
    root = el;
    const ver = Store.app.ver, s = Store.cur(), f = s.filters;
    const ch = Store.activeChar(s);
    if (typeof f.lvl !== 'number') f.lvl = 0;
    const scChips = SCHOOLS.map(sc =>
      `<button type="button" class="chip school" style="--sc:${schoolVar(sc)}" data-sc="${sc}" aria-pressed="${f.schools.includes(sc)}">${sc}</button>`).join('');
    const clsOpts = Data.classes(ver).map(c => `<option value="${c.id}" ${f.cls === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('');
    const sel3 = (name, val, a, b) => `<select data-f="${name}">
      <option value="any" ${val === 'any' ? 'selected' : ''}>Dowolne</option>
      <option value="yes" ${val === 'yes' ? 'selected' : ''}>${a}</option>
      <option value="no" ${val === 'no' ? 'selected' : ''}>${b}</option></select>`;

    el.innerHTML = `<div class="layout-comp">
      <aside class="filters panel" aria-label="Filtry">
        <label class="field"><span>Szukaj</span>
          <input type="search" id="q" placeholder="Nazwa zaklęcia…  ( / )" value="${esc(f.q)}" autocomplete="off"></label>
        <label class="chk small" style="margin-top:-8px"><input type="checkbox" data-f="desc" ${f.desc ? 'checked' : ''}> Szukaj także w opisach</label>
        <div class="field"><span>Szkoła</span><div class="chips">${scChips}</div></div>
        <label class="field"><span>Klasa</span><select data-f="cls"><option value="">Wszystkie klasy</option>${clsOpts}</select></label>
        <label class="field"><span>Concentration</span>${sel3('conc', f.conc, 'Tak', 'Nie')}</label>
        <label class="field"><span>Ritual</span>${sel3('rit', f.rit, 'Tak', 'Nie')}</label>
        <label class="field"><span>Źródło</span><select data-f="src">
          <option value="all" ${f.src === 'all' ? 'selected' : ''}>SRD i własne</option>
          <option value="srd" ${f.src === 'srd' ? 'selected' : ''}>Tylko SRD</option>
          <option value="hb" ${f.src === 'hb' ? 'selected' : ''}>Tylko własne</option></select></label>
        <label class="chk small"><input type="checkbox" data-f="noM" ${f.noM ? 'checked' : ''}> Bez komponentu M</label>
        <label class="chk small"><input type="checkbox" data-f="char" ${f.char ? 'checked' : ''} ${ch ? '' : 'disabled'}> Tylko z księgi${ch ? ': ' + esc(ch.name) : ' (brak postaci)'}</label>
        <button type="button" class="btn small" data-clear>Wyczyść filtry</button>
      </aside>
      <section class="classbook" style="--cover:${COVER}">
        <div class="row" style="align-items:flex-end">
          <div><p class="hint" style="margin:0" id="c-sum"></p></div>
        </div>
        ${ClassBook.spreadHtml({ tabsId: 'c-vols', left: `
            <div class="listhead"><h3 style="margin:0" id="c-vol"></h3></div>
            <div id="list"></div>` })}
      </section>
    </div>`;

    const saveF = () => { Store.save(); renderVols(); renderList(); };
    $('#q', el).addEventListener('input', debounce(e => { f.q = e.target.value; saveF(); }, 120));
    $$('[data-sc]', el).forEach(b => b.onclick = () => {
      const sc = b.dataset.sc;
      f.schools = f.schools.includes(sc) ? f.schools.filter(x => x !== sc) : [...f.schools, sc];
      b.setAttribute('aria-pressed', f.schools.includes(sc)); saveF();
    });
    $$('select[data-f]', el).forEach(x => x.onchange = () => { f[x.dataset.f] = x.value; saveF(); });
    $$('input[type=checkbox][data-f]', el).forEach(x => x.onchange = () => { f[x.dataset.f] = x.checked; saveF(); });
    $('[data-clear]', el).onclick = () => {
      // czyści filtry i wyszukiwanie; wybrana zakładka zostaje; nie rusza postaci ani własnych zaklęć
      const lvl = f.lvl;
      s.filters = Object.assign(Store.defaultFilters(), { lvl }); Store.save(); render(el);
    };
    $('#c-vols', el).onclick = e => {
      const b = e.target.closest('.bm');
      if (!b || b.disabled || ClassBook.isTurning()) return;
      const to = Number(b.dataset.lv);
      if (to === f.lvl) return;
      ClassBook.turnPage(root, f.lvl, to, () => { f.lvl = to; Store.save(); renderVols(); renderList(); });
    };

    renderVols();
    renderList();
    renderDetail(false);
    App.fitBook();
  }

  /* Liczby na zakładkach; jeśli pod wybraną nic nie pasuje, przejście do pierwszej zakładki z wynikami. */
  function renderVols() {
    const ver = Store.app.ver, s = Store.cur(), f = s.filters;
    const list = filtered(ver, s);
    const n = ClassBook.countByLevel(list);
    const rc = list.filter(sp => Ribbons.has(KEY, sp.id)).length; // wstążki spełniające filtry
    const empty = f.lvl === Ribbons.RIB ? !rc : !n[f.lvl];
    if (empty && n.some(x => x)) { f.lvl = n.findIndex(x => x > 0); Store.save(); }
    $('#c-vols', root).innerHTML = Ribbons.tabHtml(rc, f.lvl === Ribbons.RIB) + ClassBook.tabsHtml(n, f.lvl);
    const all = Data.spells(ver, s).length;
    $('#c-sum', root).textContent = list.length === all
      ? `${all} ${plural(all, 'zaklęcie', 'zaklęcia', 'zaklęć')} wersji ${ver}`
      : `Pasuje ${list.length} z ${all} zaklęć`;
  }

  function renderList() {
    const ver = Store.app.ver, s = Store.cur(), f = s.filters, ch = Store.activeChar(s);
    const box = $('#list', root);
    const rib = f.lvl === Ribbons.RIB;
    const list = filtered(ver, s).filter(sp => (rib ? Ribbons.has(KEY, sp.id) : sp.l === f.lvl));
    $('#c-vol', root).textContent = ClassBook.volName(f.lvl);
    if (!list.length) {
      box.innerHTML = `<div class="empty panel"><p>Żadne zaklęcie nie pasuje do wyszukiwania i filtrów.</p><button class="btn" data-clear2>Wyczyść filtry</button></div>`;
      $('[data-clear2]', box).onclick = () => { s.filters = Object.assign(Store.defaultFilters(), { lvl: f.lvl }); Store.save(); render(root); };
      return;
    }
    const row = sp => {
        const inBook = ch && ch.spells[sp.id];
        const full = ch && !inBook && Book.limitReached(ch, ver, sp);
        const btn = ch ? `<button type="button" class="iconbtn${full ? ' at-limit' : ''}" data-toggle="${esc(sp.id)}" aria-pressed="${!!inBook}"
            title="${inBook ? 'Usuń z księgi' : full ? full.title + ' (' + full.used + '/' + full.max + ')' : 'Dodaj do księgi'}: ${esc(ch.name)}">${inBook ? '✓' : '+'}</button>` : '';
        const warn = ch && !Rules.onClassList(sp, ch) && inBook ? '<span class="tag warn">spoza listy klasy</span>' : '';
        return `<li class="spell-row" role="option" tabindex="0" data-id="${esc(sp.id)}" aria-selected="${s.sel === sp.id}" style="--sc:${schoolVar(sp.s)}">
          <div class="nm">${esc(sp.n)}${SpellCard.tags(sp)}${warn}</div>
          <div class="meta">${SpellCard.meta(sp)}</div>
          <div class="acts">${Ribbons.btn(KEY, sp.id, sp.n)}${btn}</div></li>`;
    };
    box.innerHTML = `<p class="count">${list.length} ${plural(list.length, 'zaklęcie', 'zaklęcia', 'zaklęć')}</p><ul class="spell-list" role="listbox" aria-label="Zaklęcia">` +
      (rib ? Ribbons.grouped(list, row) : list.map(row).join('')) + '</ul>';
    box.onclick = e => {
      const r = e.target.closest('[data-rib]');
      if (r) {
        e.stopPropagation();
        const on = Ribbons.toggle(KEY, r.dataset.rib);
        r.setAttribute('aria-pressed', on); r.title = on ? 'Zdejmij wstążkę' : 'Załóż wstążkę';
        renderVols(); if (rib) renderList();
        return;
      }
      const t = e.target.closest('[data-toggle]');
      if (t) { e.stopPropagation(); Book.toggleSpell(t.dataset.toggle); return; }
      const row = e.target.closest('.spell-row');
      if (row) select(row.dataset.id);
    };
    box.onkeydown = e => {
      const row = e.target.closest('.spell-row');
      if (!row) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(row.dataset.id); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const rows = $$('.spell-row', box);
        const i = rows.indexOf(row) + (e.key === 'ArrowDown' ? 1 : -1);
        if (rows[i]) { rows[i].focus(); select(rows[i].dataset.id, false); }
      }
    };
  }

  function select(id, open = true) {
    const s = Store.cur();
    s.sel = id; Store.save();
    $$('.spell-row', root).forEach(r => r.setAttribute('aria-selected', r.dataset.id === id));
    renderDetail(open);
  }

  function renderDetail(open) {
    const ver = Store.app.ver, s = Store.cur();
    const box = $('#detail', root);
    const sp = s.sel ? Data.spell(ver, s, s.sel) : null;
    box.innerHTML = sp
      ? SpellCard.html(sp, ver, { ch: Store.activeChar(s), ctx: 'compendium', closable: true })
      : '<div class="empty panel"><p>Wybierz zaklęcie z listy, aby zobaczyć pełny opis.</p></div>';
    box.classList.toggle('open', !!(sp && open));
    box.onclick = e => { if (e.target === box) box.classList.remove('open'); };
  }

  function refresh() { if (root && root.isConnected) { renderVols(); renderList(); renderDetail(false); } }

  return { render, refresh, renderDetail };
})();

function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? few : many;
}
