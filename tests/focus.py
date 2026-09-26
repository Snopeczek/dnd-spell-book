# Regresja: zmiana pola formularza wywołuje render, który przebudowuje DOM.
# 1) zmiana, gdy inne pole wciąż ma fokus, nie może rzucać NotFoundError i musi zapisać obie wartości;
# 2) kliknięcie w kolejne pole zaraz po edycji poprzedniego nie może gubić kursora.
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
URL=(Path(__file__).resolve().parents[1]/"dist"/"DnD Spell Book.html").as_uri()
def ok(c,m): print(('OK  ' if c else 'FAIL'),m)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1360,'height':900},reduced_motion='reduce')).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(200)
        await pg.click('.spine[data-key="newchar:"]'); await pg.wait_for_timeout(200)
        await pg.fill('.charbook .name','Elowen'); await pg.select_option('[data-k=cls]','wizard'); await pg.wait_for_timeout(150)
        c=await pg.evaluate("Store.vs['2024'].chars[0]")
        ok(c['name']=='Elowen' and c['cls']=='wizard','imię i klasa zapisane mimo fokusu w polu imienia')
        await pg.click('[data-k=lvl]'); await pg.keyboard.press('Control+A'); await pg.keyboard.type('7')
        await pg.click('.charbook .name'); await pg.wait_for_timeout(50)
        ok(await pg.evaluate("document.activeElement.matches('.charbook .name')"),'po zmianie poziomu klik w imię daje kursor w polu imienia')
        await pg.keyboard.type(' Vale'); await pg.keyboard.press('Tab'); await pg.wait_for_timeout(150)
        c=await pg.evaluate("Store.vs['2024'].chars[0]")
        ok(c['lvl']==7 and c['name']=='Elowen Vale',f"poziom i dopisane imię zapisane ({c['lvl']}, {c['name']!r})")
        ok(not errs,'brak błędów JS')
        print('BŁĘDY JS:',errs); await b.close()
asyncio.run(main())
