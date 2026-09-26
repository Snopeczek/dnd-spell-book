/* 05-classbook.js — wnętrze księgi klasy jako rozkładówka: zakładki poziomów (Cantrips i 1–9) u góry,
   na lewej stronie lista zaklęć pod wybraną zakładką (SRD + własne z tą klasą) z wyszukiwaniem,
   na prawej karta zaklęcia; dodawanie do księgi postaci. Tu są też kolory okładek i emblematy klas
   (używa ich regał) oraz zakładki i rama rozkładówki (używa ich Kompendium). */
'use strict';

/* Wstążki (zakładki-ulubione) w księgach. Klucz księgi jak na regale: 'class:wizard', 'compendium:', 'homebrew:',
   'char:<id>'. Wstążki księgi postaci są częścią postaci (ch.ribbons, trafiają do kopii zapasowej),
   pozostałych ksiąg – stanu wersji (s.ribbons). Zakładka „Wstążki” ma wartość RIB = −0,5: leży między
   kartą postaci (−1) a Cantrips (0), co wyznacza kierunek przewracania kartek. */
const Ribbons = (() => {
  const RIB = -0.5;
  const ICON = '<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M3 1.5h10v17l-5-4-5 4z"/></svg>';
  function charOf(key) { return key.startsWith('char:') ? Store.cur().chars.find(c => c.id === key.slice(5)) : null; }
  function ids(key) {
    const ch = charOf(key);
    return ch ? (ch.ribbons || []) : (Store.cur().ribbons[key] || []);
  }
  function has(key, id) { return ids(key).includes(id); }
  /* Zaklęcia ze wstążką, które nadal istnieją (a w księdze postaci – są w księdze). */
  function spells(key, ver) {
    const s = Store.cur(), ch = charOf(key);
    return ids(key).map(id => Data.spell(ver, s, id)).filter(sp => sp && (!ch || ch.spells[sp.id]));
  }
  function count(key, ver) { return spells(key, ver).length; }
  function toggle(key, id) {
    const s = Store.cur(), ch = charOf(key);
    const on = !has(key, id);
    Store.commit(() => {
      const cur = ids(key).filter(x => x !== id);
      if (on) cur.push(id);
      if (ch) { if (cur.length) ch.ribbons = cur; else delete ch.ribbons; }
      else if (cur.length) s.ribbons[key] = cur; else delete s.ribbons[key];
    }, { render: false });
    Bookcase.update();
    return on;
  }
  function btn(key, id, name) {
    const on = has(key, id);
    return `<button type="button" class="iconbtn rib-btn" data-rib="${esc(id)}" aria-pressed="${on}"
      title="${on ? 'Zdejmij wstążkę' : 'Załóż wstążkę'}" aria-label="${on ? 'Zdejmij wstążkę' : 'Załóż wstążkę'}: ${esc(name || '')}">${ICON}</button>`;
  }
  function tabHtml(n, selected) {
    return `<button type="button" class="bm bm-rib" role="tab" data-lv="${RIB}" aria-selected="${selected}" ${n ? '' : 'disabled'}
      style="--i:0" title="Wstążki: ${n}"><span class="bm-ico">${ICON}</span><span class="bm-n">${n}</span></button>`;
  }
  /* Lista pogrupowana według poziomów (dla zakładki „Wstążki”). */
  function grouped(list, rowHtml, headCls = 'lvl-head') {
    let out = '', last = null;
    for (const sp of list.slice().sort((a, b) => a.l - b.l || a.n.localeCompare(b.n))) {
      if (sp.l !== last) { out += `<li class="${headCls}" role="presentation">${sp.l === 0 ? 'Cantrips' : 'Poziom ' + sp.l}</li>`; last = sp.l; }
      out += rowHtml(sp);
    }
    return out;
  }
  return { RIB, ICON, ids, has, spells, count, toggle, btn, tabHtml, grouped };
})();

const ClassBook = (() => {
  let root = null;
  /* Kolory okładek (skórzane oprawy); spójne w obu wersjach zasad. */
  const COVERS = {
    bard: '#8c3a5e', cleric: '#94701f', druid: '#3e6a3a', paladin: '#2e5f8e',
    ranger: '#56682e', sorcerer: '#9e3b2b', warlock: '#4b3372', wizard: '#243f6b',
  };
  const cover = id => COVERS[id] || (Data.customClass(Store.app.ver, id) || {}).color || '#555c66';
  const volName = l => (l === Ribbons.RIB ? 'Wstążki' : l === 0 ? 'Cantrips' : `Poziom ${l}`);
  /* Własne emblematy klas (oryginalne rysunki, SVG 48×48, obrys w kolorze currentColor). */
  const EMBLEMS = {
    bard: '<path d="M17 41h14M19 41c-7-4-10-11-7-19 2-5 0-10-4-13M29 41c7-4 10-11 7-19-2-5 0-10 4-13M13 15h22M20.5 15v26M24 15v26M27.5 15v26"/>',
    cleric: '<circle cx="24" cy="24" r="7"/><path d="M24 7v6M24 35v6M7 24h6M35 24h6M12 12l4.2 4.2M31.8 31.8L36 36M36 12l-4.2 4.2M16.2 31.8L12 36"/>',
    druid: '<path d="M24 38C12 30 12 16 24 6c12 10 12 24 0 32z"/><path d="M24 43V13M24 22l-6-4M24 22l6-4M24 30l-7-4M24 30l7-4"/>',
    paladin: '<path d="M24 6l14 5v11c0 9-6 16-14 20-8-4-14-11-14-20V11z"/><path d="M24 14v18M17 21h14"/>',
    ranger: '<path d="M18 5c11 7 11 31 0 38"/><path d="M18 5L11 24l7 19M8 24h32M35 20l5 4-5 4M8 24l-3-3M8 24l-3 3"/>',
    sorcerer: '<path d="M24 43c-7 0-12-5-12-12 0-8 8-11 8-21 7 4 11 10 11 17 2-2 3-4 3-7 3 3 3 8 3 11 0 7-6 12-13 12z"/><path d="M24 43c-3 0-5-2-5-5 0-4 5-6 5-10 3 3 5 6 5 10 0 3-2 5-5 5z"/>',
    warlock: '<path d="M5 24c5-8 11-12 19-12s14 4 19 12c-5 8-11 12-19 12S10 32 5 24z"/><circle cx="24" cy="24" r="7"/><path d="M24 17.5c-2 4-2 9 0 13 2-4 2-9 0-13z"/>',
    // ogólne emblematy do wyboru dla ksiąg postaci
    gear: '<circle cx="24" cy="24" r="6"/><path d="M24 7v6M24 35v6M7 24h6M35 24h6M12 12l4.3 4.3M31.7 31.7L36 36M36 12l-4.3 4.3M16.3 31.7L12 36"/><circle cx="24" cy="24" r="12"/>',
    flask: '<path d="M19 6h10M21 6v12L10 38a3 3 0 0 0 2.7 4.4h22.6A3 3 0 0 0 38 38L27 18V6"/><path d="M14.5 30h19"/>',
    hammer: '<path d="M10 14l10-6 6 6-10 6zM20 17l18 18-3 3-18-18"/>',
    crystal: '<path d="M24 5l10 12-10 26-10-26zM14 17h20M24 5v38"/>',
    star: '<path d="M24 6l5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1z"/>',
    moon: '<path d="M32 8a16 16 0 1 0 8 26A13 13 0 0 1 32 8z"/>',
    skull: '<path d="M12 24a12 12 0 1 1 24 0v6l-4 3v6H16v-6l-4-3z"/><circle cx="19" cy="25" r="3"/><circle cx="29" cy="25" r="3"/><path d="M22 39v-4M26 39v-4"/>',
    wizard: '<circle cx="31" cy="13" r="6"/><path d="M27.5 18L12 43M39 25l1 3 3 1-3 1-1 3-1-3-3-1 3-1zM15 7l.8 2.2L18 10l-2.2.8L15 13l-.8-2.2L12 10l2.2-.8z"/>',
  };
  function emblem(id, cls = 'emblem') {
    const cc = Data.customClass(Store.app.ver, id);
    const p = EMBLEMS[cc ? cc.emblem : id];
    return p ? `<svg class="${cls}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>` : '';
  }


  /* Zakładki poziomów (Cantrips, 1–9) wystające z prawej krawędzi kartek i schodzące stopniowo w dół; używa ich też Kompendium. */
  function tabsHtml(counts, cur) {
    return counts.map((cnt, l) => `<button type="button" class="bm" role="tab" data-lv="${l}" aria-selected="${cur === l}" ${cnt ? '' : 'disabled'}
        style="--i:${l}" title="${volName(l)}: ${cnt} ${plural(cnt, 'zaklęcie', 'zaklęcia', 'zaklęć')}">
        <span class="bm-l">${l === 0 ? 'C' : l}</span><span class="bm-n">${cnt}</span></button>`).join('');
  }

  /* Otwarta księga: okładka dookoła, dwie strony (lista i karta) z widocznymi krawędziami kartek,
     zakładki poziomów w kolumnie przy prawej krawędzi. */
  function spreadHtml({ tabsId = '', tabs = '', left, right }) {
    return `<div class="openbook">
      <div class="pages">
        <section class="page listcol">${left}</section>
        <section class="page detailcol" id="detail">${right || ''}</section>
      </div>
      <div class="bm-col"><div class="bm-stack" role="tablist" aria-orientation="vertical" aria-label="Poziomy zaklęć"${tabsId ? ` id="${tabsId}"` : ''}>${tabs}</div></div>
    </div>`;
  }

  function spellsOf(ver, s, cls) {
    return Data.spells(ver, s).filter(sp => Data.inClass(ver, cls, sp));
  }
  function countByLevel(list) {
    const n = Array(10).fill(0);
    list.forEach(sp => { n[sp.l]++; });
    return n;
  }

  function render(el) {
    root = el;
    renderBook(el);
    App.fitBook(); // stała wysokość stron (przed pomiarem do animacji kartki)
  }


  /* ---------- przewracanie kartek przy zmianie zakładki ----------
     Kartka to łańcuch SLICES pionowych pasków: pierwszy obraca się na grzbiecie, każdy następny dostaje
     dodatkowy kąt względem poprzedniego, więc kartka wygina się i faluje (fala biegnie od grzbietu do brzegu:
     na początku brzeg unosi się pierwszy, przy lądowaniu opada ostatni).
     Przy przeskoku o kilka poziomów przewraca się kilka kartek (maks. MAX_LEAVES) z opóźnieniem – wachlarz;
     kartki pośrednie to papier z liniami tekstu.
     Rozkładówka:  do przodu prawa kartka przechodzi na lewo (awers: stara prawa, rewers ostatniej: nowa lewa);
                   do tyłu lewa kartka opada na prawą, na stronę z poprzednią treścią (rewers ostatniej: nowa prawa).
     Jedna strona: do przodu stara strona unosi się na grzbiecie i odchodzi w lewo, odsłaniając nową;
                   do tyłu nowa kartka unosi się z lewej krawędzi i opada na starą stronę (z lewej do prawej). */
  let turning = false;
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SLICES = 10, MAX_LEAVES = 4;

  function snap(page) {
    const c = page.cloneNode(true);
    c.removeAttribute('id');
    c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    c.classList.add('pt-page');
    c.classList.remove('open');
    c.dataset.st = page.scrollTop; // przewinięcie strony odtwarzane w kopii
    return c;
  }
  /* Wycinek strony w pasku: kopia o szerokości pw przesunięta o x; bez strony – papier z liniami. */
  function cut(page, pw, h, x) {
    const box = document.createElement('div');
    box.className = 'pt-cut' + (page ? '' : ' pt-blank');
    box.style.cssText = `width:${pw}px;height:${h}px;left:${x}px`;
    if (page) box.appendChild(page.cloneNode(true));
    return box;
  }
  function under(page, x, w, h) {
    const f = document.createElement('div');
    f.className = 'pt-under';
    f.style.cssText = `left:${x}px;width:${w}px;height:${h}px`;
    f.appendChild(page);
    return f;
  }

  /* side 'r': zawias po lewej krawędzi kartki; side 'l': zawias po prawej.
     Przegub i (i ≥ 1) leży w odległości i·w od grzbietu. Paski zachodzą na sąsiadów (OV i EX),
     żeby między warstwami 3D nie prześwitywały szczeliny. joint – położenie przegubu w pasku,
     d(u) – odległość punktu u paska od grzbietu; przesunięcie wycinka = −(współrzędna strony dla u = 0). */
  const OV = 1.5, EX = 0.8;
  function buildLeaf({ side, g, M, H, front, frontW, back, backW }) {
    const w = M / SLICES;
    const leaf = document.createElement('div');
    leaf.className = 'pt-leaf';
    leaf.style.cssText = `left:${g}px;top:0;height:${H}px`;
    const joints = [], shades = [];
    let parent = leaf, parentNext = 0;
    for (let i = 0; i < SLICES; i++) {
      const s = document.createElement('div');
      s.className = 'pt-slice';
      let box, joint, left, frontShift, backShift;
      if (side === 'r') {
        joint = i === 0 ? 0 : OV;
        box = joint + w + EX;
        left = parentNext - joint;
        frontShift = joint - i * w;                 // d(u) = i·w + (u − joint); awers: pu = d
        backShift = i * w + box - joint - backW;    // rewers: u = box − v, pu = backW − d
        parentNext = joint + w;
      } else {
        joint = w + EX;
        box = joint + (i === 0 ? 0 : OV);
        left = parentNext - joint;
        frontShift = i * w + joint - frontW;        // d(u) = i·w + (joint − u); awers: pu = frontW − d
        backShift = -(i * w + joint - box);         // rewers: u = box − v, pu = d
        parentNext = joint - w;
      }
      s.style.cssText = `left:${left}px;width:${box}px;height:${H}px;transform-origin:${joint}px 50%`;
      const fF = document.createElement('div'); fF.className = 'pt-f';
      const fB = document.createElement('div'); fB.className = 'pt-b';
      fF.appendChild(cut(front, frontW, H, frontShift));
      fB.appendChild(cut(back, backW, H, backShift));
      const shF = document.createElement('div'); shF.className = 'pt-shade'; fF.appendChild(shF);
      const shB = document.createElement('div'); shB.className = 'pt-shade'; fB.appendChild(shB);
      s.append(fF, fB);
      parent.appendChild(s);
      joints.push(s); shades.push([shF, shB]);
      parent = s;
    }
    return { leaf, joints, shades };
  }

  function turnPage(root, from, to, doRender) {
    const old = $('.pages', root);
    if (from === to || turning || reducedMotion() || !old || old.children.length < 2) { doRender(); return; }
    const single = getComputedStyle(old).gridTemplateColumns.trim().split(/\s+/).length === 1;
    const oL = snap(old.children[0]), oR = snap(old.children[1]);
    doRender();
    const pages = $('.pages', root);
    if (!pages) return;
    const pL = pages.children[0], pR = pages.children[1];
    const nL = snap(pL), nR = snap(pR);
    const H = pages.clientHeight, L = pL.offsetWidth, R = single ? 0 : pR.offsetWidth, M = Math.max(L, R);
    const fwd = to > from;
    const n = Math.min(MAX_LEAVES, Math.abs(to - from));
    turning = true;
    const ov = document.createElement('div');
    ov.className = 'pt-overlay';

    // kartki: k = 0 rusza pierwsza; cfg(k) – strony na awersie i rewersie, kąt początkowy i końcowy
    const leaves = [];
    const first = k => k === 0, last = k => k === n - 1;
    for (let k = 0; k < n; k++) {
      let cfg, a0, a1;
      if (!single && fwd) {
        cfg = { side: 'r', g: L, M, H, front: first(k) ? oR : null, frontW: R, back: last(k) ? nL : null, backW: L }; a0 = 0; a1 = -180;
      } else if (!single) {
        cfg = { side: 'l', g: L, M, H, front: first(k) ? oL : null, frontW: L, back: last(k) ? nR : null, backW: R }; a0 = 0; a1 = 180;
      } else if (fwd) {
        cfg = { side: 'r', g: 0, M: L, H, front: first(k) ? oL : null, frontW: L, back: null, backW: L }; a0 = 0; a1 = -93;
      } else {
        cfg = { side: 'r', g: 0, M: L, H, front: last(k) ? nL : null, frontW: L, back: null, backW: L }; a0 = -93; a1 = 0;
      }
      leaves.push({ ...buildLeaf(cfg), a0, a1, flipped: false });
    }
    // co leży pod kartkami w trakcie
    if (!single && fwd) ov.append(under(oL, 0, L, H), under(nR, L, R, H));
    else if (!single) ov.append(under(nL, 0, L, H), under(oR, L, R, H));
    else ov.appendChild(under(fwd ? nL : oL, 0, L, H));
    const cast = document.createElement('div');
    cast.className = 'pt-cast' + (single ? '' : fwd ? ' to-left' : ' to-right');
    cast.style.cssText = single ? `left:0;width:${L}px;height:${H}px` : fwd ? `left:0;width:${L}px;height:${H}px` : `left:${L}px;width:${R}px;height:${H}px`;
    ov.appendChild(cast);
    // kolejność rysowania: na starcie wierzchnia jest kartka, która rusza pierwsza (przy opadaniu – ostatnia)
    const order = (single && !fwd) ? leaves : leaves.slice().reverse();
    order.forEach(l => ov.appendChild(l.leaf));
    pages.appendChild(ov);
    $$('.pt-page', ov).forEach(c => { c.scrollTop = Number(c.dataset.st) || 0; });

    const dur = single ? 640 : 950, stagger = single ? 95 : 120, total = dur + (n - 1) * stagger;
    const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const t0 = performance.now();
    function frame() {
      const now = performance.now();
      let castOp = 0;
      leaves.forEach((lf, k) => {
        const t = clamp((now - t0 - k * stagger) / dur, 0, 1);
        const e = ease(t);
        const dir = Math.sign(lf.a1 - lf.a0);
        const base = lf.a0 + (lf.a1 - lf.a0) * e;
        const env = Math.sin(Math.PI * t);                 // wygięcie tylko w trakcie ruchu
        let acc = base;
        for (let i = 0; i < SLICES; i++) {
          let a = base;
          if (i > 0) {
            // fala od grzbietu do brzegu: najpierw brzeg wyprzedza (ciągnięty za róg), potem zostaje w tyle
            a = dir * env * (6.5 * Math.sin(2 * Math.PI * (t - i * 0.028)) + 1.6 * Math.sin(4 * Math.PI * t - i * 0.9));
            acc += a;
          }
          lf.joints[i].style.transform = `rotateY(${a.toFixed(3)}deg)`;
          const op = (0.06 + 0.46 * Math.abs(Math.sin(acc * Math.PI / 180))).toFixed(3);
          lf.shades[i][0].style.opacity = op; lf.shades[i][1].style.opacity = op;
        }
        // kartka, która przeszła przez pion, ląduje na wierzchu stosu po drugiej stronie
        if (!lf.flipped && Math.abs(base) > 90 && Math.abs(lf.a1) === 180) { lf.flipped = true; ov.appendChild(lf.leaf); }
        castOp = Math.max(castOp, 0.5 * env);
      });
      cast.style.opacity = castOp.toFixed(3);
      if (now - t0 < total) requestAnimationFrame(frame);
      else { ov.remove(); turning = false; }
    }
    requestAnimationFrame(frame);
    setTimeout(() => { if (turning && ov.isConnected && performance.now() - t0 > total * 3) { ov.remove(); turning = false; } }, total * 3 + 200); // zabezpieczenie
  }

  /* ---------- księga klasy ---------- */
  function renderBook(el) {
    const ver = Store.app.ver, s = Store.cur(), sh = s.shelf;
    const C = Data.cls(ver, sh.cls);
    const n = countByLevel(spellsOf(ver, s, sh.cls));
    const rc = Ribbons.count('class:' + sh.cls, ver);
    if (sh.lvl === Ribbons.RIB ? !rc : (sh.lvl == null || !n[sh.lvl])) sh.lvl = Math.max(0, n.findIndex(x => x > 0));
    const tabs = Ribbons.tabHtml(rc, sh.lvl === Ribbons.RIB) + tabsHtml(n, sh.lvl);
    const chars = s.chars.length
      ? `<label class="field small" style="margin-left:auto"><span>Dodawanie do księgi postaci</span>
          <select id="sh-char">${s.chars.map(c => `<option value="${c.id}" ${c.id === s.active ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`
      : '';
    el.innerHTML = `<section class="classbook" style="--cover:${cover(sh.cls)}">
      <div class="row" style="align-items:flex-end;margin-bottom:6px">
        <div>
          <p class="hint" style="margin:0">Spellcasting ability: ${esc(ABILITIES[C.ab] || C.ab)}${C.from > 1 ? `. Czarowanie od poziomu ${C.from}` : ''}</p>
          ${C.custom ? `<p class="hint" style="margin:4px 0 0">Własna klasa. Zaklęcia dodajesz, przeciągając je z Kompendium albo z Własnych zaklęć na grzbiet tej księgi na regale.
            <button type="button" class="btn small" data-editcls style="margin-left:6px">Edytuj klasę</button></p>` : ''}
        </div>
        ${chars}
      </div>
      ${spreadHtml({ tabs, left: `
          <div class="listhead">
            <h3 style="margin:0">${volName(sh.lvl)}</h3>
            <label class="sr" for="sh-q">Szukaj pod tą zakładką</label>
            <input type="search" id="sh-q" placeholder="Szukaj pod tą zakładką…" value="${esc(sh.q)}" autocomplete="off">
          </div>
          <div id="sh-list"></div>` })}
    </section>`;

    const ec = $('[data-editcls]', el);
    if (ec) ec.onclick = () => Classes.editor(sh.cls);
    $$('.bm', el).forEach(b => b.onclick = () => {
      const to = Number(b.dataset.lv);
      if (turning || to === sh.lvl) return;
      const from = sh.lvl;
      turnPage(el, from, to, () => { sh.lvl = to; sh.sel = null; sh.q = ''; Store.save(); render(el); });
    });
    $('#sh-q', el).addEventListener('input', debounce(e => { sh.q = e.target.value; Store.save(); renderList(); }, 120));
    const cs = $('#sh-char', el);
    if (cs) cs.onchange = () => { s.active = cs.value; Store.save(); renderList(); renderDetail(false); };
    renderList();
    renderDetail(false);
  }

  function renderList() {
    const ver = Store.app.ver, s = Store.cur(), sh = s.shelf, ch = Store.activeChar(s);
    const box = $('#sh-list', root);
    if (!box) return;
    const q = sh.q.trim().toLowerCase();
    const key = 'class:' + sh.cls, rib = sh.lvl === Ribbons.RIB;
    const cc = Data.customClass(ver, sh.cls);
    if (cc && !spellsOf(ver, s, sh.cls).length) {
      box.innerHTML = `<div class="empty panel"><p>Lista zaklęć klasy ${esc(cc.n)} jest pusta. Otwórz Kompendium albo Własne zaklęcia i przeciągnij zaklęcia na grzbiet tej księgi na regale
        (albo przypisz tę klasę własnym zaklęciom w ich edytorze).</p><button class="btn primary" data-comp>Otwórz Kompendium</button></div>`;
      $('[data-comp]', box).onclick = () => App.openBook({ kind: 'compendium' });
      return;
    }
    const list = spellsOf(ver, s, sh.cls).filter(sp => (rib ? Ribbons.has(key, sp.id) : sp.l === sh.lvl) && (!q || sp.n.toLowerCase().includes(q)));
    if (!list.length) {
      box.innerHTML = `<div class="empty panel"><p>${q ? 'Brak zaklęć pasujących do wyszukiwania.' : rib ? 'W tej księdze nie ma zaklęć ze wstążką.' : 'Pod tą zakładką nie ma zaklęć.'}</p></div>`;
      return;
    }
    const row = sp => {
        const inBook = ch && ch.spells[sp.id];
        const full = ch && !inBook && Book.limitReached(ch, ver, sp);
        const btn = ch ? `<button type="button" class="iconbtn${full ? ' at-limit' : ''}" data-toggle="${esc(sp.id)}" aria-pressed="${!!inBook}"
            title="${inBook ? 'Usuń z księgi' : full ? full.title + ' (' + full.used + '/' + full.max + ')' : 'Dodaj do księgi'}: ${esc(ch.name)}">${inBook ? '✓' : '+'}</button>` : '';
        return `<li class="spell-row" role="option" tabindex="0" data-id="${esc(sp.id)}" aria-selected="${sh.sel === sp.id}" style="--sc:${schoolVar(sp.s)}">
          <div class="nm">${esc(sp.n)}${SpellCard.tags(sp)}</div>
          <div class="meta">${SpellCard.meta(sp)}</div>
          <div class="acts">${cc && cc.spells.includes(sp.id)
            ? `<button type="button" class="iconbtn" data-unlist="${esc(sp.id)}" title="Usuń z listy klasy ${esc(cc.n)}" aria-label="Usuń ${esc(sp.n)} z listy klasy">−</button>` : ''}${Ribbons.btn(key, sp.id, sp.n)}${btn}</div></li>`;
    };
    box.innerHTML = `<p class="count">${list.length} ${plural(list.length, 'zaklęcie', 'zaklęcia', 'zaklęć')}</p><ul class="spell-list" role="listbox" aria-label="${volName(sh.lvl)}">` +
      (rib ? Ribbons.grouped(list, row) : list.map(row).join('')) + '</ul>';
    box.onclick = e => {
      const r = e.target.closest('[data-rib]');
      if (r) { e.stopPropagation(); ribbonToggled(key, r); return; }
      const u = e.target.closest('[data-unlist]');
      if (u) { e.stopPropagation(); Classes.unlist(sh.cls, u.dataset.unlist); return; }
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

  /* Po zmianie wstążki: przycisk w wierszu, licznik na zakładce „Wstążki”, a na tej zakładce – lista. */
  function ribbonToggled(key, btnEl) {
    const on = Ribbons.toggle(key, btnEl.dataset.rib);
    btnEl.setAttribute('aria-pressed', on);
    btnEl.title = on ? 'Zdejmij wstążkę' : 'Załóż wstążkę';
    const sh = Store.cur().shelf, ver = Store.app.ver;
    const n = Ribbons.count(key, ver);
    const tab = $('.bm-rib', root);
    if (tab) { tab.disabled = !n; $('.bm-n', tab).textContent = n; tab.title = 'Wstążki: ' + n; }
    if (sh.lvl === Ribbons.RIB) { if (!n) render(root); else renderList(); }
  }

  function select(id, open = true) {
    const sh = Store.cur().shelf;
    sh.sel = id; Store.save();
    $$('.spell-row', root).forEach(r => r.setAttribute('aria-selected', r.dataset.id === id));
    renderDetail(open);
  }

  function renderDetail(open) {
    const ver = Store.app.ver, s = Store.cur(), sh = s.shelf;
    const box = $('#detail', root);
    if (!box) return;
    const sp = sh.sel ? Data.spell(ver, s, sh.sel) : null;
    box.innerHTML = sp
      ? SpellCard.html(sp, ver, { ch: Store.activeChar(s), ctx: 'compendium', closable: true })
      : '<div class="empty panel"><p>Wybierz zaklęcie z listy, aby zobaczyć pełny opis.</p></div>';
    box.classList.toggle('open', !!(sp && open));
    box.onclick = e => { if (e.target === box) box.classList.remove('open'); };
  }

  function refresh() { if (root && root.isConnected && Store.cur().shelf.cls) { renderList(); renderDetail(false); } }

  // najpierw emblematy klas SRD, potem ogólne
  const EMBLEM_IDS = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard', 'gear', 'flask', 'hammer', 'crystal', 'star', 'moon', 'skull'];

  return { render, refresh, tabsHtml, spreadHtml, turnPage, EMBLEM_IDS, isTurning: () => turning, volName, countByLevel, spellsOf, cover, emblem };
})();
