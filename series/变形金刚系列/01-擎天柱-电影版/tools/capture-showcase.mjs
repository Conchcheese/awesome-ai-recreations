// Real UI recording: no synthetic buttons, pose API calls or model replacement.
import {root,dep} from './deps.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await dep('playwright');
const out=path.join(root,'artifacts/showcase');await fs.mkdir(out,{recursive:true});
await fs.rm(path.join(out,'capture-complete.json'),{force:true});
const browser=await chromium.launch({headless:true,channel:process.platform==='darwin'?'chromium':undefined,args:['--allow-file-access-from-files',...(process.platform==='darwin'?['--use-angle=metal']:['--enable-unsafe-swiftshader'])]});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1920,height:1080}}});
const page=await context.newPage(),errors=[],marks=[];page.on('pageerror',e=>errors.push(e.message));
const began=performance.now();
const mark=label=>{const value={label,seconds:(performance.now()-began)/1000};marks.push(value);console.log(JSON.stringify(value));};
const hold=ms=>page.waitForTimeout(ms);
async function click(selector){await page.locator(selector).click();}
async function slide(selector,from,to,steps=18){const b=await page.locator(selector).boundingBox();if(!b)throw Error('Missing slider '+selector);await page.mouse.move(b.x+7+(b.width-14)*from,b.y+b.height/2);await page.mouse.down();for(let i=1;i<=steps;i++){let u=from+(to-from)*(i/steps);await page.mouse.move(b.x+7+(b.width-14)*u,b.y+b.height/2);await hold(45)}await page.mouse.up();}
async function orbit(){await page.mouse.move(1020,495);await page.mouse.down();await page.mouse.move(1210,510,{steps:40});await page.mouse.up();await hold(850);}
try{
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>window.study?.ready);await hold(1600);mark('ready');await page.screenshot({path:path.join(out,'web-hero.png')});
 await orbit();await hold(1000);mark('transform');await click('[data-mode="truck"]');await hold(2400);await click('[data-mode="robot"]');await hold(2600);
 mark('systems');await click('#research');await hold(700);await click('[data-mode="chest"]');await hold(2600);await click('[data-mode="arms"]');await hold(2600);
 mark('combination');await click('[data-mode="robot"]');await hold(1800);await page.locator('.panel > details').first().locator('summary').click();await hold(500);
 for(const key of ['chest','shoulders','legs'])await slide('[data-channel="'+key+'"]',0,.85);
 await hold(1800);await page.screenshot({path:path.join(out,'web-combination.png')});
 mark('selection');await click('[data-mode="robot"]');await hold(1700);const head=page.locator('#tree details').filter({hasText:'头部 / 面甲'});await head.locator('summary').click();await head.locator('button').first().click();await hold(1200);await page.screenshot({path:path.join(out,'web-selection.png')});
 await page.locator('.panel').evaluate(el=>el.scrollTo({top:0,behavior:'smooth'}));await hold(800);await click('[data-view="side"]');await hold(1200);await click('[data-view="three"]');await hold(800);
 mark('inspection');await click('#gray');await hold(1700);await click('#joints');await hold(1700);await click('#gray');await click('#colors');await hold(2000);await page.screenshot({path:path.join(out,'web-inspection.png')});await click('#colors');await click('#joints');
 mark('disassembly');await click('[data-mode="explode"]');await hold(3200);await page.screenshot({path:path.join(out,'web-exploded.png')});await slide('#layers',1,.35,26);await hold(1000);mark('reassembly');await click('[data-mode="assemble"]');await hold(2500);await click('#research');await hold(800);await orbit();await hold(1600);mark('end');
 const stats=await page.evaluate(()=>window.study.stats());if(errors.length)throw Error(errors.join('\n'));
 await fs.writeFile(path.join(out,'capture.json'),JSON.stringify({kind:'actual-browser-ui-recording',viewport:[1920,1080],recordingFps:25,marks,stats,errors,htmlSha256:(await import('node:crypto')).createHash('sha256').update(await fs.readFile(path.join(root,'index.html'))).digest('hex')},null,2)+'\n');
 const video=page.video();await context.close();await video.saveAs(path.join(out,'web-features.webm'));await fs.writeFile(path.join(out,'capture-complete.json'),JSON.stringify({complete:true,seconds:(performance.now()-began)/1000}));
}finally{await browser.close();}
