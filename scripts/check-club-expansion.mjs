import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Run against the development preview (its existing __mx5 inspection handle).
const base=process.env.TEST_URL ?? 'http://127.0.0.1:3000/';
const browser=await chromium.launch({ channel:process.env.BROWSER_CHANNEL ?? 'chrome',
  args:['--enable-unsafe-swiftshader'] });
const page=await browser.newPage({ viewport:{width:1440,height:960} });
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{
  // Vite serves no favicon in this project; it is unrelated to viewer assets.
  if(m.type()==='error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text());
});
page.on('response',r=>{if(r.status()>=400) errors.push(`${r.status()} ${r.url()}`);});
const out='blender/build/club-viewer';
await fs.mkdir(out,{recursive:true});
async function ready(ids,env) {
  await page.waitForFunction(({ids,env})=>{
    const s=window.__mx5;
    if(!s || s.environment.environmentId!==env) return false;
    const names=[];s.scene.traverse(o=>names.push(o.name));
    return ids.every(id=>names.includes(`Mod_${id}`));
  },{ids,env},{timeout:60000});
  await page.waitForTimeout(1500);
}
async function snapshot(name) {await page.screenshot({path:`${out}/${name}.png`});}
try {
  await page.goto(`${base}?wheels=concave_split_five&lip=carbon_corner_splitters&skirts=race_side_steps&wing=club_bridge_spoiler&exh=slash_cut_twin&extras=DT30,DT31&env=urban_night`,{waitUntil:'networkidle'});
  await ready(['W10','FA30','RA30','RA32','EX30','DT30','DT31'],'urban_night');
  await page.getByRole('button',{name:'Wheels',exact:true}).click();
  await page.getByRole('button',{name:'Club Concave Split Five',exact:true}).click();
  assert.ok(page.url().includes('wheels=concave_split_five'));
  await snapshot('split-five-rooftop-front');
  const wheelCount=await page.evaluate(()=>{
    let count=0;window.__mx5.scene.traverse(o=>{if(o.name==='Mod_W10') count++;});return count;
  });
  assert.equal(wheelCount,4);
  await page.getByRole('button',{name:'Aero',exact:true}).click();
  for(const name of ['Rally Mud Flaps','Rear Tow Eye']) {
    assert.equal(await page.getByRole('switch',{name:new RegExp(name)}).getAttribute('aria-checked'),'true');
  }
  await snapshot('club-aero-panel');
  // Inspect fitted geometry from rear and above without changing the build.
  for(const [view,pos,target] of [['rear',[-3.7,1.6,-4.8],[0,.65,-.6]],['top',[0,7,.1],[0,0,0]]]) {
    await page.evaluate(({pos,target})=>{
      const r=window.__mx5.rig;r.camera.position.fromArray(pos);r.controls.target.fromArray(target);r.controls.update();
    },{pos,target});
    await page.waitForTimeout(500);await snapshot(`club-${view}`);
  }
  await page.goto(`${base}?wheels=retro_three_spoke&wing=gurney_flap&exh=rolled_single&env=sunset&cam=rear_aero`,{waitUntil:'networkidle'});
  await ready(['W11','RA31','EX31'],'sunset');
  await snapshot('retro-sunset-rear');
  await page.getByRole('button',{name:'Wheels',exact:true}).click();
  await page.getByRole('button',{name:'Club Retro Three Spoke',exact:true}).click();
  assert.ok(page.url().includes('wheels=retro_three_spoke'));
  await page.reload({waitUntil:'networkidle'});
  await ready(['W11','RA31','EX31'],'sunset');
  // Confirm all six scenes still use their HDR and photographic ground.
  await page.getByRole('button',{name:'Scene',exact:true}).click();
  for(const [id,name] of [['studio','Photo Studio'],['warehouse','Auto Workshop'],['salt_flats','Open Hills'],
    ['mountain_pass','Mountain Road'],['sunset','Bushveld Sunset'],['urban_night','Rooftop Twilight']]) {
    await page.getByRole('button',{name:new RegExp(name)}).first().click();
    await ready(['W11'],id);
    assert.equal(await page.evaluate(()=>window.__mx5.environment.usingHdriEnvironment),true);
    assert.equal(await page.evaluate(()=>window.__mx5.environment.ground.visible),false);
  }
  assert.equal(await page.evaluate(()=>window.__mx5.renderer.getContext().isContextLost()),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: wheel selectors, four instances, aero geometry, share/reload, six HDRIs, WebGL and no failed assets');
} finally {await browser.close();}
