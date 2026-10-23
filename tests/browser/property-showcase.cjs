// Local UI checks: all provider/API calls are simulated; no bookings or writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.ROAMING_BROWSER_URL||'http://127.0.0.1:8000';
const apertureMatches=()=>{
 const cover=document.querySelector('.tutorial-highlight-overlay'),button=document.querySelector('.booking-submit'),bar=document.querySelector('.booking-bar');
 if(!cover||!button)return false;
 const rect=button.getBoundingClientRect(),source=getComputedStyle(cover).clipPath.match(/"([^"]+)"/)?.[1];
 if(!source)return false;
 const path=new Path2D(source),canvas=document.createElement('canvas').getContext('2d');
 const masked=(x,y)=>canvas.isPointInPath(path,x,y,'evenodd');
 const cx=rect.x+rect.width/2,cy=rect.y+rect.height/2,region=bar.getBoundingClientRect();
 const guide=document.querySelector('#booking-guide').getBoundingClientRect();
 return rect.top>=0&&rect.bottom<=innerHeight&&
  [[cx,cy],[rect.left+.25,cy],[rect.right-.25,cy],[cx,rect.top+.25],[cx,rect.bottom-.25]].every(([x,y])=>!masked(x,y))&&
  [[region.x+region.width/2,region.y+region.height/2],[guide.x+guide.width/2,guide.y+guide.height/2],...[...bar.querySelectorAll('.booking-field-horizontal')].map(element=>{const box=element.getBoundingClientRect();return [box.x+box.width/2,box.y+box.height/2];})].every(([x,y])=>!masked(x,y))&&
  [[region.x+region.width/2,region.top-2],[region.x+region.width/2,region.bottom+2],[region.left-2,region.y+region.height/2],[region.right+2,region.y+region.height/2]].filter(([x,y])=>x>=0&&x<innerWidth&&y>document.querySelector('header.sticky-top').getBoundingClientRect().bottom&&y<innerHeight).every(([x,y])=>masked(x,y));
};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const context=await browser.newContext(process.env.ROAMING_BROWSER_STORAGE?{storageState:process.env.ROAMING_BROWSER_STORAGE}:{});
  const page=await context.newPage();
  const errors=[],calls=[]; let properties=[],offline=false;
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==new URL(base).origin||url.pathname.startsWith('/reservation/')||route.request().method()!=='GET')return route.abort();
   if(!url.pathname.startsWith('/api/'))return route.continue();
   calls.push(url);
   if(offline)return route.fulfill({status:503,contentType:'application/json',body:'{}'});
   const slug=url.pathname.match(/^\/api\/properties\/([^/]+)\/availability$/)?.[1]||url.searchParams.get('slug');
   const selected=properties.filter(p=>!slug||p.slug===slug);
   if(url.pathname==='/api/availability')return route.fulfill({contentType:'application/json',body:JSON.stringify({enabled:true,availability:selected.map(p=>({...p,status:'available',available:true,nights:2,price:320,currency:'EUR',fees:{},detailsUrl:'/property/'+p.slug,bookingUrl:null}))})});
   const year=Number(url.searchParams.get('year')),month=Number(url.searchParams.get('month'));
   return route.fulfill({contentType:'application/json',body:JSON.stringify({enabled:true,properties:selected.map(p=>({...p,status:'fresh',fetchedAt:new Date().toISOString(),days:Array.from({length:new Date(year,month,0).getDate()},(_,i)=>({date:`${year}-${String(month).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`,available:true,price:120,minStay:2}))}))})});
  });
  const fresh=()=>page.waitForFunction(()=>document.querySelector('.property-showcase.is-ready')&&document.querySelector('#date-range')?._flatpickr);
  const active=()=>page.locator('.showcase-slide.is-active');
  const collectionCard=slug=>page.locator(`.showcase-slide[data-slug="${slug}"]`);
  const settled=()=>page.waitForFunction(()=>!document.querySelector('.property-showcase').classList.contains('is-moving'));
  const choose=async slug=>{
   await page.locator(`.showcase-slide[data-slug="${slug}"]`).evaluate(slide=>{
    const index=[...slide.parentElement.children].indexOf(slide);
    slide.closest('.property-showcase').querySelector(`.showcase-picker button[data-index="${index}"]`).click();
   });
   await settled();
  };
  await page.goto(base+'/?_locale=fr'); await fresh();
  properties=await page.locator('#booking-property option[value]:not([value=""])').evaluateAll(options=>options.map(o=>({slug:o.value,name:o.textContent,city:o.textContent,maxGuests:Number(o.dataset.capacity)})));
  const collection=page.locator('.property-showcase .showcase-slide');
  assert.equal(await collection.count(),properties.length,'the home carousel contains all active properties');
  assert.deepEqual((await collection.evaluateAll(cards=>cards.map(card=>card.dataset.slug))).sort(),properties.map(property=>property.slug).sort());
  const photoSlug=await page.locator('.showcase-slide:has(img)').first().getAttribute('data-slug');
  assert.equal(await active().getAttribute('data-has-photo'),'true','carousel opens on an actual photographed stay');
  for(const property of properties){
   await choose(property.slug);
   const card=collectionCard(property.slug);
   assert.equal(await card.isVisible(),true);
   assert.equal(await card.locator('.showcase-card').evaluate(element=>element.inert),false,'selected carousel card remains accessible');
   assert.equal(new URL(await card.locator('.showcase-card-media').getAttribute('href'),base).pathname,'/property/'+property.slug);
   assert.equal(new URL(await card.locator('.showcase-book').getAttribute('href'),base).searchParams.get('slug'),property.slug);
   assert.ok(await card.locator('h3').innerText(),'each card names its actual property');
  }
  // Both pages share carousel arrows, keyboard selection and real drag input.
  for(const routePath of ['/?_locale=fr','/disponibilites?_locale=fr']){
   await page.goto(base+routePath);await page.waitForSelector('.property-showcase.is-ready');
   const initial=await active().getAttribute('data-slug');
   await page.locator('.showcase-arrow').last().click();await settled();
   assert.notEqual(await active().getAttribute('data-slug'),initial);
   await page.locator('.showcase-arrow').first().click();await settled();
   assert.equal(await active().getAttribute('data-slug'),initial);
   await page.locator('.showcase-picker button[aria-pressed="true"]').focus();await page.keyboard.press('End');await settled();
   assert.equal(await page.locator('.showcase-picker button').last().getAttribute('aria-pressed'),'true');
   await page.keyboard.press('Home');await settled();
   assert.equal(await page.locator('.showcase-picker button').first().getAttribute('aria-pressed'),'true');
   await choose(photoSlug);await active().scrollIntoViewIfNeeded();
   const media=await active().locator('[data-showcase-card]').boundingBox();
   await page.mouse.move(media.x+media.width*.8,media.y+100);await page.mouse.down();
   await page.mouse.move(media.x+media.width*.2,media.y+100,{steps:8});await page.mouse.up();await settled();
   assert.notEqual(await active().getAttribute('data-slug'),photoSlug,'drag selects a different stay');
   assert.equal(new URL(page.url()).pathname,new URL(routePath,base).pathname,'drag does not follow a property link');
  }
  await page.goto(base+'/disponibilites?_locale=fr');
  await page.waitForSelector('.availability-showcase.is-ready');
  assert.equal(await page.locator('.showcase-slide').count(),properties.length);
  await choose(photoSlug);await page.waitForTimeout(650);
  assert.equal(await active().getAttribute('data-has-photo'),'true');
  const initial=await active().getAttribute('data-slug');
  await page.locator('.showcase-arrow').last().click();
  assert.notEqual(await active().getAttribute('data-slug'),initial);
  await page.locator('.showcase-arrow').first().click();
  assert.equal(await active().getAttribute('data-slug'),initial);
  await page.locator('.showcase-picker button').first().focus(); await page.keyboard.press('End');
  assert.equal(await page.locator('.showcase-picker button').last().getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Home');
  assert.equal(await page.locator('.showcase-picker button').first().getAttribute('aria-pressed'),'true');
  await choose(photoSlug); await page.waitForTimeout(650);
  await active().scrollIntoViewIfNeeded();
  const box=await active().boundingBox(),media=await active().locator('.availability-property-card').boundingBox();
  await page.mouse.move(box.x+box.width*.65,media.y+media.height*.5);
  await page.mouse.down(); await page.mouse.move(box.x+box.width*.25,media.y+media.height*.5,{steps:8}); await page.mouse.up();
  assert.notEqual(await active().getAttribute('data-slug'),photoSlug,'drag must select another property');
  assert.equal(new URL(page.url()).pathname,'/disponibilites');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await active().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const entry of ['collection','property'])for(const width of [1440,390,320]) {
   const locale=width===390?'en':'fr';
   await page.setViewportSize({width,height:width===320?700:1000});
   await page.goto(base+'/?_locale='+locale+'&guests=2'); await fresh();
   const before=calls.length;
   assert.deepEqual(await page.locator('#booking-search-form > .booking-field-horizontal').evaluateAll(fields=>fields.map(field=>field.id)),['property-toggle','date-toggle','guests-toggle'],'field order matches visual and keyboard progression');
   if(entry==='collection'){await choose(photoSlug);await collectionCard(photoSlug).locator('.showcase-book').click();}
   else {
    await page.locator('#property-display').click();
    assert.equal(await page.locator('#booking-guide [aria-current="step"]').getAttribute('data-guide-step'),'1');
    assert.equal(await page.locator('#property-panel').evaluate(panel=>panel.contains(document.activeElement)),true);
    assert.equal(await page.locator('#property-panel [data-guide-hint="property"]').isVisible(),true);
    assert.equal(await page.locator('.tutorial-highlight-overlay').count(),1,'blur starts with the property step');
    assert.equal(await page.locator('.booking-submit').evaluate(button=>button.getAnimations().some(animation=>animation.effect.getTiming().iterations===Infinity)),false,'search only pulses at the final step');
    assert.equal(await page.locator('#property-panel').evaluate(panel=>getComputedStyle(panel,'::backdrop').backgroundColor),'rgba(0, 0, 0, 0)','the guided panel does not dim the clear search module');
    assert.equal(calls.length,before,'opening properties does not query availability');
    await page.locator(`[data-property-option="${photoSlug}"]`).click();
   }
   await page.waitForSelector('#date-panel[open]');
   assert.equal(await page.locator('.tutorial-highlight-overlay').count(),1,'blur remains active on dates, including collection entry');
   assert.equal(await page.locator('#booking-property').inputValue(),photoSlug);
   assert.equal(await page.locator('#property-display').innerText(),await page.locator('#property-display-text').innerText(),'no stray v after the selected property');
   assert.equal(new URL(page.url()).searchParams.get('slug'),photoSlug);
   assert.equal(await page.locator('#arrival-date').inputValue(),'');
   assert.equal(await page.locator('#booking-guide [aria-current="step"]').getAttribute('data-guide-step'),'2');
   assert.equal(await page.locator('#booking-guide [data-guide-step="1"]').evaluate(item=>item.classList.contains('is-done')),true);
   await page.waitForFunction(()=>document.getElementById('date-availability-status').dataset.state==='fresh'&&!document.getElementById('date-calendar-surface').classList.contains('is-checking'));
   assert.ok(calls.slice(before).every(url=>url.pathname==='/api/properties/'+photoSlug+'/availability'));
   const dates=await page.evaluate(()=>{
    const format=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
    const start=new Date();start.setDate(start.getDate()+3);const end=new Date(start);end.setDate(end.getDate()+2);return[format(start),format(end)];
   });
   await page.locator(`#date-panel .flatpickr-day[data-date="${dates[0]}"]`).click();
   await page.locator(`#date-panel .flatpickr-day[data-date="${dates[1]}"]`).click();
   await page.locator('#date-apply').click();
   await page.waitForSelector('#guests-panel[open]');
   assert.equal(await page.locator('.tutorial-highlight-overlay').count(),1,'blur remains active on guests');
   assert.equal(await page.locator('#date-panel').isVisible(),false);
   assert.equal(await page.locator('#booking-guide [aria-current="step"]').getAttribute('data-guide-step'),'3');
   await page.locator('#guests-increase').click();
   const quotesBefore=calls.filter(url=>url.pathname==='/api/availability').length;
   if(width===390)await page.mouse.click(4,500);
   else if(width===320)await page.locator('#guests-panel .search-popover-close').click();
   else await page.locator('#guests-apply').click();
   await page.locator('#guests-panel').waitFor({state:'hidden'});
   assert.equal(await page.locator('#guests-panel').isVisible(),false);
   assert.equal(await page.locator('#booking-guide [aria-current="step"]').getAttribute('data-guide-step'),'4');
   assert.equal(await page.locator('.booking-submit').evaluate(e=>e===document.activeElement),true);
   assert.equal(await page.locator('#booking-guide-search, .booking-guide-search-arrow').count(),0,'no message or arrow under the search button');
   assert.equal(await page.locator('.tutorial-highlight-overlay').count(),1);
   assert.equal(await page.locator('.tutorial-highlight-overlay').getAttribute('aria-hidden'),'true');
   assert.equal(await page.locator('.booking-submit').getAttribute('aria-describedby'),null);
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.booking-submit')).boxShadow==='none');
   assert.equal(await page.locator('.booking-submit').evaluate(e=>getComputedStyle(e).boxShadow),'none','no animated ring or underlay around the button');
   await page.waitForFunction(apertureMatches);
   await page.mouse.move(0,0);
   const duration=await page.locator('.booking-submit').evaluate(button=>{
    const animation=button.getAnimations().find(item=>item.effect.getTiming().iterations===Infinity);
    animation.pause();return animation.effect.getTiming().duration;
   });
   const pulse=[];
   for(const time of [0,duration/2,duration]){
    await page.locator('.booking-submit').evaluate((button,time)=>button.getAnimations().find(item=>item.effect.getTiming().iterations===Infinity).currentTime=time,time);
    await page.waitForFunction(apertureMatches);
    pulse.push(await page.locator('.booking-submit').evaluate(button=>{
     const rect=button.getBoundingClientRect();return {width:rect.width,height:rect.height,pageHeight:document.documentElement.scrollHeight};
    }));
   }
   await page.locator('.booking-submit').evaluate(button=>button.getAnimations().forEach(animation=>animation.play()));
   assert.ok(pulse[1].width>pulse[0].width*1.05&&pulse[1].height>pulse[0].height*1.05,'the actual button visibly grows');
   assert.ok(Math.abs(pulse[2].width-pulse[0].width)<1,'the button smoothly returns to its original size');
   assert.ok(pulse.every(frame=>frame.pageHeight===pulse[0].pageHeight),'scaling does not move the page layout');
   const spotlightState=await page.locator('.booking-submit').evaluate(button=>{
    const rect=button.getBoundingClientRect(),cover=document.querySelector('.tutorial-highlight-overlay');
    return {clickable:button.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)),animation:button.getAnimations().some(animation=>animation.playState==='running'),shade:getComputedStyle(cover).backgroundColor,blur:getComputedStyle(cover).backdropFilter};
   });
   assert.equal(spotlightState.clickable,true,'the genuine search button remains clickable through the spotlight');
   assert.equal(spotlightState.animation,true);
   assert.match(spotlightState.shade,/0\.56/,'the rest of the viewport is shaded');
   assert.equal(spotlightState.blur,'blur(5px)','the backdrop is blurred');
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.waitForFunction(()=>document.querySelector('.booking-submit').getAnimations().some(animation=>animation.playState==='running'&&animation.effect.getTiming().duration>=2600));
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>window.scrollBy({top:16,behavior:'instant'}));
   await page.waitForFunction(apertureMatches);
   assert.equal(calls.filter(url=>url.pathname==='/api/availability').length,quotesBefore,'guidance never launches the search automatically');
   if([1440,390].includes(width)){
    await page.locator('#booking-guide').evaluate(element=>Promise.allSettled(element.getAnimations().filter(animation=>animation.effect.getTiming().iterations!==Infinity).map(animation=>animation.finished)));
    await page.screenshot({path:`var/guide-search-step-${width}.png`});
   }
   if(width===320)await page.keyboard.press('Enter');
   else{
    const target=await page.locator('.booking-submit').boundingBox();
    await page.mouse.move(target.x+target.width/2,target.y+target.height/2);
    await page.waitForFunction(()=>document.querySelector('.booking-submit').getAnimations().every(animation=>animation.playState==='paused'));
    await page.locator('.booking-submit').click();
   }
   await page.waitForSelector('.booking-quote-card');
   assert.equal(await page.locator('#booking-guide').isVisible(),false);
   assert.equal(await page.locator('.tutorial-highlight-overlay').count(),0,'search removes the shade');
   assert.equal(await page.locator('.booking-submit').getAttribute('aria-describedby'),null);
   assert.equal(await page.locator('#guests-count').inputValue(),'3');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  // Choosing the current option or all properties must advance as well.
  await page.goto(base+'/?_locale=fr&guests=10');await fresh();
  const smaller=properties.find(property=>property.maxGuests<10);
  for(const slug of [smaller.slug,smaller.slug,'','']){
   await page.locator('#property-display').click();
   await page.locator(`[data-property-option="${slug}"]`).click();
   await page.waitForSelector('#date-panel[open]');
   assert.equal(await page.locator('#booking-property').inputValue(),slug);
   assert.equal(await page.locator('#booking-guide [aria-current="step"]').getAttribute('data-guide-step'),'2');
   assert.equal(await page.locator('#date-panel').evaluate(panel=>panel.contains(document.activeElement)),true);
   assert.equal(await page.locator('#property-panel').isVisible(),false);
   assert.equal(await page.locator('#guests-count').inputValue(),String(smaller.maxGuests),'choosing a smaller property keeps the calendar usable');
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#booking-guide').isVisible(),false);
  }
  await page.locator('#property-display').click();await page.locator('#property-panel .search-popover-close').click();
  assert.equal(await page.locator('#booking-guide').isVisible(),false);
  assert.equal(await page.locator('#date-panel').isVisible(),false,'dismissing properties does not advance');
  for(const locale of ['fr','en'])for(const theme of ['light','dark'])for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:1000});
   await page.goto(base+'/?_locale='+locale);await fresh();
   await page.evaluate(value=>document.documentElement.setAttribute('data-bs-theme',value),theme);
   await page.locator('#featured').scrollIntoViewIfNeeded();
   assert.equal(await collection.count(),properties.length);
   await choose(photoSlug);
   assert.equal(await collection.locator('[data-showcase-card]').evaluateAll(cards=>cards.filter(card=>!card.inert).length),1,'only the active card exposes links');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   for(const card of await active().evaluateAll(cards=>cards.map(element=>{const box=element.getBoundingClientRect();return{x:box.x,width:box.width};}))){
    assert.ok(card.x>=0&&card.x+card.width<=width,JSON.stringify({locale,theme,width,card}));
   }
   const photoLayout=await collectionCard(photoSlug).evaluate(card=>{
    const media=card.querySelector('.showcase-card-media').getBoundingClientRect(),info=card.querySelector('.showcase-card-info').getBoundingClientRect();
    return{height:media.height,width:media.width,mediaBottom:media.bottom,infoTop:info.top};
   });
   assert.ok(photoLayout.height>=260&&photoLayout.height>=photoLayout.width*.4,'wide central cards keep a generous photo area');
   assert.ok(photoLayout.mediaBottom<=photoLayout.infoTop+1,'property information follows its photograph');
   if(locale==='fr'&&theme==='light'&&[1440,390].includes(width))await page.screenshot({path:`var/showcase-${width}.png`,fullPage:false});
  }
  // The shade must never survive dismissal or navigation away from the guide.
  for(const dismissal of ['escape','outside','focus','turbo']){
   await page.goto(base+'/?_locale=fr');await fresh();
   await page.evaluate(value=>document.documentElement.dataset.bsTheme=value,dismissal==='outside'?'dark':'light');
   await page.evaluate(slug=>document.dispatchEvent(new CustomEvent('booking:guide',{detail:{slug},cancelable:true})),photoSlug);
   await page.waitForSelector('#date-panel[open]');
   await page.waitForFunction(()=>document.getElementById('date-availability-status').dataset.state==='fresh'&&!document.getElementById('date-calendar-surface').classList.contains('is-checking'));
   const dates=await page.evaluate(()=>{
    const start=new Date();start.setDate(start.getDate()+3);const end=new Date(start);end.setDate(end.getDate()+2);
    return [start,end].map(d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(d));
   });
   await page.locator(`#date-panel .flatpickr-day[data-date="${dates[0]}"]`).click();
   await page.locator(`#date-panel .flatpickr-day[data-date="${dates[1]}"]`).click();
   await page.locator('#date-apply').click();await page.locator('#guests-apply').click();
   assert.equal(await page.locator('.tutorial-highlight-overlay').count(),1);
   await page.setViewportSize({width:390,height:844});
   await page.waitForFunction(apertureMatches);
   if(dismissal==='escape')await page.keyboard.press('Escape');
   if(dismissal==='outside')await page.locator('#featured h2').click();
   if(dismissal==='focus')await page.locator('#date-display').focus();
   if(dismissal==='turbo'){await page.evaluate(()=>window.Turbo.visit('/contact-us'));await page.waitForURL('**/contact-us*');}
   assert.equal(await page.locator('.tutorial-highlight-overlay').count(),0,`${dismissal} removes the shade`);
   if(dismissal==='escape')assert.equal(await page.locator('.booking-submit').evaluate(button=>button===document.activeElement),true,'Escape at the search step retains the search button focus');
   if(dismissal!=='turbo')assert.equal(await page.locator('.booking-submit').evaluate(button=>button.getAnimations().some(animation=>animation.effect.getTiming().iterations===Infinity)),false,'the invitation animation is cancelled');
  }
  await page.goto(base+'/?_locale=fr');await fresh();
  await page.emulateMedia({reducedMotion:'reduce'});
  await choose(photoSlug);
  await collectionCard(photoSlug).locator('.showcase-book').click();await page.waitForSelector('#date-panel[open]');
  await page.keyboard.press('Escape');await page.locator('#date-panel').waitFor({state:'hidden'});assert.equal(await page.locator('#booking-guide').isVisible(),false);
  assert.equal(await page.locator('#date-display').evaluate(e=>e===document.activeElement),true);
  offline=true;
  await page.evaluate(slug=>document.dispatchEvent(new CustomEvent('booking:guide',{detail:{slug},cancelable:true})),photoSlug);
  await page.waitForSelector('#date-panel[open]');
  await page.waitForFunction(()=>document.getElementById('date-availability-status').dataset.state==='unverified');
  assert.equal(await page.locator('#date-apply').isDisabled(),true);
  await page.keyboard.press('Escape');
  // Grow only the rendered carousel to twenty stays. Records and API fixtures
  // remain untouched; this checks bounded controls as the catalogue expands.
  for(const routePath of ['/?_locale=en','/disponibilites?_locale=en'])for(const width of [1440,320]){
   await page.setViewportSize({width,height:900});await page.goto(base+routePath);
   await page.waitForSelector('.property-showcase.is-ready');
   await page.evaluate(()=>document.documentElement.dataset.bsTheme='dark');
   const carousel=page.locator('.property-showcase');
   await carousel.evaluate(element=>element.setAttribute('data-controller',''));
   await page.evaluate(()=>new Promise(requestAnimationFrame));
   await carousel.evaluate(element=>{
    const stage=element.querySelector('.showcase-stage'),rail=element.querySelector('.showcase-picker');
    const original=[...stage.children],choice=rail.querySelector('button').cloneNode(true);
    const slides=[],choices=[];
    for(let index=0;index<20;index++){
     const slide=original[index%original.length].cloneNode(true);slide.dataset.slug='qa-stay-'+index;slide.querySelector('.showcase-side-select').dataset.index=String(index);slides.push(slide);
     const option=choice.cloneNode(true);option.dataset.index=String(index);option.textContent='Logement de test '+(index+1);option.setAttribute('aria-label',option.textContent);choices.push(option);
    }
    stage.replaceChildren(...slides);rail.replaceChildren(...choices);element.dataset.activeSlug='qa-stay-0';element.dataset.propertyShowcaseAnimatedValue='false';element.classList.remove('is-ready');element.setAttribute('data-controller','property-showcase');
   });
   await page.waitForSelector('.property-showcase.is-ready');
   assert.equal(await page.locator('.showcase-slide').count(),20);
   const controls=await page.locator('.showcase-controls').boundingBox();
   assert.ok(controls.x>=0&&controls.x+controls.width<=width+1&&controls.height<=72,`bounded twenty-stay controls: ${JSON.stringify({width,controls})}`);
   assert.equal(await page.locator('.showcase-picker').evaluate(rail=>rail.scrollWidth>rail.clientWidth),true,'choices scroll horizontally without adding rows');
   await page.locator('.showcase-picker button[aria-pressed="true"]').focus();await page.keyboard.press('End');
   assert.equal(await active().getAttribute('data-slug'),'qa-stay-19');
   await page.waitForFunction(()=>{const item=document.querySelector('.showcase-picker [aria-pressed="true"]'),chip=item.getBoundingClientRect(),rail=item.parentElement.getBoundingClientRect();return chip.left>=rail.left-1&&chip.right<=rail.right+1;});
   const selection=await page.locator('.showcase-picker button[aria-pressed="true"]').evaluate(button=>{const item=button.getBoundingClientRect(),rail=button.parentElement.getBoundingClientRect();return{left:item.left,right:item.right,railLeft:rail.left,railRight:rail.right};});
   assert.ok(selection.left>=selection.railLeft-1&&selection.right<=selection.railRight+1,'active choice remains visible after keyboard selection');
   assert.equal(await page.locator('.showcase-picker button').evaluateAll(buttons=>buttons.filter(button=>button.tabIndex===0).length),1,'one tab stop in the choice rail');
   await page.keyboard.press('ArrowRight');assert.equal(await active().getAttribute('data-slug'),'qa-stay-0','twenty-stay carousel wraps');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  const noJs=await browser.newContext({javaScriptEnabled:false,...(process.env.ROAMING_BROWSER_STORAGE?{storageState:process.env.ROAMING_BROWSER_STORAGE}:{})});
  const noJsPage=await noJs.newPage();await noJsPage.goto(base+'/?_locale=fr');
  assert.equal(await noJsPage.locator('.showcase-card').count(),properties.length);
  assert.equal(await noJsPage.locator('.showcase-card a.showcase-book[href*="slug="]').count(),properties.length);
  await noJs.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: home/availability carousel arrows, keyboard and drag; bounded twenty-stay controls; property/dates/guests/search guide at 1440/390/320, capacities, 16 FR/EN light/dark layouts, reduced motion, cancellation, calendar failure and no-JS fallback. Provider calls simulated; no bookings.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
