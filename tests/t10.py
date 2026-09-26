import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
URL=(Path(__file__).resolve().parents[1]/"dist"/"DnD Spell Book.html").as_uri()
FIX=Path(__file__).resolve().parent/"fixtures"
import tempfile; SHOTS=Path(tempfile.gettempdir())/"spellbook-tests"; SHOTS.mkdir(exist_ok=True)
def ok(c,m): print(('OK  ' if c else 'FAIL'),m)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1360,'height':900},reduced_motion='reduce')).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(300)
        ls=lambda k: pg.evaluate(f"JSON.parse(localStorage.getItem('{k}'))")
        W=lambda key: pg.evaluate(f"parseFloat(document.querySelector('.spine[data-key=\"{key}\"]').style.getPropertyValue('--w'))")
        PX=lambda key: pg.evaluate(f"document.querySelector('.spine[data-key=\"{key}\"]').getBoundingClientRect().width")
        keys=await pg.evaluate("[...document.querySelectorAll('.spine')].map(s=>s.dataset.key)"); print(keys)
        ok(len(keys)==12 and keys[0]=='compendium:' and keys[-1]=='settings:' and 'newclass:' not in keys,'regał: Kompendium, 8 klas, Nowa postać, Własne, Ustawienia (bez „Nowej klasy”)')
        ok(await pg.locator('.tabs').count()==0,'brak zakładek')
        ok(await W('class:wizard')>await W('class:paladin'),'Wizard (218) grubszy niż Paladin (38)')
        # fizyka: hover unosi, oparta księga idzie za sąsiadką
        await pg.hover('.spine[data-key="class:warlock"]'); await pg.wait_for_timeout(800)
        tr=await pg.evaluate("['class:warlock','class:wizard','class:sorcerer','class:bard'].map(k=>document.querySelector(`.spine[data-key=\"${k}\"]`).style.transform)")
        print(tr)
        y=lambda t: float(t.split('translate3d(0px, ')[1].split('px')[0])
        ok(y(tr[0])<-10,'najechana księga unosi się')
        ok(y(tr[1])<-5,'oparta księga (Wizard) unosi się z sąsiadką')
        ok(-4<y(tr[2])<0,'sąsiad (Sorcerer) lekko przez tarcie')
        ok(abs(y(tr[3]))<0.5,'daleka księga (Bard) nieruchoma')
        await pg.mouse.move(10,880); await pg.wait_for_timeout(1500)
        tr=await pg.evaluate("document.querySelector('.spine[data-key=\"class:warlock\"]').style.transform")
        ok(abs(y(tr))<0.3,'po zjechaniu wraca na półkę')
        # nowa postać
        await pg.click('.spine[data-key="newchar:"]'); await pg.wait_for_timeout(400)
        s=await ls('dndsb:ver:2024'); cid=s['chars'][0]['id']
        ok((await ls('dndsb:app'))['open']=={'kind':'char','id':cid},'„Nowa postać” tworzy postać i otwiera jej księgę')
        ok(await pg.locator('.bookcase.compact').count()==1,'regał zwinięty do paska')
        ok(await pg.locator(f'.spine[data-key="char:{cid}"].active').count()==1,'księga postaci wysunięta (active)')
        await pg.fill('[data-k=name]','Elmira'); await pg.press('[data-k=name]','Tab'); await pg.wait_for_timeout(200)
        ok(await pg.locator(f'.spine[data-key="char:{cid}"] .sp-title').inner_text()=='Elmira','zmiana imienia widoczna na grzbiecie')
        ok('Elmira' in await pg.inner_text('.bookhead h2'),'nagłówek księgi z imieniem')
        await pg.select_option('[data-k=cls]','wizard'); await pg.wait_for_timeout(200)
        w0=await W(f'char:{cid}')
        # dodawanie zaklęć z księgi klasy -> grubość postaci rośnie
        await pg.click('[data-goto]'); await pg.wait_for_timeout(300)
        ok((await ls('dndsb:app'))['open']=={'kind':'class','id':'wizard'},'pusta księga postaci -> księga klasy Wizard')
        for i in range(5):
            await pg.locator('#sh-list [data-toggle]').nth(i).click(); await pg.wait_for_timeout(60)
            if await pg.locator('#dlg[open] [data-ok]').count(): await pg.click('#dlg [data-ok]'); await pg.wait_for_timeout(60)  # limit cantripów
        w1=await W(f'char:{cid}')
        ok(w1>w0 and abs((w1-w0)-5*1.6)<0.01,f'5 zaklęć pogrubia księgę postaci ({w0:.1f} -> {w1:.1f})')
        await pg.wait_for_timeout(700)
        px=await PX(f'char:{cid}'); print('szerokość px po animacji',px)
        await pg.locator('#sh-list [data-toggle]').nth(0).click(); await pg.wait_for_timeout(60)
        ok(await W(f'char:{cid}')<w1,'usunięcie zaklęcia odchudza księgę')
        await pg.click('#toast button'); await pg.wait_for_timeout(100)
        ok(abs(await W(f'char:{cid}')-w1)<0.01,'Cofnij przywraca grubość')
        # homebrew pogrubia księgę klasy i własne zaklęcia
        wc0=await W('class:wizard'); wh0=await W('homebrew:')
        await pg.click('.spine[data-key="homebrew:"]'); await pg.wait_for_timeout(300)
        for n in ['Kolec','Iskra','Mgła']:
            await pg.click('[data-new]'); await pg.fill('#h-n',n); await pg.check('input[name=cls][value=wizard]'); await pg.click('#dlg [data-ok]'); await pg.wait_for_timeout(100)
        ok(await W('class:wizard')>wc0,'3 własne zaklęcia Wizarda pogrubiają księgę Wizard')
        ok(await W('homebrew:')-wh0>7,'księga Własne zaklęcia wyraźnie grubsza')
        ok(await pg.locator('.spine[data-key="class:wizard"] .sp-sub').inner_text()=='221','licznik na grzbiecie 221')
        # przełączanie z paska i odkładanie
        await pg.click('.spine[data-key="compendium:"]'); await pg.wait_for_timeout(300)
        ok(await pg.locator('#c-vols .bm').count()==11,'z paska otwiera Kompendium (Wstążki + 10 zakładek)')
        await pg.click('.spine[data-key="compendium:"]'); await pg.wait_for_timeout(300)
        ok((await ls('dndsb:app'))['open'] is None and await pg.locator('.bookcase.compact').count()==0,'kliknięcie wysuniętej księgi odkłada ją')
        await pg.click('.spine[data-key="settings:"]'); await pg.wait_for_timeout(200)
        ok(await pg.locator('#view .legal').count()==1,'księga Ustawienia i dane')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        ok((await ls('dndsb:app'))['open'] is None,'Esc odkłada księgę')
        await pg.keyboard.press('/'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.activeElement.id")=='q','„/” otwiera Kompendium z kursorem w wyszukiwarce')
        await pg.click('#attrib [data-settings]'); await pg.wait_for_timeout(200)
        ok((await ls('dndsb:app'))['open']=={'kind':'settings'},'link w stopce otwiera Ustawienia')
        # usunięcie postaci z otwartej księgi -> regał
        await pg.click(f'.spine[data-key="char:{cid}"]'); await pg.wait_for_timeout(200)
        await pg.click('[data-del]'); await pg.wait_for_timeout(300)
        ok((await ls('dndsb:app'))['open'] is None and await pg.locator(f'.spine[data-key="char:{cid}"]').count()==0,'usunięcie postaci: znika z regału, wraca regał')
        await pg.click('#toast button'); await pg.wait_for_timeout(300)
        ok(await pg.locator(f'.spine[data-key="char:{cid}"]').count()==1,'Cofnij przywraca księgę postaci na regał')
        # wersje
        await pg.click('[data-ver="2014"]'); await pg.wait_for_timeout(300)
        k14=await pg.evaluate("[...document.querySelectorAll('.spine')].map(s=>s.dataset.key)")
        ok(not any(k.startswith('char:') for k in k14) and await pg.locator('.spine[data-key="class:wizard"] .sp-sub').inner_text()=='204','2014: osobny regał (bez postaci 2024, Wizard 204)')
        await pg.click('[data-ver="2024"]'); await pg.wait_for_timeout(300)
        # stary zapis z zakładką
        await pg.evaluate("localStorage.setItem('dndsb:app',JSON.stringify({ver:'2024',tab:'kompendium',theme:'auto'}))"); await pg.reload(); await pg.wait_for_timeout(300)
        ok(await pg.locator('.bookcase:not(.compact)').count()==1,'stary zapis (tab) -> pełny regał')
        # otwarta księga po przeładowaniu
        await pg.click('.spine[data-key="class:druid"]'); await pg.reload(); await pg.wait_for_timeout(300)
        ok('Druid' in await pg.inner_text('.bookhead'),'po przeładowaniu ta sama otwarta księga')
        await pg.screenshot(path=str(SHOTS/'r3.png'))
        # mobile
        m=await b.new_page(viewport={'width':390,'height':800}); await m.goto(URL); await m.wait_for_timeout(300)
        await m.screenshot(path=str(SHOTS/'r4.png'))
        print('BŁĘDY JS:',errs); await b.close()
asyncio.run(main())
