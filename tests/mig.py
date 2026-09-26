import asyncio, json
from playwright.async_api import async_playwright
from pathlib import Path
URL=(Path(__file__).resolve().parents[1]/"dist"/"DnD Spell Book.html").as_uri()
FIX=Path(__file__).resolve().parent/"fixtures"
def ok(c,m): print(('OK  ' if c else 'FAIL'),m)
mk=lambda cid,name,cls,lvl=5:{"id":cid,"name":name,"cls":cls,"lvl":lvl,"score":16,"ab":"INT","customName":"","adj":{"c":0,"s":0},"dcBonus":0,"atkBonus":0,"override":None,"spells":{"fire-bolt":{"prep":False,"always":False}},"notes":""}
OLD={"schema":1,"chars":[mk('ch-a','Tinker','cc-x'),mk('ch-b','Zagubiony','cc-brak')],"active":"ch-a",
     "homebrew":[{"id":"hb-1","hb":True,"n":"Iskra","l":1,"s":"Evocation","c":["cc-x","wizard"],"ct":"Action","r":"30 feet","cp":["V"],"d":"Instantaneous","co":False,"ri":False,"x":[]}],
     "filters":{},"sel":None,"shelf":{"cls":"cc-x","lvl":0,"sel":None,"q":""},"charView":{},
     "classes":[{"id":"cc-x","n":"Artificer","ab":"INT","caster":"halfUp","mode":"prepared","color":"#2e5f8e","emblem":"gear","rows":[],"spells":["fire-bolt"]}]}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1360,'height':900},reduced_motion='reduce')).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL)
        await pg.evaluate(f"localStorage.setItem('dndsb:ver:2024',{json.dumps(json.dumps(OLD))});localStorage.setItem('dndsb:app',JSON.stringify({{ver:'2024',open:{{kind:'class',id:'cc-x'}},theme:'auto'}}))")
        await pg.reload(); await pg.wait_for_timeout(400)
        ok(not errs,'dane z własną klasą: start bez błędów')
        ok('Artificer' in await pg.inner_text('.bookhead'),'otwarta księga własnej klasy zostaje otwarta')
        chs=await pg.evaluate("Store.vs['2024'].chars.map(c=>[c.cls,c.customName])")
        ok(chs==[['cc-x',''],['custom','Własna klasa']],f'postać klasy istniejącej zostaje, brakującej → jednorazowa ({chs})')
        await pg.click('.spine[data-key="char:ch-a"]'); await pg.wait_for_timeout(300)
        ok('Sloty\t4\t2' in await pg.inner_text('.slot-table'),'Artificer 5: sloty 4/2')
        backup={"app":"dnd-spell-book","format":1,"versions":{"2024":{"chars":[mk('ch-z','Import','cc-y')],"homebrew":[],"classes":[{**OLD['classes'][0],'id':'cc-y','n':'Klasa z kopii'}]}}}
        await pg.click('.spine[data-key="settings:"]'); await pg.wait_for_timeout(200)
        await pg.click('[data-paste]'); await pg.fill('#imp-text',json.dumps(backup)); await pg.click('[data-imp-text]'); await pg.wait_for_timeout(300)
        r=await pg.evaluate("(()=>{const s=Store.vs['2024'];const c=s.chars.find(c=>c.name==='Import');const k=s.classes.find(k=>k.n==='Klasa z kopii');return [!!k, c.cls===k.id]})()")
        ok(r==[True,True],'import kopii z klasą: klasa z nowym id, postać przypięta')
        print('BŁĘDY JS:',errs); await b.close()
asyncio.run(main())
