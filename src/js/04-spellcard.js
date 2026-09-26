/* 04-spellcard.js — pełna karta zaklęcia (używana w księgach klas, kompendium i księdze postaci). */
'use strict';

const SpellCard = (() => {
  const COMP = { V: 'V', S: 'S', M: 'M' };

  function components(sp) {
    const c = (sp.cp || []).map(x => COMP[x] || x).join(', ');
    return sp.m ? `${c} (${esc(sp.m)})` : esc(c || '—');
  }

  function effectTable(sp, ch, ver) {
    const cast = ch ? Rules.casting(ch, ver) : null;
    const m = cast ? cast.mod : undefined;
    const rows = [];
    const sub = s => (m === undefined ? s : String(s).replace(/\s*\+\s*MOD/, m === 0 ? '' : (m > 0 ? ` + ${m}` : ` − ${-m}`)));
    const table = (tab, lab) => '<div class="dmg-table">' + Object.keys(tab).map(Number).sort((a, b) => a - b)
      .map(k => `<span><b>${lab(k)}</b>${esc(sub(tab[k]))}</span>`).join('') + '</div>';
    if (sp.dm) {
      if (sp.dm.ch) {
        rows.push(`<div>Obrażenia${sp.dm.t ? ` (${esc(sp.dm.t)})` : ''} wg poziomu postaci:` +
          table(sp.dm.ch, k => `od ${k}.`) + '</div>');
      } else if (sp.dm.sl) {
        const keys = Object.keys(sp.dm.sl);
        rows.push(`<div>Obrażenia${sp.dm.t ? ` (${esc(sp.dm.t)})` : ''}${keys.length > 1 ? ' wg poziomu slotu' : ''}:` +
          table(sp.dm.sl, k => `${k}:`) + '</div>');
      }
    }
    if (sp.he) rows.push('<div>Leczenie wg poziomu slotu:' + table(sp.he, k => `${k}:`) + '</div>');
    if (!rows.length) return '';
    const note = m !== undefined && JSON.stringify(sp).includes('MOD') ? `<p class="hint">MOD zastąpione modyfikatorem postaci (${signed(m)}).</p>` : '';
    return `<div class="card-dmg">${rows.join('')}${note}</div>`;
  }

  /* ctx: 'compendium' | 'book' */
  function html(sp, ver, { ch = null, ctx = 'compendium', closable = false } = {}) {
    const inBook = ch && ch.spells[sp.id];
    const tags = [];
    if (sp.co) tags.push('<span class="tag c">Concentration</span>');
    if (sp.ri) tags.push('<span class="tag">Ritual</span>');
    if (sp.hb) tags.push('<span class="tag hb">Własne</span>');
    const stats = [
      ['Czas rzucania', esc(sp.ct)], ['Zasięg', esc(sp.r)],
      ['Komponenty', components(sp)], ['Czas trwania', (sp.co && !/concentration/i.test(sp.d) ? 'Concentration, ' : '') + esc(sp.d)],
    ];
    if (sp.sv) stats.push(['Rzut obronny', esc(ABILITIES[sp.sv] || sp.sv)]);
    if (sp.at) stats.push(['Atak', sp.at === 'ranged' ? 'Ranged spell attack' : sp.at === 'melee' ? 'Melee spell attack' : esc(sp.at)]);
    const clsNames = (sp.c || []).map(id => Data.cls(ver, id)?.n || id).join(', ');
    stats.push(['Klasy', clsNames ? esc(clsNames) : '<span class="muted">—</span>']);
    if (sp.sc && sp.sc.length) stats.push(['Podklasy', esc(sp.sc.join(', '))]);

    const acts = [];
    {
      if (ch) {
        acts.push(inBook
          ? `<button class="btn" data-act="rm-book" data-id="${esc(sp.id)}">Usuń z księgi</button>`
          : `<button class="btn primary" data-act="add-book" data-id="${esc(sp.id)}">Dodaj do księgi: ${esc(ch.name)}</button>`);
      } else {
        acts.push('<span class="muted">Aby dodawać zaklęcia do księgi postaci, utwórz postać: pusta księga „Nowa postać” na regale.</span>');
      }
      acts.push(sp.hb
        ? `<button class="btn" data-act="edit-hb" data-id="${esc(sp.id)}">Edytuj</button>`
        : `<button class="btn ghost" data-act="copy-hb" data-id="${esc(sp.id)}" title="Utwórz własną, edytowalną kopię">Kopiuj jako własne</button>`);
    }
    if (closable) acts.push('<button class="btn ghost only-narrow" data-act="close-card" style="margin-left:auto">Zamknij</button>');

    return `<article class="card" style="--sc:${schoolVar(sp.s)}">
      <div class="card-head">
        <h2>${esc(sp.n)}</h2>
        <div class="card-sub">${esc(Rules.levelLabel(sp, ver))}${tags.join('')}</div>
      </div>
      <dl class="card-stats">${stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <div class="card-body">${mdBlocks((sp.x || []).slice()) || '<p class="muted">Brak opisu.</p>'}</div>
      ${sp.hl ? `<div class="card-hl"><p><b>${esc(sp.hlL || 'At Higher Levels')}.</b> ${mdInline(sp.hl)}</p></div>` : ''}
      ${effectTable(sp, ch, ver)}
      <div class="card-foot">${acts.join('')}</div>
    </article>`;
  }

  /* Krótki opis do wierszy list. */
  function meta(sp) {
    const bits = [sp.s, sp.ct, sp.r];
    return esc(bits.join(', '));
  }
  function tags(sp) {
    return (sp.co ? '<span class="tag c" title="Concentration">C</span>' : '') +
      (sp.ri ? '<span class="tag" title="Ritual">R</span>' : '') +
      (sp.hb ? '<span class="tag hb">Własne</span>' : '');
  }

  return { html, meta, tags };
})();
