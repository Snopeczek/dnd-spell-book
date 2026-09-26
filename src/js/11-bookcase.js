/* 11-bookcase.js — regał: cała nawigacja programu. Księgi stoją grzbietem do odbiorcy na dwóch półkach:
   górna: Kompendium i księgi klas; dolna: księgi postaci, „Nowa postać”, Własne zaklęcia, Ustawienia i dane.
   Grubość grzbietu zależy od liczby zaklęć w środku i zmienia się na bieżąco (płynnie, przez CSS).
   Ruch: sprężyna z tłumieniem dla uniesienia i przechyłu; ostatnia księga na półce opiera się o sąsiadkę
   i unosi razem z nią; bezpośredni sąsiedzi reagują lekko (tarcie). Po otwarciu księgi regał kurczy się
   do paska na górze strony. */
'use strict';

const Bookcase = (() => {
  const LEATHER = ['#7b3a2c', '#2f5a4e', '#5b3d6b', '#3b4e78', '#7a6030', '#4c5a2a', '#6b2f47', '#2e4f60', '#6a4a2e', '#3f3f6a'];
  const LEAN_DEG = -10;
  const CHARS_PER_SHELF = 10;
  const ICONS = {
    compendium: '<path d="M8 10c5-2 11-2 16 1 5-3 11-3 16-1v27c-5-2-11-2-16 1-5-3-11-3-16-1z"/><path d="M24 11v27"/>',
    homebrew: '<path d="M38 7C24 10 15 22 12 38l4-3c3-9 9-17 17-22-6 6-10 13-12 20 9-4 15-13 17-26z"/><path d="M12 38l-3 3"/>',
    settings: '<circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11.3 11.3l4.2 4.2M32.5 32.5l4.2 4.2M36.7 11.3l-4.2 4.2M15.5 32.5l-4.2 4.2"/>',
    plus: '<path d="M24 12v24M12 24h24"/>',
  };
  const svg = p => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

  const phys = new Map();       // klucz księgi -> { y, v, r, vr, hover, tilt }
  let els = new Map();          // klucz -> element
  let rows = [];                // [[klucz, …], …] w kolejności na półkach
  let leanOn = new Map();       // klucz opartej księgi -> klucz sąsiadki
  let signature = '';
  let host = null, lastOpen = null, raf = 0;
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Wygląd księgi postaci: kolor skóry i emblemat wybrane na karcie postaci (ch.look), inaczej automatyczne
     (kolor stały dla postaci, emblemat klasy; dla jednorazowej „Własnej klasy” – pierwsza litera imienia). */
  const PALETTE = LEATHER.concat(['#94701f', '#2e5f8e']);
  const charOf = x => (typeof x === 'string' ? (Store.cur().chars.find(c => c.id === x) || { id: x }) : x);
  const autoColor = id => LEATHER[hash(id) % LEATHER.length];
  function charColor(x) { const ch = charOf(x); return (ch.look && ch.look.color) || autoColor(ch.id); }
  function charIcon(x, cls = '') {
    const ch = charOf(x);
    const e = ch.look && ch.look.emblem;
    if (e) return ClassBook.emblem(e, cls);
    if (ch.cls === 'custom' || !ch.cls) return `<span class="sp-mono">${esc((ch.name || '?').trim().charAt(0).toUpperCase())}</span>`;
    return ClassBook.emblem(ch.cls, cls);
  }
  function hash(str) { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
  const keyOf = it => it.kind + ':' + (it.id || '');

  /* Grubość: proporcjonalna do liczby zaklęć (księgi klas mają ich 40–220, więc 1 zaklęcie ≈ 0,2 px;
     księgi postaci i własnych zaklęć są cieńsze i rosną wyraźniej). */
  const thick = {
    compendium: n => 30 + n * 0.19,
    class: n => 26 + n * 0.2,
    char: n => Math.min(110, 26 + n * 1.6),
    homebrew: n => Math.min(96, 28 + n * 2.4),
  };

  function items(ver, s) {
    const all = Data.spells(ver, s);
    const top = [{ kind: 'compendium', id: '', title: 'Kompendium', color: '#6a5842', h: 300, w: thick.compendium(all.length), icon: svg(ICONS.compendium), sub: all.length }];
    for (const c of Data.classes(ver)) {
      const n = ClassBook.spellsOf(ver, s, c.id).length;
      top.push({ kind: 'class', id: c.id, title: c.n, color: ClassBook.cover(c.id), h: 244 + hash(c.id) % 44, w: thick.class(n), icon: ClassBook.emblem(c.id, ''), sub: n });
    }
    const chars = s.chars.map(ch => {
      const n = Object.keys(ch.spells).length;
      const cast = Rules.casting(ch, ver);
      return { kind: 'char', id: ch.id, title: ch.name, color: charColor(ch), h: 226 + hash(ch.id + 'h') % 40, w: thick.char(n),
        icon: charIcon(ch),
        sub: n, desc: `${cast.clsName}, poziom ${cast.lvl}` };
    });
    // półki z postaciami: po CHARS_PER_SHELF na półkę; po zapełnieniu półki „Nowa postać” trafia na nową, niższą półkę
    const groups = [];
    for (let i = 0; i < chars.length; i += CHARS_PER_SHELF) groups.push(chars.slice(i, i + CHARS_PER_SHELF));
    if (!groups.length || groups[groups.length - 1].length === CHARS_PER_SHELF) groups.push([]);
    groups[groups.length - 1].push({ kind: 'newchar', id: '', title: 'Nowa postać', color: 'transparent', h: 236, w: 34, icon: svg(ICONS.plus), sub: '', blank: true });
    // Własne zaklęcia i Ustawienia stoją zawsze na końcu pierwszej półki z postaciami
    groups[0].push({ kind: 'homebrew', id: '', title: 'Własne zaklęcia', color: '#4a5d50', h: 258, w: thick.homebrew(s.homebrew.length), icon: svg(ICONS.homebrew), sub: s.homebrew.length });
    groups[0].push({ kind: 'settings', id: '', title: 'Ustawienia i dane', color: '#3a3e47', h: 212, w: 34, icon: svg(ICONS.settings), sub: '' });
    return [top, ...groups];
  }

  /* Liczba wstążek w księdze (wstążka wystaje wtedy z grzbietu). */
  function ribbonsOf(it, ver) {
    if (it.blank || it.kind === 'settings') return 0;
    return Ribbons.count(keyOf(it), ver);
  }

  function spineHtml(it, isLean, active) {
    const label = it.kind === 'newchar' ? 'Utwórz nową postać'
      : `Otwórz: ${it.title}${it.sub !== '' ? `, ${it.sub} ${plural(it.sub, 'zaklęcie', 'zaklęcia', 'zaklęć')}` : ''}`;
    return `<button type="button" class="spine${isLean ? ' lean' : ''}${it.blank ? ' blank' : ''}${active ? ' active' : ''}"
        data-key="${esc(keyOf(it))}" style="--c:${it.color};--h:${it.h};--w:${it.w.toFixed(2)}"
        aria-label="${esc(label)}" title="${esc((it.desc ? `${it.title} (${it.desc})` : it.title) + (it.rib ? `. Wstążki: ${it.rib}` : ''))}">
      <span class="sp-icon">${it.icon}</span>
      <span class="sp-title">${esc(it.title)}</span>
      <span class="sp-sub">${it.sub === '' ? '' : it.sub}</span>
      <span class="sp-ribbon" aria-hidden="true"${it.rib ? '' : ' hidden'}></span>
    </button>`;
  }

  /* Rysuje regał. Jeśli układ ksiąg się nie zmienił, tylko aktualizuje istniejące grzbiety,
     dzięki czemu zmiana grubości i przejście do paska są płynne. */
  function render(el, open) {
    host = el; lastOpen = open;
    const ver = Store.app.ver, s = Store.cur();
    const shelves = items(ver, s);
    for (const r of shelves) for (const it of r) it.rib = ribbonsOf(it, ver);
    const activeKey = open ? open.kind + ':' + (open.id || '') : null;
    const sig = ver + '|' + shelves.map(r => r.map(keyOf).join(',')).join('/');
    const compact = !!open;
    if (sig !== signature || !el.firstElementChild) {
      signature = sig;
      rows = shelves.map(r => r.map(keyOf));
      // ostatnia księga na półce opiera się o sąsiadkę (pusta „Nowa postać” stoi prosto)
      leanOn = new Map();
      for (const r of shelves) {
        const last = r[r.length - 1];
        if (r.length > 1 && !last.blank) leanOn.set(keyOf(last), keyOf(r[r.length - 2]));
      }
      el.innerHTML = `<div class="bookcase${compact ? ' compact' : ''}" aria-label="Regał z księgami">
        ${shelves.map(r => `<div class="shelf"><div class="shelf-row"><div class="books">
          ${r.map(it => spineHtml(it, leanOn.has(keyOf(it)), keyOf(it) === activeKey)).join('')}
        </div></div><div class="plank"></div></div>`).join('')}
      </div>`;
      els = new Map($$('.spine', el).map(b => [b.dataset.key, b]));
      for (const [k, b] of els) {
        if (!phys.has(k)) phys.set(k, { y: 0, v: 0, r: leanOn.has(k) ? LEAN_DEG : 0, vr: 0, hover: false, tilt: 0 });
        bind(k, b);
      }
    } else {
      $('.bookcase', el).classList.toggle('compact', compact);
      for (const r of shelves) for (const it of r) {
        const b = els.get(keyOf(it));
        b.style.setProperty('--w', it.w.toFixed(2));
        b.classList.toggle('active', keyOf(it) === activeKey);
        $('.sp-title', b).textContent = it.title;
        $('.sp-sub', b).textContent = it.sub === '' ? '' : it.sub;
        if (it.kind === 'char') { $('.sp-icon', b).innerHTML = it.icon; b.style.setProperty('--c', it.color); }
        b.title = (it.desc ? `${it.title} (${it.desc})` : it.title) + (it.rib ? `. Wstążki: ${it.rib}` : '');
        $('.sp-ribbon', b).hidden = !it.rib;
      }
    }
    kick();
  }

  function update() { if (host) render(host, lastOpen); }

  function bind(k, b) {
    const p = phys.get(k);
    b.addEventListener('pointerenter', () => { p.hover = true; kick(); });
    b.addEventListener('pointerleave', () => { p.hover = false; p.tilt = 0; kick(); });
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      p.tilt = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
      kick();
    });
    b.addEventListener('focus', () => { p.hover = true; kick(); });
    b.addEventListener('blur', () => { p.hover = false; kick(); });
    b.addEventListener('click', () => {
      if (animating) return;
      p.v -= 260; kick();
      const [kind, id] = k.split(':');
      if (kind === 'newchar') { Book.addChar(); return; }
      const cur = Store.app.open;
      if (cur && cur.kind === kind && (cur.id || '') === id) { App.home({ animate: true }); return; } // ponowne kliknięcie odkłada księgę
      playOpen(b, () => App.openBook(id ? { kind, id } : { kind }));
    });
  }

  /* ---------- animacje otwierania i odkładania ----------
     Księga w animacji to bryła 3D: przednia okładka (otwiera się na zawiasie), blok kartek i grzbiet
     prostopadły do okładki przy lewej krawędzi. Obrót bryły o 90° pokazuje grzbiet – wtedy księgę
     skaluje się proporcjonalnie (bez rozciągania) do wielkości grzbietu na półce. Grzbiet w animacji
     to kopia prawdziwego grzbietu (tytuł, emblemat, złocenia). */
  let animating = false;

  function bookBox(b) {
    const W = Math.min(300, window.innerWidth * 0.62), H = Math.round(W * 1.32);
    const left = (window.innerWidth - W) / 2, top = Math.max(16, (window.innerHeight - H) / 2);
    const ov = document.createElement('div');
    ov.className = 'open-anim';
    ov.innerHTML = `<div class="oa-book" style="--c:${b.style.getPropertyValue('--c')};left:${left}px;top:${top}px;width:${W}px;height:${H}px">
      <div class="oa-pages"></div>
      <div class="oa-spine"></div>
      <div class="oa-cover"><div class="oa-front"><span class="oa-icon">${$('.sp-icon', b).innerHTML}</span>
        <span class="oa-title">${esc($('.sp-title', b).textContent)}</span></div><div class="oa-inside"></div></div>
    </div>`;
    document.body.appendChild(ov);
    return { ov, book: $('.oa-book', ov), cover: $('.oa-cover', ov), spineFace: $('.oa-spine', ov), W, H, left, top };
  }

  /* Ustawia grzbiet bryły pod konkretny grzbiet na półce i zwraca transformacje:
     front – księga okładką do odbiorcy na środku, onShelf(lift) – grzbietem do odbiorcy w miejscu na półce. */
  function spinePose(box, b) {
    const { book, spineFace, H, left, top } = box;
    const r = b.getBoundingClientRect();
    const sw = b.offsetWidth || r.width, sh = b.offsetHeight || r.height;
    const s = sh / H, T = sw / s;               // skala jednolita; grubość bryły tak, by grzbiet miał szerokość sw
    spineFace.style.cssText = `left:${-T}px;width:${T}px;height:${H}px`;
    spineFace.innerHTML = '';
    const clone = b.cloneNode(true);
    clone.removeAttribute('data-key'); clone.style.transform = `scale(${1 / s})`; clone.style.visibility = 'visible';
    clone.classList.remove('active', 'lean');
    clone.style.transformOrigin = '0 0'; clone.style.margin = '0'; clone.style.transition = 'none';
    // kopia jest poza regałem: skala regału i wygląd paska przenoszone jawnie
    const cs = getComputedStyle(b);
    clone.style.setProperty('--S', cs.getPropertyValue('--S') || '1');
    clone.style.setProperty('--W', cs.getPropertyValue('--W') || '1');
    clone.style.width = sw + 'px'; clone.style.height = sh + 'px';
    if (b.closest('.compact')) clone.classList.add('as-compact');
    spineFace.appendChild(clone);
    book.style.transformOrigin = `0 0 ${-T / 2}px`;
    // po obrocie o 90° grzbiet zajmuje x ∈ [−sT/2, sT/2] wokół lewej krawędzi bryły
    const cx = r.left + r.width / 2 - left, ty = r.top + r.height - sh - top;
    return {
      front: 'translate(0px, 0px) scale(1) rotateY(0deg)',
      mid: `translate(${cx * 0.4}px, ${ty * 0.4 - 30}px) scale(${0.55 + s * 0.45}) rotateY(52deg)`,
      onShelf: lift => `translate(${cx}px, ${ty - lift}px) scale(${s}) rotateY(90deg)`,
    };
  }

  /* Przezroczystość okładki i bloku kartek w trakcie lotu (klatki kluczowe: wartości i przesunięcia). */
  function faces(box, vals, offs, duration) {
    const kf = vals.map((v, i) => ({ opacity: v, offset: offs[i] }));
    // ostatnia wartość trzymana do końca (bez tego przeglądarka dokłada klatkę końcową z wartością wyjściową 1)
    if (offs[offs.length - 1] < 1) kf.push({ opacity: vals[vals.length - 1], offset: 1 });
    for (const el of [box.cover, $('.oa-pages', box.ov)]) el.animate(kf, { duration, fill: 'forwards' });
  }

  function playOpen(b, done) {
    if (reduced() || !b.animate) { done(); return; }
    animating = true;
    const box = bookBox(b);
    const pose = spinePose(box, b);
    const finish = () => { box.ov.remove(); b.style.visibility = ''; animating = false; };
    b.style.visibility = 'hidden';                       // na półce zostaje luka po wyjętej księdze
    faces(box, [0, 0, 1], [0, 0.3, 0.55], 700);          // na półce widać tylko grzbiet; okładka pojawia się przy obrocie
    box.book.animate([
      { transform: pose.onShelf(0), offset: 0 },
      { transform: pose.onShelf(24), offset: 0.22 },     // wysunięcie z półki
      { transform: pose.mid, offset: 0.6 },              // obrót okładką do odbiorcy
      { transform: pose.front, offset: 1 },
    ], { duration: 700, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' }).finished.then(() => {
      b.style.visibility = '';
      done(); // zawartość powstaje pod otwierającą się okładką
      box.cover.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-158deg)' }],
        { duration: 420, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
      box.ov.animate([{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }],
        { duration: 620, easing: 'ease-in', fill: 'forwards' }).finished.then(finish, finish);
    }, () => { finish(); done(); });
  }

  /* Odkładanie: odwrotność otwierania. Okładka zamyka się (regał rozwija się z paska – done()),
     bryła obraca się grzbietem i wsuwa na swoje miejsce; prawdziwy grzbiet jest ukryty do lądowania. */
  function playClose(key, done) {
    const b = els.get(key);
    if (reduced() || !b || !b.animate || animating) { done(); return; }
    animating = true;
    const box = bookBox(b);
    box.cover.style.transform = 'rotateY(-158deg)';
    const finish = spine => { if (spine) spine.style.visibility = ''; box.ov.remove(); animating = false; };
    box.ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 170, easing: 'ease-out', fill: 'forwards' }).finished.then(() => {
      done(); // widok księgi znika pod nakładką, regał rozwija się do pełnego widoku
      const spine = els.get(key);
      if (spine) spine.style.visibility = 'hidden';
      box.cover.animate([{ transform: 'rotateY(-158deg)' }, { transform: 'rotateY(0deg)' }],
        { duration: 540, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' }).finished.then(() => {
        if (!spine || !spine.isConnected) { finish(spine); return; }
        const pose = spinePose(box, spine);
        faces(box, [1, 1, 0], [0, 0.3, 0.58], 680);     // przy lądowaniu zostaje sam grzbiet (bez klina okładki w perspektywie)
        box.book.animate([
          { transform: pose.front },
          { transform: pose.mid, offset: 0.4 },          // obrót grzbietem do odbiorcy
          { transform: pose.onShelf(26), offset: 0.8 },  // zawiśnięcie nad miejscem
          { transform: pose.onShelf(0) },                // wsunięcie
        ], { duration: 680, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' }).finished.then(() => {
          finish(spine);
          const p = phys.get(key);
          if (p) { p.y = -5; p.v = 40; kick(); }         // osiadanie; sąsiedzi drgną przez tarcie
        }, () => finish(spine));
      }, () => finish(spine));
    }, () => { finish(null); done(); });
  }

  /* ---------- fizyka ---------- */
  function targets(k, compact) {
    const p = phys.get(k);
    const scale = compact ? 0.45 : 1;
    const active = els.get(k)?.classList.contains('active');
    let ty = p.hover ? -13 * scale : 0;
    if (active) ty = -16 * scale;
    let tr = (leanOn.has(k) ? LEAN_DEG : 0) + (p.hover ? p.tilt * 2.2 : 0);
    // oparta księga: unosi się razem z sąsiadką i lekko prostuje
    const base = leanOn.get(k);
    if (base) {
      const q = phys.get(base);
      ty += q.y * 0.6;
      tr += -q.y * 0.12 / scale;
    }
    // tarcie o bezpośrednich sąsiadów
    for (const row of rows) {
      const i = row.indexOf(k);
      if (i < 0) continue;
      for (const j of [i - 1, i + 1]) {
        const nk = row[j];
        if (nk && leanOn.get(k) !== nk) ty += phys.get(nk).y * 0.12;
      }
    }
    return [ty, tr];
  }

  function step() {
    raf = 0;
    const compact = !!lastOpen;
    const K = 170, C = 15, dt = 1 / 60;
    const instant = reduced();
    let moving = false;
    // przy ograniczonym ruchu: kilka przebiegów bez animacji, żeby oparta księga i sąsiedzi ustawili się od razu
    for (let pass = 0; pass < (instant ? 4 : 1); pass++) {
    const next = new Map();
    for (const k of els.keys()) next.set(k, targets(k, compact));
    for (const [k, b] of els) {
      const p = phys.get(k);
      const [ty, tr] = next.get(k);
      if (instant) { p.y = ty; p.r = tr; p.v = p.vr = 0; }
      else {
        p.v += (K * (ty - p.y) - C * p.v) * dt; p.y += p.v * dt;
        p.vr += (K * (tr - p.r) - C * p.vr) * dt; p.r += p.vr * dt;
        if (Math.abs(p.v) > 0.05 || Math.abs(ty - p.y) > 0.05 || Math.abs(p.vr) > 0.02 || Math.abs(tr - p.r) > 0.02) moving = true;
      }
      b.style.transform = `translate3d(0, ${p.y.toFixed(2)}px, 0) rotate(${p.r.toFixed(3)}deg)`;
    }
    }
    if (moving) raf = requestAnimationFrame(step);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(step); }

  /* Grzbiet po kluczu i „podskok” (np. gdy wpadła do niego karteczka z zaklęciem). */
  function spineEl(key) { return els.get(key) || null; }
  function bump(key) { const p = phys.get(key); if (p) { p.v -= 220; kick(); } }

  return { render, update, playClose, spineEl, bump, ICONS, svg, keyOf, charColor, charIcon, autoColor, PALETTE };
})();
