import asyncio, json
from playwright.async_api import async_playwright
from pathlib import Path
URL=(Path(__file__).resolve().parents[1]/"dist"/"DnD Spell Book.html").as_uri()
FIX=Path(__file__).resolve().parent/"fixtures"
def ok(c,m): print(('OK  ' if c else 'FAIL'),m)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await (await b.new_context(viewport={'width':1360,'height':900},reduced_motion='reduce')).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        ls=lambda k: pg.evaluate(f"JSON.parse(localStorage.getItem('{k}'))")
        await pg.goto(URL); await pg.wait_for_timeout(200)
        await pg.click('.spine[data-key="newchar:"]'); await pg.wait_for_timeout(200)   # Bard 1: 2 cantripy (2024)
        await pg.click('[data-goto]'); await pg.wait_for_timeout(200)
        for i in range(2): await pg.locator('#sh-list [data-toggle]').nth(i).click(); await pg.wait_for_timeout(60)
        ok(await pg.locator('#sh-list .iconbtn.at-limit').count()==await pg.locator('#sh-list .spell-row').count()-2,'po 2 cantripach pozostałe „+” przygaszone')
        await pg.locator('#sh-list [data-toggle]').nth(2).click(); await pg.wait_for_timeout(100)
        t=await pg.inner_text('#dlg'); ok('Limit cantripów osiągnięty' in t and '2 z 2' in t,'3. cantrip: ostrzeżenie „Limit cantripów osiągnięty (2 z 2)”')
        ok(await pg.evaluate("document.activeElement.textContent.trim()")=='Anuluj','domyślnie aktywne „Anuluj”')
        await pg.click('#dlg [data-x]'); await pg.wait_for_timeout(100)
        s=await ls('dndsb:ver:2024'); ok(len(s['chars'][0]['spells'])==2,'Anuluj: nie dodano')
        await pg.locator('#sh-list [data-toggle]').nth(2).click(); await pg.wait_for_timeout(100)
        await pg.click('#dlg [data-ok]'); await pg.wait_for_timeout(100)
        s=await ls('dndsb:ver:2024'); ok(len(s['chars'][0]['spells'])==3,'„Dodaj mimo to”: dodano')
        # zaklęcia 1. poziomu: Bard 2024 przygotowuje -> bez ostrzeżenia
        await pg.click('.bm[data-lv="1"]'); await pg.wait_for_timeout(150)
        for i in range(6): await pg.locator('#sh-list [data-toggle]').nth(i).click(); await pg.wait_for_timeout(50)
        ok(await pg.locator('#dlg[open]').count()==0,'2024 Bard (przygotowuje): bez ostrzeżenia przy zaklęciach 1. poziomu')
        # karta zaklęcia: przycisk „Dodaj do księgi” też ostrzega
        await pg.click('.bm[data-lv="0"]'); await pg.wait_for_timeout(150)
        await pg.locator('#sh-list .spell-row').nth(5).click(); await pg.wait_for_timeout(100)
        await pg.click('#detail [data-act=add-book]'); await pg.wait_for_timeout(100)
        ok('Limit cantripów' in await pg.inner_text('#dlg'),'przycisk na karcie zaklęcia też ostrzega')
        await pg.click('#dlg [data-x]')
        # 2014 Bard: znane zaklęcia
        await pg.click('[data-ver="2014"]'); await pg.wait_for_timeout(200)
        await pg.click('.spine[data-key="newchar:"]'); await pg.wait_for_timeout(200)
        await pg.select_option('[data-k=cls]','bard'); await pg.wait_for_timeout(100)
        ok('0/4' in await pg.inner_text('.charbook .stats'),'Bard 1 (2014): 4 znane zaklęcia')
        await pg.click('[data-goto]'); await pg.wait_for_timeout(200)
        await pg.click('.bm[data-lv="1"]'); await pg.wait_for_timeout(150)
        for i in range(4): await pg.locator('#sh-list [data-toggle]').nth(i).click(); await pg.wait_for_timeout(50)
        await pg.locator('#sh-list [data-toggle]').nth(4).click(); await pg.wait_for_timeout(100)
        ok('Limit znanych zaklęć osiągnięty' in await pg.inner_text('#dlg'),'2014 Bard: 5. znane zaklęcie – ostrzeżenie')
        await pg.click('#dlg [data-x]')
        # Kompendium też przygasza
        await pg.click('.spine[data-key="compendium:"]'); await pg.wait_for_timeout(200)
        await pg.click('.bm[data-lv="1"]'); await pg.wait_for_timeout(150)
        ok(await pg.locator('#list .iconbtn.at-limit').count()>0,'Kompendium: przygaszone „+” przy pełnym limicie')
        print('BŁĘDY JS:',errs); await b.close()
asyncio.run(main())
