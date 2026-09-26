import asyncio, json
from playwright.async_api import async_playwright
from pathlib import Path
URL=(Path(__file__).resolve().parents[1]/"dist"/"DnD Spell Book.html").as_uri()
FIX=Path(__file__).resolve().parent/"fixtures"
def ok(c,m): print(('OK  ' if c else 'FAIL'),m)
async def center(pg, sel):
    await pg.locator(sel).first.scroll_into_view_if_needed()
    r=await pg.locator(sel).first.bounding_box(); return r['x']+r['width']/2, r['y']+r['height']/2
async def drag(pg, src, dst):
    x,y=await center(pg,src); await pg.mouse.move(x,y); await pg.mouse.down(); await pg.mouse.move(x+10,y+4,steps=2)
    tx,ty=await center(pg,dst); await pg.mouse.move(tx,ty,steps=12); await pg.mouse.up(); await pg.wait_for_timeout(500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1360,'height':900},reduced_motion='reduce')).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(200)
        await pg.click('[data-ver="2014"]'); await pg.wait_for_timeout(150)
        ok(await pg.locator('.spine[data-key="newclass:"]').count()==0,'brak pustej księgi „Nowa klasa”')
        await pg.click('.spine[data-key="settings:"]'); await pg.wait_for_timeout(200)
        await pg.set_input_files('#imp-file',str(FIX/'sample-spells-2014.json')); await pg.wait_for_timeout(400)
        await pg.set_input_files('#imp-file',str(FIX/'sample-class-2014.json')); await pg.wait_for_timeout(400)
        print('komunikat:', (await pg.inner_text('#toast')).split('\n')[0])
        cid=await pg.evaluate("Store.vs['2014'].classes[0].id")
        top=await pg.evaluate("[...document.querySelector('.shelf').querySelectorAll('.spine')].map(s=>s.dataset.key)")
        ok(top[-1]==f'class:{cid}' and len(top)==10,'Tinkerer na górnej półce, za klasami SRD (oparty o Wizarda)')
        gear=await pg.evaluate("(()=>{const d=document.createElement('div');d.innerHTML=ClassBook.emblem('gear','');return d.innerHTML})()")
        ok(await pg.evaluate(f"document.querySelector('.spine[data-key=\"class:{cid}\"] .sp-icon').innerHTML")==gear,'emblemat zębatki na grzbiecie')
        await pg.click(f'.spine[data-key="class:{cid}"]'); await pg.wait_for_timeout(250)
        ok('Tinkerer' in await pg.inner_text('.bookhead') and await pg.locator('[data-editcls]').count()==1,'księga Tinkerera z przyciskiem „Edytuj klasę”')
        ok(await pg.locator('#sh-list [data-comp]').count()==1,'pusta lista: podpowiedź')
        # edycja: cantripy 2 (1-9), 3 (10-13), 4 (14-20); przygotowane jak Paladin 2014? wpiszmy ręcznie kilka wartości
        await pg.click('[data-editcls]'); await pg.wait_for_timeout(150)
        for i in range(20): await pg.fill(f'[data-c="{i}"]', '2' if i<9 else ('3' if i<13 else '4'))
        await pg.fill('[data-p="0"]','2'); await pg.fill('[data-p="4"]','5')
        await pg.click('#dlg [data-ok]'); await pg.wait_for_timeout(200)
        cc=await pg.evaluate("Store.vs['2014'].classes[0]"); ok(cc['rows'][9]['c']==3 and cc['rows'][4]['p']==5,'edycja tabeli zapisana')
        # zaklęcia na listę: z Własnych (import) i z Kompendium (SRD)
        await pg.click('.spine[data-key="homebrew:"]'); await pg.wait_for_timeout(250)
        await drag(pg,'#hb-left .book-row:has-text("Pocket Spark")',f'.spine[data-key="class:{cid}"]')
        await pg.click('.spine[data-key="compendium:"]'); await pg.wait_for_timeout(250)
        await pg.fill('#q','cure wounds'); await pg.wait_for_timeout(300)
        await drag(pg,'#list .spell-row[data-id="cure-wounds"]',f'.spine[data-key="class:{cid}"]')
        sp=await pg.evaluate("Store.vs['2014'].classes[0].spells.length"); ok(sp==2,'przeciągnięte 2 zaklęcia (własne + SRD) na listę Tinkerera')
        # postać Tinkerer
        await pg.click('.spine[data-key="newchar:"]'); await pg.wait_for_timeout(250)
        await pg.select_option('[data-k=cls]',cid); await pg.fill('[data-k=lvl]','5'); await pg.press('[data-k=lvl]','Tab'); await pg.wait_for_timeout(150)
        st=await pg.inner_text('.charbook .stats'); sl=await pg.inner_text('.slot-table')
        ok('0/2' in st and '0/5' in st and 'Sloty\t4\t2' in sl,'postać Tinkerer 5: 2 cantripy, 5 przygotowanych, sloty 4/2')
        ok(await pg.evaluate("document.querySelector('.bm-sheet .bm-ico').innerHTML")==gear,'zębatka na karcie postaci')
        chid=await pg.evaluate("Store.vs['2014'].chars[0].id")
        await pg.click(f'.spine[data-key="class:{cid}"]'); await pg.wait_for_timeout(250)
        await pg.click('.bm[data-lv="1"]'); await pg.wait_for_timeout(200)
        await drag(pg,'#sh-list .spell-row[data-id="cure-wounds"]',f'.spine[data-key="char:{chid}"]')
        ok('cure-wounds' in await pg.evaluate("Object.keys(Store.vs['2014'].chars[0].spells)"),'z księgi Tinkerera do postaci')
        await pg.click('.spine[data-key="compendium:"]'); await pg.wait_for_timeout(250)
        await pg.fill('#q','magic missile'); await pg.wait_for_timeout(300)
        await drag(pg,'#list .spell-row[data-id="magic-missile"]',f'.spine[data-key="char:{chid}"]')
        ok('magic-missile' not in await pg.evaluate("Object.keys(Store.vs['2014'].chars[0].spells)"),'Magic Missile spoza listy Tinkerera: odmowa')
        # usuń z listy klasy + cofnij
        await pg.click(f'.spine[data-key="class:{cid}"]'); await pg.wait_for_timeout(250)
        await pg.click('.bm[data-lv="1"]'); await pg.wait_for_timeout(150)
        await pg.click('[data-unlist="cure-wounds"]'); await pg.wait_for_timeout(150)
        ok('cure-wounds' not in await pg.evaluate("Store.vs['2014'].classes[0].spells"),'„−”: usunięte z listy klasy')
        await pg.click('#toast button'); await pg.wait_for_timeout(150)
        # kopia zapasowa w obie strony
        exp=await pg.evaluate("Settings.exportData(['2014'])"); ok('"Tinkerer"' in exp,'Tinkerer w kopii zapasowej')
        # 2024 bez Tinkerera
        await pg.click('[data-ver="2024"]'); await pg.wait_for_timeout(200)
        ok(await pg.locator('.shelf').first.locator('.spine').count()==9,'2024: bez Tinkerera')
        await pg.click('[data-ver="2014"]'); await pg.wait_for_timeout(200)
        print('BŁĘDY JS:',errs); await b.close()
asyncio.run(main())
