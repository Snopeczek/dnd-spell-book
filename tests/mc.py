import asyncio, json
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
        # obliczenia (bez UI)
        cases=[('2014',('wizard',3),[('cleric',2)],[4,3,2],None),
               ('2014',('paladin',5),[('sorcerer',3)],[4,3,2],None),
               ('2024',('paladin',5),[('sorcerer',3)],[4,3,3],None),
               ('2014',('paladin',5),[],[4,2],None),
               ('2014',('warlock',3),[('wizard',2)],[3],(2,2)),
               ('2014',('paladin',1),[('wizard',1)],[2],None),
               # połowa poziomu każdej półczarującej klasy liczona osobno (2024: w górę): 2 + 2 = 4 -> sloty 4/3,
               # tak jak liczy D&D Beyond; nie (3+3)/2 = 3
               ('2024',('ranger',3),[('paladin',3)],[4,3],None)]
        for ver,(c,l),multi,exp,pact in cases:
            r=await pg.evaluate(f"(()=>{{const ch=newChar('{ver}',{{cls:'{c}',lvl:{l},score:16,multi:{json.dumps([{'cls':m,'lvl':ml,'score':14} for m,ml in multi])}}});const x=Rules.casting(ch,'{ver}');return [x.slots.filter(n=>n),x.pact?[x.pact.n,x.pact.lvl]:null,x.lvl,x.pb,x.clsName]}})()")
            ok(r[0]==exp and (pact is None or r[1]==list(pact)),f"{ver} {c} {l}"+''.join(f" + {m} {ml}" for m,ml in multi)+f": sloty {r[0]}{' pakt '+str(r[1]) if r[1] else ''} (poziom {r[2]}, PB +{r[3]})")
        # UI
        await pg.click('.spine[data-key="newchar:"]'); await pg.wait_for_timeout(250)
        await pg.select_option('[data-k=cls]','wizard'); await pg.fill('[data-k=lvl]','3'); await pg.press('[data-k=lvl]','Tab'); await pg.wait_for_timeout(150)
        await pg.click('[data-mcadd]'); await pg.wait_for_timeout(150)
        opts=await pg.evaluate("[...document.querySelector('[data-mc=\"0\"][data-f=cls]').options].map(o=>o.value)")
        ok('wizard' not in opts,'multiklasa: nie można wybrać tej samej klasy (Wizard)')
        await pg.select_option('[data-mc="0"][data-f=cls]','cleric'); await pg.wait_for_timeout(150)
        await pg.fill('[data-mc="0"][data-f=lvl]','2'); await pg.press('[data-mc="0"][data-f=lvl]','Tab'); await pg.wait_for_timeout(150)
        dis=await pg.evaluate("document.querySelector('[data-k=cls] option[value=cleric]').disabled")
        ok(dis,'klasa główna: Cleric wyłączony (jest w multiklasie)')
        sl=await pg.inner_text('.slot-table'); ok('Sloty\t4\t3\t2' in sl,'karta: sloty 4/3/2 (Wizard 3 + Cleric 2)')
        ok('Wizard 3 / Cleric 2' in await pg.inner_text('.bookhead'),'nagłówek: Wizard 3 / Cleric 2')
        hint=await pg.inner_text('.charbook .stats + .hint'); ok('Cleric: DC' in hint and '(WIS)' in hint,'DC i atak osobno dla każdej klasy')
        # limit poziomu 20
        await pg.fill('[data-mc="0"][data-f=lvl]','19'); await pg.press('[data-mc="0"][data-f=lvl]','Tab'); await pg.wait_for_timeout(150)
        ml=await pg.evaluate("Store.cur().chars[0].multi[0].lvl"); ok(ml==17,f'łączny poziom maks. 20 (Cleric przycięty do {ml})')
        ok(await pg.locator('[data-mcadd]').is_disabled(),'przy poziomie 20 nie da się dodać klasy')
        await pg.fill('[data-mc="0"][data-f=lvl]','2'); await pg.press('[data-mc="0"][data-f=lvl]','Tab'); await pg.wait_for_timeout(150)
        # przeciąganie: zaklęcie Clerica (Bless) przyjęte
        ok(await pg.evaluate("Book.fitsClass(Store.cur().chars[0], Data.spell('2024',Store.cur(),'bless'))"),'zaklęcie z listy Clerica pasuje do postaci Wizard/Cleric')
        ok(not await pg.evaluate("Book.fitsClass(Store.cur().chars[0], Data.spell('2024',Store.cur(),'hunters-mark'))"),"Hunter's Mark (Ranger) nie pasuje")
        # usunięcie klasy z multiklasy + cofnij
        await pg.click('[data-mcdel="0"]'); await pg.wait_for_timeout(150)
        ok(not await pg.evaluate("Store.cur().chars[0].multi"),'usunięcie klasy z multiklasy')
        await pg.click('#toast button'); await pg.wait_for_timeout(150)
        ok(await pg.evaluate("Store.cur().chars[0].multi.length")==1,'Cofnij')
        print('BŁĘDY JS:',errs); await b.close()
asyncio.run(main())
