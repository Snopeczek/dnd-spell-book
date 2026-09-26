import asyncio, json
from playwright.async_api import async_playwright
from pathlib import Path
URL=(Path(__file__).resolve().parents[1]/"dist"/"DnD Spell Book.html").as_uri()
FIX=Path(__file__).resolve().parent/"fixtures"
import tempfile; SHOTS=Path(tempfile.gettempdir())/"spellbook-tests"; SHOTS.mkdir(exist_ok=True)
def ok(c,m): print(('OK  ' if c else 'FAIL'),m)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await (await b.new_context(viewport={'width':1360,'height':900},reduced_motion='reduce')).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        ls=lambda k: pg.evaluate(f"JSON.parse(localStorage.getItem('{k}'))")
        await pg.goto(URL); await pg.wait_for_timeout(200)
        await pg.click('.spine[data-key="newchar:"]'); await pg.wait_for_timeout(250)
        await pg.select_option('[data-k=cls]','wizard'); await pg.wait_for_timeout(150)
        cid=(await ls('dndsb:ver:2024'))['chars'][0]['id']
        sp=f'.spine[data-key="char:{cid}"]'
        auto=await pg.evaluate(f"document.querySelector('{sp}').style.getPropertyValue('--c')")
        ok(await pg.locator('#detail .swatches .swatch').count()==13 and await pg.locator('#detail .emblems .emb').count()==15,'sekcja „Wygląd księgi”: 12 kolorów + auto, emblemat klasy + 14 pozostałych (bez powtórzenia)')
        ok(await pg.locator('input[name=lk-color][value=""]').is_checked() and await pg.locator('input[name=lk-emb][value=""]').is_checked(),'domyślnie: automatyczne')
        await pg.evaluate("document.querySelector('#detail').scrollTop=9999"); st0=await pg.evaluate("document.querySelector('#detail').scrollTop")
        await pg.click('.swatch:has(input[value="#2e5f8e"]) span'); await pg.wait_for_timeout(200)
        c1=await pg.evaluate(f"document.querySelector('{sp}').style.getPropertyValue('--c')")
        ok(c1=='#2e5f8e' and auto!='#2e5f8e','kolor grzbietu na regale zmieniony')
        ok(await pg.evaluate("document.querySelector('.charbook').style.getPropertyValue('--cover')")=='#2e5f8e','okładka otwartej księgi zmieniona')
        ok('#2e5f8e' in await pg.evaluate("document.querySelector('.bookhead').getAttribute('style')"),'znaczek w nagłówku zmieniony')
        st1=await pg.evaluate("document.querySelector('#detail').scrollTop")
        ok(st1==st0 and st1>0,f'przewinięcie strony zachowane ({st0} → {st1})')
        await pg.click('.emb:has(input[value="gear"]) span'); await pg.wait_for_timeout(200)
        gear=await pg.evaluate("(()=>{const d=document.createElement('div');d.innerHTML=ClassBook.emblem('gear','');return d.innerHTML})()")
        ok(await pg.evaluate(f"document.querySelector('{sp} .sp-icon').innerHTML")==gear,'emblemat na grzbiecie: zębatka')
        ok(await pg.evaluate("document.querySelector('.bm-sheet .bm-ico').innerHTML")==gear,'emblemat na zakładce „karta”')
        s=await ls('dndsb:ver:2024'); ok(s['chars'][0]['look']=={'color':'#2e5f8e','emblem':'gear'},'zapisane w postaci')
        # zmiana klasy nie rusza wybranego emblematu
        await pg.select_option('[data-k=cls]','cleric'); await pg.wait_for_timeout(150)
        ok(await pg.evaluate(f"document.querySelector('{sp} .sp-icon').innerHTML")==gear,'zmiana klasy: wybrany emblemat zostaje')
        # powrót do automatycznych
        await pg.click('.swatch.auto span'); await pg.click('.emb:has(input[value=""]) span'); await pg.wait_for_timeout(200)
        s=await ls('dndsb:ver:2024'); ok('look' not in s['chars'][0],'automatyczne: pole look usunięte')
        ok(await pg.evaluate(f"document.querySelector('{sp}').style.getPropertyValue('--c')")==auto and await pg.evaluate(f"document.querySelector('{sp} .sp-icon').innerHTML")==await pg.evaluate("(()=>{const d=document.createElement('div');d.innerHTML=ClassBook.emblem('cleric','');return d.innerHTML})()"),'powrót: kolor automatyczny, emblemat klasy (Cleric)')
        # kopia zapasowa
        await pg.click('.swatch:has(input[value="#94701f"]) span'); await pg.wait_for_timeout(150)
        exp=await pg.evaluate("Settings.exportData(['2024'])")
        ok('"look"' in exp,'wygląd w kopii zapasowej')
        # po przeładowaniu
        await pg.reload(); await pg.wait_for_timeout(300)
        ok(await pg.evaluate(f"document.querySelector('{sp}').style.getPropertyValue('--c')")=='#94701f','po przeładowaniu kolor zachowany')
        await pg.screenshot(path=str(SHOTS/'lk1.png'))
        # animacja odkładania używa nowego koloru
        a=await (await b.new_context(viewport={'width':1360,'height':900})).new_page()
        await a.goto(URL); st=await pg.evaluate("({a:localStorage.getItem('dndsb:app'),v:localStorage.getItem('dndsb:ver:2024')})")
        await a.evaluate(f"localStorage.setItem('dndsb:app',{json.dumps(st['a'])});localStorage.setItem('dndsb:ver:2024',{json.dumps(st['v'])})"); await a.reload(); await a.wait_for_timeout(1300)
        await a.click('[data-home]'); await a.wait_for_timeout(200)
        ok('#94701f' in (await a.evaluate("document.querySelector('.oa-book').getAttribute('style')")),'animacja odkładania w nowym kolorze')
        print('BŁĘDY JS:',errs); await b.close()
asyncio.run(main())
