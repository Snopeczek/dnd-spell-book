import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
URL=(Path(__file__).resolve().parents[1]/"dist"/"DnD Spell Book.html").as_uri()
FIX=Path(__file__).resolve().parent/"fixtures"
def ok(c,m): print(('OK  ' if c else 'FAIL'),m)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1360,'height':900},reduced_motion='reduce')).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(200)
        await pg.click('.spine[data-key="newchar:"]'); await pg.wait_for_timeout(250)   # domyślnie Bard
        vals=await pg.evaluate("[...document.querySelectorAll('input[name=lk-emb]')].map(i=>i.value)")
        ok('bard' not in vals and vals[0]=='' and len(vals)==15,f'Bard: bez drugiej liry ({len(vals)} opcji)')
        await pg.select_option('[data-k=cls]','warlock'); await pg.wait_for_timeout(150)
        vals=await pg.evaluate("[...document.querySelectorAll('input[name=lk-emb]')].map(i=>i.value)")
        ok('warlock' not in vals and 'bard' in vals,'po zmianie na Warlocka: bez oka, lira wraca na listę')
        # stary zapis z jawnie wybranym emblematem własnej klasy
        await pg.evaluate("(()=>{const ch=Store.cur().chars[0]; ch.look={color:null,emblem:'warlock'}; Store.save(); App.render();})()"); await pg.wait_for_timeout(150)
        ok(await pg.locator('input[name=lk-emb][value=""]').is_checked(),'jawnie wybrany emblemat klasy: zaznaczone „emblemat klasy”')
        print('BŁĘDY JS:',errs); await b.close()
asyncio.run(main())
