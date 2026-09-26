import asyncio, json
from playwright.async_api import async_playwright
from pathlib import Path
URL=(Path(__file__).resolve().parents[1]/"dist"/"DnD Spell Book.html").as_uri()
FIX=Path(__file__).resolve().parent/"fixtures"
import tempfile; SHOTS=Path(tempfile.gettempdir())/"spellbook-tests"; SHOTS.mkdir(exist_ok=True)
def ok(c,m): print(('OK  ' if c else 'FAIL'),m)
async def center(pg, sel):
    await pg.locator(sel).first.scroll_into_view_if_needed()   # strona księgi przewija się w środku
    r=await pg.locator(sel).first.bounding_box(); return r['x']+r['width']/2, r['y']+r['height']/2
async def drag(pg, src_sel, dst_sel, steps=18, shot=None, release=True):
    x,y=await center(pg,src_sel)
    await pg.mouse.move(x,y); await pg.mouse.down()
    await pg.mouse.move(x+10,y+4,steps=2)
    tx,ty=await center(pg,dst_sel)
    await pg.mouse.move(tx,ty,steps=steps)
    if shot: await pg.wait_for_timeout(30); await pg.screenshot(path=shot)
    if release: await pg.mouse.up(); await pg.wait_for_timeout(700)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await (await b.new_context(viewport={'width':1360,'height':900})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        ls=lambda k: pg.evaluate(f"JSON.parse(localStorage.getItem('{k}'))")
        await pg.goto(URL); await pg.wait_for_timeout(200)
        # dwie postaci: Wizard i Druid (bez animacji tworzenia – przez stan)
        await pg.evaluate("""(()=>{const mk=(id,name,cls)=>({id,name,cls,lvl:5,score:16,ab:'INT',customName:'',adj:{c:0,s:0},dcBonus:0,atkBonus:0,override:null,spells:{},used:[0,0,0,0,0,0,0,0,0],pactUsed:0,arcUsed:[],conc:null,notes:''});
          localStorage.setItem('dndsb:ver:2024',JSON.stringify({schema:1,chars:[mk('ch-w','Elmira','wizard'),mk('ch-d','Borin','druid')],active:'ch-w',homebrew:[],filters:{},sel:null,shelf:{cls:null,lvl:null,sel:null,q:''},charView:{}}));
          localStorage.setItem('dndsb:app',JSON.stringify({ver:'2024',open:{kind:'class',id:'wizard'},theme:'auto'}));})()""")
        await pg.reload(); await pg.wait_for_timeout(900)
        await pg.click('.bm[data-lv="3"]'); await pg.wait_for_timeout(1300)
        fb='#sh-list .spell-row[data-id="fireball"]'
        # przeciąganie z zrzutem w trakcie
        x,y=await center(pg,fb); await pg.mouse.move(x,y); await pg.mouse.down(); await pg.mouse.move(x+12,y,steps=2)
        ok(await pg.locator('.drag-note').count()==1,'po ruchu > 6 px pojawia się karteczka')
        cls=await pg.evaluate("Object.fromEntries([...document.querySelectorAll('.bookcase .spine')].map(b=>[b.dataset.key,[...b.classList].filter(c=>c.startsWith('drop-')).join(' ')]))")
        ok(cls['char:ch-w']=='drop-ok' and cls['char:ch-d']=='drop-no' and cls['newchar:']=='drop-ok' and cls['class:wizard']=='drop-off','Fireball: Wizard pasuje, Druid przygaszony, klasy wyłączone')
        await pg.mouse.move(x+420,y-40,steps=5); await pg.wait_for_timeout(40)
        ang=await pg.evaluate("parseFloat(document.querySelector('.drag-note').style.transform.split('rotate(')[1])")
        await pg.screenshot(path=str(SHOTS/'dr1.png'))
        await pg.wait_for_timeout(900)
        ang2=await pg.evaluate("parseFloat(document.querySelector('.drag-note').style.transform.split('rotate(')[1])")
        ok(abs(ang)>4 and abs(ang2)<1.5,f'karteczka buja się przy ruchu ({ang:.1f}°) i uspokaja ({ang2:.1f}°)')
        tx,ty=await center(pg,'.spine[data-key="char:ch-d"]'); await pg.mouse.move(tx,ty,steps=10); await pg.wait_for_timeout(60)
        tip=await pg.inner_text('.drop-tip'); ok('Druid nie ma tego zaklęcia' in tip,f'podpis nad Druidem: „{tip}”')
        await pg.screenshot(path=str(SHOTS/'dr2.png'))
        await pg.mouse.up(); await pg.wait_for_timeout(700)
        s=await ls('dndsb:ver:2024'); ok(not s['chars'][1]['spells'],'upuszczenie na Druida: odmowa, nic nie dodano')
        ok('Druid nie ma tego zaklęcia' in await pg.inner_text('#toast'),'komunikat z powodem')
        # na Wizarda – sukces
        w0=await pg.evaluate("parseFloat(document.querySelector('.spine[data-key=\"char:ch-w\"]').style.getPropertyValue('--w'))")
        await drag(pg,fb,'.spine[data-key="char:ch-w"]')
        s=await ls('dndsb:ver:2024'); ok('fireball' in s['chars'][0]['spells'],'upuszczenie na Wizarda: dodano Fireball')
        w1=await pg.evaluate("parseFloat(document.querySelector('.spine[data-key=\"char:ch-w\"]').style.getPropertyValue('--w'))")
        ok(w1>w0,'księga Wizarda grubsza')
        ok(await pg.locator('.drag-note').count()==0 and await pg.locator('.drop-tip').count()==0,'karteczka i podpis sprzątnięte')
        # ponownie – już jest
        await drag(pg,fb,'.spine[data-key="char:ch-w"]')
        ok('ma już to zaklęcie' in await pg.inner_text('#toast'),'drugi raz: „ma już to zaklęcie”')
        # cofnij dodanie
        await drag(pg,'#sh-list .spell-row[data-id="counterspell"]','.spine[data-key="char:ch-w"]')
        await pg.click('#toast button'); await pg.wait_for_timeout(150)
        ok('counterspell' not in (await ls('dndsb:ver:2024'))['chars'][0]['spells'],'Cofnij po przeciągnięciu')
        # nowa postać z księgi Wizarda
        await drag(pg,'#sh-list .spell-row[data-id="blink"]','.spine[data-key="newchar:"]')
        s=await ls('dndsb:ver:2024'); nc=s['chars'][-1]
        ok(len(s['chars'])==3 and nc['cls']=='wizard' and 'blink' in nc['spells'],'upuszczenie na „Nowa postać”: Wizard z Blink')
        # zwykłe kliknięcie nadal wybiera zaklęcie (brak przeciągania)
        await pg.click('#sh-list .spell-row[data-id="fly"]'); await pg.wait_for_timeout(150)
        ok('Fly' in await pg.inner_text('#detail'),'krótkie kliknięcie wybiera zaklęcie')
        # przeciągnięcie bez upuszczenia na cel – nic nie zmienia, nie wybiera wiersza
        before=await pg.inner_text('#detail h2')
        await drag(pg,'#sh-list .spell-row[data-id="haste"]','.bookhead h2')
        ok(await pg.inner_text('#detail h2')==before and len((await ls('dndsb:ver:2024'))['chars'][0]['spells'])==1,'upuszczenie poza regał: bez zmian, bez wyboru wiersza')
        # Esc w trakcie przeciągania nie odkłada księgi
        x,y=await center(pg,'#sh-list .spell-row[data-id="haste"]'); await pg.mouse.move(x,y); await pg.mouse.down(); await pg.mouse.move(x+40,y-40,steps=4)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400); await pg.mouse.up()
        ok(await pg.locator('.drag-note').count()==0 and (await ls('dndsb:app'))['open'] is not None,'Esc przerywa przeciąganie, księga zostaje otwarta')
        # Kompendium: Druid przyjmuje zaklęcie druida
        await pg.click('.spine[data-key="compendium:"]'); await pg.wait_for_timeout(1500)
        await pg.fill('#q','entangle'); await pg.wait_for_timeout(1300)
        await drag(pg,'#list .spell-row[data-id="entangle"]','.spine[data-key="char:ch-d"]')
        ok('entangle' in (await ls('dndsb:ver:2024'))['chars'][1]['spells'],'z Kompendium: Entangle do Druida')
        # księga postaci -> inna postać (kopiowanie)
        await pg.click('.spine[data-key="char:ch-w"]'); await pg.wait_for_timeout(1500)
        await pg.click('.charbook .bm[data-lv="3"]'); await pg.wait_for_timeout(1400)
        nid=s['chars'][-1]['id']
        await drag(pg,'#cb-left .book-row',f'.spine[data-key="char:{nid}"]')
        ok('fireball' in (await ls('dndsb:ver:2024'))['chars'][2]['spells'],'z księgi postaci do innej postaci (kopia)')
        print('BŁĘDY JS:',errs); await b.close()
asyncio.run(main())
