import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
URL=(Path(__file__).resolve().parents[1]/"dist"/"DnD Spell Book.html").as_uri()
FIX=Path(__file__).resolve().parent/"fixtures"
import tempfile; SHOTS=Path(tempfile.gettempdir())/"spellbook-tests"; SHOTS.mkdir(exist_ok=True)
def ok(c,m): print(('OK  ' if c else 'FAIL'),m)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await (await b.new_context(viewport={'width':1360,'height':900})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(200)
        await pg.evaluate("localStorage.setItem('dndsb:app',JSON.stringify({ver:'2024',open:{kind:'compendium'},theme:'auto'}))"); await pg.reload(); await pg.wait_for_timeout(300)
        await pg.click('.bm[data-lv="4"]'); await pg.wait_for_timeout(150)
        ok(await pg.locator('.pt-overlay .pt-leaf').count()==4,'Kompendium C→4: cztery kartki w wachlarzu')
        await pg.wait_for_timeout(1500)
        ok(await pg.locator('.pt-overlay').count()==0 and await pg.locator('#c-vols [aria-selected=true]').get_attribute('data-lv')=='4','Kompendium: po animacji zakładka 4, nakładka usunięta')
        ok('Poziom 4' in await pg.inner_text('#c-vol'),'lista pod zakładką 4')
        # wąsko
        m=await (await b.new_context(viewport={'width':390,'height':800})).new_page()
        m.on('pageerror',lambda e:errs.append(str(e)))
        await m.goto(URL); await m.wait_for_timeout(200)
        await m.evaluate("localStorage.setItem('dndsb:app',JSON.stringify({ver:'2024',open:{kind:'class',id:'bard'},theme:'auto'}))"); await m.reload(); await m.wait_for_timeout(300)
        await m.click('.bm[data-lv="2"]'); await m.wait_for_timeout(300)
        ok(await m.locator('.pt-overlay .pt-leaf').count()==2,'telefon C→2: dwie kartki odchodzą w lewo')
        await m.screenshot(path=str(SHOTS/'p9.png'))
        await m.wait_for_timeout(800)
        ok(await m.locator('.pt-overlay').count()==0 and 'Poziom 2' in await m.inner_text('.page.listcol h3'),'telefon: po animacji zakładka 2')
        ok(await m.evaluate("document.documentElement.scrollWidth<=innerWidth"),'telefon: bez poziomego przewijania strony')
        await m.click('.bm[data-lv="0"]'); await m.wait_for_timeout(250)
        ok(await m.locator('.pt-overlay .pt-leaf').count()==2,'telefon 2→C: dwie kartki opadają z lewej')
        await m.wait_for_timeout(800)
        ok(await m.locator('.pt-overlay').count()==0 and 'Cantrips' in await m.inner_text('.page.listcol h3'),'telefon: po animacji Cantrips')
        # szybkie kliknięcia w trakcie
        await pg.click('.bm[data-lv="6"]'); await pg.wait_for_timeout(100); await pg.click('.bm[data-lv="8"]', force=True); await pg.wait_for_timeout(1400)
        ok(await pg.locator('#c-vols [aria-selected=true]').get_attribute('data-lv')=='6' and await pg.locator('.pt-overlay').count()==0,'kliknięcie w trakcie ignorowane, nakładka sprzątnięta')
        ids=await pg.evaluate("(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.length-new Set(ids).size})()")
        ok(ids==0,'brak zdublowanych identyfikatorów')
        # ograniczony ruch
        r=await (await b.new_context(viewport={'width':1360,'height':900},reduced_motion='reduce')).new_page()
        await r.goto(URL); await r.wait_for_timeout(200)
        await r.evaluate("localStorage.setItem('dndsb:app',JSON.stringify({ver:'2024',open:{kind:'class',id:'bard'},theme:'auto'}))"); await r.reload(); await r.wait_for_timeout(300)
        await r.click('.bm[data-lv="6"]'); await r.wait_for_timeout(30)
        ok(await r.locator('.pt-overlay').count()==0 and 'Poziom 6' in await r.inner_text('.page.listcol h3'),'ograniczony ruch: zmiana natychmiast, bez animacji')
        print('BŁĘDY JS:',errs); await b.close()
asyncio.run(main())
