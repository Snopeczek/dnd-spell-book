/* 08-homebrew.js — księga „Własne zaklęcia” (rozkładówka z zakładkami „Wstążki”, C, 1–9), edytor, kopiowanie z SRD, usuwanie z „Cofnij”. */
'use strict';

const Homebrew = (() => {
  const KEY = 'homebrew:'; // klucz wstążek tej księgi
  let root = null;

  /* Księga „Własne zaklęcia” jako rozkładówka: zakładki „Wstążki” i C, 1–9; lewa strona – lista z edycją
     i usuwaniem, prawa – karta wybranego zaklęcia. */
  function render(el) {
    root = el;
    const ver = Store.app.ver, s = Store.cur(), v = s.hbView;
    const list = s.homebrew.slice().sort((a, b) => a.l - b.l || a.n.localeCompare(b.n));
    const n = ClassBook.countByLevel(list);
    const rc = Ribbons.count(KEY, ver);
    if (v.lvl === Ribbons.RIB ? !rc : (v.lvl == null || !n[v.lvl])) v.lvl = Math.max(0, n.findIndex(x => x > 0));
    if (v.sel && !list.some(h => h.id === v.sel)) v.sel = null;
    const tabs = Ribbons.tabHtml(rc, v.lvl === Ribbons.RIB) + ClassBook.tabsHtml(n, v.lvl);
    el.innerHTML = `<section class="classbook hbbook" style="--cover:#4a5d50">
      <p class="hint" style="margin:0 0 6px">Własne zaklęcia działają jak zaklęcia z SRD: są w Kompendium (filtr „Źródło”), trafiają do ksiąg klas, które im zaznaczysz,
        i można je dodawać do ksiąg postaci. Należą tylko do wersji ${ver}. Zaklęcie z SRD skopiujesz przyciskiem „Kopiuj jako własne” na jego karcie.</p>
      ${ClassBook.spreadHtml({ tabs, left: '<div id="hb-left"></div>' })}
    </section>`;
    renderLeft(list);
    renderCard(false);
    $$('.bm', el).forEach(b => b.onclick = () => {
      const to = Number(b.dataset.lv);
      if (to === v.lvl || ClassBook.isTurning()) return;
      ClassBook.turnPage(el, v.lvl, to, () => { v.lvl = to; v.sel = null; Store.save(); render(el); });
    });
    App.fitBook();
  }

  function renderLeft(all) {
    const ver = Store.app.ver, s = Store.cur(), v = s.hbView;
    const box = $('#hb-left', root);
    const rib = v.lvl === Ribbons.RIB;
    const list = all.filter(sp => (rib ? Ribbons.has(KEY, sp.id) : sp.l === v.lvl));
    const head = `<div class="listhead"><h3 style="margin:0">${ClassBook.volName(v.lvl)}</h3>
      <button type="button" class="btn small primary" data-new style="margin-left:auto">+ Nowe zaklęcie</button></div>`;
    if (!all.length) {
      box.innerHTML = head + `<div class="empty panel"><p>Nie masz jeszcze własnych zaklęć w wersji ${ver}. Utwórz nowe albo skopiuj zaklęcie z SRD
        przyciskiem „Kopiuj jako własne” na jego karcie (w księdze klasy lub w Kompendium).</p></div>`;
    } else {
      const row = sp => `<div class="book-row${v.sel === sp.id ? ' sel' : ''}" style="--sc:${schoolVar(sp.s)}">
          <span class="tag hb">${sp.l === 0 ? 'C' : sp.l}</span>
          <div><span class="nm" data-open="${esc(sp.id)}" tabindex="0">${esc(sp.n)}</span>${SpellCard.tags({ ...sp, hb: false })}
            <div class="meta">${SpellCard.meta(sp)}${usage(sp.id)}</div></div>
          <div class="row" style="gap:4px">${Ribbons.btn(KEY, sp.id, sp.n)}
            <button class="btn small" data-edit="${esc(sp.id)}">Edytuj</button>
            <button class="btn small danger" data-del="${esc(sp.id)}">Usuń</button></div></div>`;
      let rows = '', last = null;
      for (const sp of list) {
        if (rib && sp.l !== last) { rows += `<div class="book-subhead">${sp.l === 0 ? 'Cantrips' : 'Poziom ' + sp.l}</div>`; last = sp.l; }
        rows += row(sp);
      }
      box.innerHTML = head + `<p class="count">${list.length} ${plural(list.length, 'zaklęcie', 'zaklęcia', 'zaklęć')}</p><div class="book-rows">${rows}</div>`;
    }
    $('[data-new]', box).onclick = () => editor(null);
    const pick = id => {
      v.sel = id; Store.save();
      $$('.book-row', box).forEach(r => r.classList.toggle('sel', r.querySelector('.nm')?.dataset.open === id));
      renderCard(true);
    };
    box.onclick = e => {
      const t = e.target;
      const r = t.closest('[data-rib]');
      if (r) {
        Ribbons.toggle(KEY, r.dataset.rib);
        const page = $('.page.listcol', root), st = page ? page.scrollTop : 0;
        render(root);
        const np = $('.page.listcol', root); if (np) np.scrollTop = st;
        return;
      }
      if (t.dataset.edit) editor(t.dataset.edit);
      else if (t.dataset.del) remove(t.dataset.del);
      else if (t.dataset.open) pick(t.dataset.open);
    };
    box.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.open) { e.preventDefault(); pick(e.target.dataset.open); } };
  }

  /* Prawa strona: karta wybranego własnego zaklęcia (z przyciskiem „Edytuj”). */
  function renderCard(open) {
    const ver = Store.app.ver, s = Store.cur();
    const box = $('#detail', root);
    if (!box) return;
    const sp = s.hbView.sel ? Data.spell(ver, s, s.hbView.sel) : null;
    box.innerHTML = sp
      ? SpellCard.html(sp, ver, { ch: Store.activeChar(s), ctx: 'compendium', closable: true })
      : '<div class="empty panel"><p>Wybierz zaklęcie z listy, aby zobaczyć pełny opis.</p></div>';
    box.classList.toggle('open', !!(sp && open));
    box.onclick = e => { if (e.target === box) box.classList.remove('open'); };
  }

  function usage(id) {
    const n = Store.cur().chars.filter(c => c.spells[id]).length;
    return n ? `. W księgach: ${n}` : '';
  }

  function remove(id) {
    const s = Store.cur();
    const sp = s.homebrew.find(h => h.id === id);
    Store.commit(st => {
      st.homebrew = st.homebrew.filter(h => h.id !== id);
      st.chars.forEach(c => { delete c.spells[id]; if (c.conc && c.conc.id === id) c.conc = null; });
      if (st.sel === id) st.sel = null;
      if (st.hbView && st.hbView.sel === id) st.hbView.sel = null;
      if (st.ribbons[KEY]) st.ribbons[KEY] = st.ribbons[KEY].filter(x => x !== id);
    }, { undo: `Usunięto własne zaklęcie ${sp ? sp.n : ''} (także z ksiąg).` });
  }

  /* Wyznacza przyrost kości między dwoma poziomami tabeli (do wstępnego wypełnienia przy kopiowaniu). */
  function incOf(tab, l) {
    const a = /^(\d+)d(\d+)/.exec(tab?.[String(l)] || ''), b = /^(\d+)d(\d+)/.exec(tab?.[String(l + 1)] || '');
    return a && b && a[2] === b[2] && b[1] > a[1] ? `${b[1] - a[1]}d${a[2]}` : '';
  }

  function fromSrd(sp) {
    const src = {
      dmgType: sp.dm?.t || '', dmgBase: sp.dm ? (sp.dm.ch ? sp.dm.ch['1'] : sp.dm.sl[String(sp.l)] || Object.values(sp.dm.sl)[0]) : '',
      dmgInc: sp.dm?.sl ? incOf(sp.dm.sl, sp.l) : '', cantripScale: !!(sp.dm?.ch && Object.keys(sp.dm.ch).length > 1),
      healBase: sp.he ? sp.he[String(sp.l)] || '' : '', healInc: sp.he ? incOf(sp.he, sp.l) : '',
    };
    return { ...JSON.parse(JSON.stringify(sp)), id: uid('hb'), n: sp.n + ' (kopia)', hb: true, src, keepTables: true };
  }

  function copyFromSrd(id) {
    const ver = Store.app.ver;
    const sp = Data.spell(ver, Store.cur(), id);
    if (sp) editor(null, fromSrd(sp));
  }

  function editor(id, preset = null) {
    const ver = Store.app.ver, s = Store.cur();
    const existing = id ? s.homebrew.find(h => h.id === id) : null;
    const sp = existing || preset || {
      id: uid('hb'), hb: true, n: '', l: 1, s: 'Evocation', c: [], ct: ver === '2014' ? '1 action' : 'Action',
      r: '60 feet', cp: ['V', 'S'], m: '', d: 'Instantaneous', co: false, ri: false, x: [], hl: '', src: {},
    };
    const src = sp.src || {};
    const clsBoxes = Data.classes(ver).map(c => `<label class="chk small"><input type="checkbox" name="cls" value="${c.id}" ${sp.c.includes(c.id) ? 'checked' : ''}> ${esc(c.n)}</label>`).join('');
    const dmgOpts = ['', ...DAMAGE_TYPES].map(t => `<option value="${t}" ${src.dmgType === t ? 'selected' : ''}>${t || '—'}</option>`).join('');
    Dlg.open({
      title: existing ? `Edytuj: ${sp.n}` : 'Nowe własne zaklęcie', wide: true,
      body: `
        <div class="grid3">
          <label class="field" style="grid-column:span 2"><span>Nazwa</span><input type="text" id="h-n" value="${esc(sp.n)}" required></label>
          <label class="field"><span>Poziom</span><select id="h-l">${Array.from({ length: 10 }, (_, l) => `<option value="${l}" ${sp.l === l ? 'selected' : ''}>${l === 0 ? 'Cantrip' : l}</option>`).join('')}</select></label>
          <label class="field"><span>Szkoła</span><select id="h-s">${SCHOOLS.map(x => `<option ${sp.s === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <label class="field"><span>Czas rzucania</span><input type="text" id="h-ct" value="${esc(sp.ct)}"></label>
          <label class="field"><span>Zasięg</span><input type="text" id="h-r" value="${esc(sp.r)}"></label>
          <label class="field"><span>Czas trwania</span><input type="text" id="h-d" value="${esc(sp.d)}"></label>
          <div class="field"><span>Komponenty</span><div class="row">
            ${['V', 'S', 'M'].map(c => `<label class="chk"><input type="checkbox" name="cp" value="${c}" ${sp.cp.includes(c) ? 'checked' : ''}> ${c}</label>`).join('')}</div></div>
          <div class="field"><span>Cechy</span><div class="row">
            <label class="chk"><input type="checkbox" id="h-co" ${sp.co ? 'checked' : ''}> Concentration</label>
            <label class="chk"><input type="checkbox" id="h-ri" ${sp.ri ? 'checked' : ''}> Ritual</label></div></div>
        </div>
        <label class="field"><span>Materiały (komponent M)</span><input type="text" id="h-m" value="${esc(sp.m || '')}"></label>
        <div class="field"><span>Klasy</span><div class="row">${clsBoxes}</div></div>
        <div class="grid2">
          <label class="field"><span>Rzut obronny</span><select id="h-sv"><option value="">—</option>${Object.keys(ABILITIES).map(a => `<option value="${a}" ${sp.sv === a ? 'selected' : ''}>${ABILITIES[a]}</option>`).join('')}</select></label>
          <label class="field"><span>Atak zaklęciem</span><select id="h-at"><option value="">—</option>
            <option value="ranged" ${sp.at === 'ranged' ? 'selected' : ''}>Ranged</option><option value="melee" ${sp.at === 'melee' ? 'selected' : ''}>Melee</option></select></label>
        </div>
        <label class="field"><span>Opis (akapity oddziel pustą linią)</span><textarea id="h-x" rows="7">${esc((sp.x || []).join('\n\n'))}</textarea></label>
        <label class="field"><span>Na wyższych poziomach (opcjonalnie)</span><textarea id="h-hl" rows="2">${esc(sp.hl || '')}</textarea></label>
        <fieldset class="panel" style="margin:0" id="h-eff">
          <legend class="small muted">Obrażenia i leczenie (opcjonalnie; do tabeli na karcie zaklęcia)</legend>
          <div class="grid3">
            <label class="field"><span>Typ obrażeń</span><select id="h-dt">${dmgOpts}</select></label>
            <label class="field"><span>Obrażenia bazowe</span><input type="text" id="h-db" value="${esc(src.dmgBase || '')}" placeholder="np. 3d6"></label>
            <label class="field h-lv"><span>Przyrost na poziom slotu</span><input type="text" id="h-di" value="${esc(src.dmgInc || '')}" placeholder="np. 1d6"></label>
            <label class="field"><span>Leczenie bazowe</span><input type="text" id="h-hb" value="${esc(src.healBase || '')}" placeholder="np. 1d8 + MOD"></label>
            <label class="field h-lv"><span>Przyrost leczenia na poziom</span><input type="text" id="h-hi" value="${esc(src.healInc || '')}" placeholder="np. 1d8"></label>
            <label class="chk small h-c0"><input type="checkbox" id="h-cs" ${src.cantripScale ? 'checked' : ''}> Cantrip: kości ×2/×3/×4 na poziomach 5/11/17</label>
          </div>
          <p class="hint">„MOD” zostanie zastąpione modyfikatorem cechy postaci.${sp.keepTables ? ' Skopiowane tabele zostaną zachowane, dopóki nie zmienisz tych pól.' : ''}</p>
        </fieldset>
        <p class="hint" id="h-err" style="color:var(--danger)" hidden>Podaj nazwę zaklęcia.</p>`,
      foot: `<button class="btn" data-x>Anuluj</button><button class="btn primary" data-ok>${existing ? 'Zapisz zmiany' : 'Dodaj zaklęcie'}</button>`,
      onOpen(d) {
        const g = sel => d.querySelector(sel);
        let dirty = !sp.keepTables;
        $$('#h-eff input, #h-eff select, #h-l', d).forEach(x => x.addEventListener('input', () => { dirty = true; }));
        const syncLv = () => {
          const l = Number(g('#h-l').value);
          $$('.h-lv', d).forEach(x => { x.style.display = l === 0 ? 'none' : ''; });
          $$('.h-c0', d).forEach(x => { x.style.display = l === 0 ? '' : 'none'; });
        };
        g('#h-l').addEventListener('change', syncLv); syncLv();
        g('[data-x]').onclick = Dlg.close;
        g('#h-n').focus();
        g('[data-ok]').onclick = () => {
          const n = g('#h-n').value.trim();
          if (!n) { g('#h-err').hidden = false; g('#h-n').focus(); return; }
          const l = Number(g('#h-l').value);
          const nsrc = {
            dmgType: g('#h-dt').value, dmgBase: g('#h-db').value.trim(), dmgInc: g('#h-di').value.trim(),
            healBase: g('#h-hb').value.trim(), healInc: g('#h-hi').value.trim(), cantripScale: g('#h-cs').checked,
          };
          const out = {
            id: sp.id, hb: true, n, l, s: g('#h-s').value,
            c: $$('input[name=cls]:checked', d).map(x => x.value),
            ct: g('#h-ct').value.trim() || '—', r: g('#h-r').value.trim() || '—', d: g('#h-d').value.trim() || '—',
            cp: $$('input[name=cp]:checked', d).map(x => x.value), m: g('#h-m').value.trim(),
            co: g('#h-co').checked, ri: g('#h-ri').checked,
            x: g('#h-x').value.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean),
            hl: g('#h-hl').value.trim(), hlL: sp.hlL || (ver === '2014' ? 'At Higher Levels' : 'Using a Higher-Level Spell Slot'),
            sv: g('#h-sv').value || undefined, at: g('#h-at').value || undefined, src: nsrc,
          };
          if (!out.m) delete out.m;
          if (!out.hl) { delete out.hl; delete out.hlL; }
          if (!dirty && sp.keepTables) {
            if (sp.dm) out.dm = sp.dm;
            if (sp.he) out.he = sp.he;
          } else {
            if (nsrc.dmgBase) {
              out.dm = l === 0
                ? { t: nsrc.dmgType || null, ch: nsrc.cantripScale ? scaleCantrip(nsrc.dmgBase) : { 1: nsrc.dmgBase } }
                : { t: nsrc.dmgType || null, sl: Rules.buildUpcast(nsrc.dmgBase, l, nsrc.dmgInc) };
            }
            if (nsrc.healBase && l > 0) out.he = Rules.buildUpcast(nsrc.healBase, l, nsrc.healInc);
          }
          Dlg.close();
          Store.commit(st => {
            const i = st.homebrew.findIndex(h => h.id === out.id);
            if (i >= 0) st.homebrew[i] = out; else st.homebrew.push(out);
            st.sel = out.id;
            st.hbView = { lvl: out.l, sel: out.id };
          }, existing ? { undo: `Zapisano zmiany w ${n}.` } : { toast: `Dodano własne zaklęcie ${n}.` });
        };
      },
    });
  }

  function scaleCantrip(base) {
    const m = /^(\d+)d(\d+)(.*)$/.exec(base);
    if (!m) return { 1: base };
    const t = k => `${Number(m[1]) * k}d${m[2]}${m[3]}`;
    return { 1: base, 5: t(2), 11: t(3), 17: t(4) };
  }

  return { render, editor, copyFromSrd, remove };
})();
