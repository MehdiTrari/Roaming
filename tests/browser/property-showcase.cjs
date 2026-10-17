// Local UI checks: all provider/API calls are simulated; no bookings or writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.ROAMING_BROWSER_URL||'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const context=await browser.newContext(process.env.ROAMING_BROWSER_STORAGE?{storageState:process.env.ROAMING_BROWSER_STORAGE}:{});
  const page=await context.newPage();
  const errors=[],calls=[]; let properties=[],offline=false;
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==base||url.pathname.startsWith('/reservation/'))return route.abort();
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
  const choose=async slug=>{
   await page.locator(`.showcase-slide[data-slug="${slug}"]`).evaluate(slide=>{
    const index=[...slide.parentElement.children].indexOf(slide);
    slide.closest('.property-showcase').querySelector(`.showcase-picker button[data-index="${index}"]`).click();
   });
  };
  await page.goto(base+'/?_locale=fr'); await fresh();
  properties=await page.locator('#booking-property option[value]:not([value=""])').evaluateAll(options=>options.map(o=>({slug:o.value,name:o.textContent,city:o.textContent,maxGuests:Number(o.dataset.capacity)})));
  assert.equal(await page.locator('.showcase-slide').count(),properties.length);
  const photoSlug=await active().getAttribute('data-slug');
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
  const box=await active().boundingBox(),media=await active().locator('.showcase-card-media').boundingBox();
  await page.mouse.move(box.x+box.width*.65,media.y+media.height*.5);
  await page.mouse.down(); await page.mouse.move(box.x+box.width*.25,media.y+media.height*.5,{steps:8}); await page.mouse.up();
  assert.notEqual(await active().getAttribute('data-slug'),photoSlug,'drag must select another property');
  assert.equal(new URL(page.url()).pathname,'/');
  for(const entry of ['carousel','property'])for(const width of [1440,390,320]) {
   const locale=width===390?'en':'fr';
   await page.setViewportSize({width,height:width===320?700:1000});
   await page.goto(base+'/?_locale='+locale+'&guests=2'); await fresh();
   await choose(photoSlug);
   const before=calls.length;
   assert.deepEqual(await page.locator('#booking-search-form > .booking-field-horizontal').evaluateAll(fields=>fields.map(field=>field.id)),['property-toggle','date-toggle','guests-toggle'],'field order matches visual and keyboard progression');
   if(entry==='carousel')await active().locator('.showcase-book').click();
   else {
    await page.locator('#property-display').click();
    assert.equal(await page.locator('#booking-guide [aria-current="step"]').getAttribute('data-guide-step'),'1');
    assert.equal(await page.locator('#property-panel').evaluate(panel=>panel.contains(document.activeElement)),true);
    assert.equal(await page.locator('#property-panel [data-guide-hint="property"]').isVisible(),true);
    assert.equal(calls.length,before,'opening properties does not query availability');
    await page.locator(`[data-property-option="${photoSlug}"]`).click();
   }
   await page.waitForSelector('#date-panel[open]');
   assert.equal(await page.locator('#booking-property').inputValue(),photoSlug);
   assert.equal(await page.locator('#property-display').innerText(),await page.locator('#property-display-text').innerText(),'no stray v after the selected property');
   assert.equal(new URL(page.url()).searchParams.get('slug'),photoSlug);
   assert.equal(await page.locator('#arrival-date').inputValue(),'');
   assert.equal(await page.locator('#booking-guide [aria-current="step"]').getAttribute('data-guide-step'),'2');
   assert.equal(await page.locator('#booking-guide [data-guide-step="1"]').evaluate(item=>item.classList.contains('is-done')),true);
   await page.waitForFunction(()=>document.getElementById('date-availability-status').dataset.state==='fresh');
   assert.ok(calls.slice(before).every(url=>url.pathname==='/api/properties/'+photoSlug+'/availability'));
   const dates=await page.evaluate(()=>{
    const format=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
    const start=new Date();start.setDate(start.getDate()+3);const end=new Date(start);end.setDate(end.getDate()+2);return[format(start),format(end)];
   });
   await page.locator(`#date-panel .flatpickr-day[data-date="${dates[0]}"]`).click();
   await page.locator(`#date-panel .flatpickr-day[data-date="${dates[1]}"]`).click();
   await page.locator('#date-apply').click();
   await page.waitForSelector('#guests-panel[open]');
   assert.equal(await page.locator('#date-panel').isVisible(),false);
   assert.equal(await page.locator('#booking-guide [aria-current="step"]').getAttribute('data-guide-step'),'3');
   await page.locator('#guests-increase').click();
   const quotesBefore=calls.filter(url=>url.pathname==='/api/availability').length;
   if(width===390)await page.mouse.click(4,500);
   else if(width===320)await page.locator('#guests-panel .search-popover-close').click();
   else await page.locator('#guests-apply').click();
   assert.equal(await page.locator('#guests-panel').isVisible(),false);
   assert.equal(await page.locator('#booking-guide [aria-current="step"]').getAttribute('data-guide-step'),'4');
   assert.equal(await page.locator('.booking-submit').evaluate(e=>e===document.activeElement),true);
   assert.equal(await page.locator('#booking-guide-search, .booking-guide-search-arrow').count(),0,'no message or arrow under the search button');
   assert.equal(await page.locator('.booking-search-spotlight').count(),1);
   assert.equal(await page.locator('.booking-search-spotlight').getAttribute('aria-hidden'),'true');
   assert.equal(await page.locator('.booking-submit').getAttribute('aria-describedby'),null);
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.booking-submit')).boxShadow==='none');
   assert.equal(await page.locator('.booking-submit').evaluate(e=>getComputedStyle(e).boxShadow),'none','no animated ring or underlay around the button');
   await page.waitForFunction(()=>{
    const button=document.querySelector('.booking-submit').getBoundingClientRect(),spotlight=document.querySelector('.booking-search-spotlight').getBoundingClientRect();
    return button.top>=0&&button.bottom<=innerHeight&&Math.abs(spotlight.left-button.left)<1&&Math.abs(spotlight.top-button.top)<1;
   });
   const pulse=await page.locator('.booking-submit').evaluate(button=>{
    const cover=document.querySelector('.booking-search-spotlight');
    const animations=[...button.getAnimations(),...cover.getAnimations()].filter(animation=>animation.effect.getTiming().iterations===Infinity);
    animations.forEach(animation=>animation.pause());
    const duration=animations[0].effect.getTiming().duration,frames=[];
    for(const time of [0,duration/2,duration]){
     animations.forEach(animation=>animation.currentTime=time);
     const b=button.getBoundingClientRect(),h=cover.getBoundingClientRect();
     frames.push({width:b.width,height:b.height,pageHeight:document.documentElement.scrollHeight,error:Math.max(Math.abs(b.left-h.left),Math.abs(b.top-h.top),Math.abs(b.width-h.width),Math.abs(b.height-h.height))});
    }
    const start=document.timeline.currentTime;
    animations.forEach(animation=>{animation.play();animation.startTime=start;});
    return frames;
   });
   assert.ok(pulse[1].width>pulse[0].width*1.05&&pulse[1].height>pulse[0].height*1.05,'the actual button visibly grows');
   assert.ok(Math.abs(pulse[2].width-pulse[0].width)<1,'the button smoothly returns to its original size');
   assert.ok(pulse.every(frame=>frame.error<1),'shade opening follows every sampled animation phase without a surrounding ring');
   assert.ok(pulse.every(frame=>frame.pageHeight===pulse[0].pageHeight),'scaling does not move the page layout');
   const spotlightState=await page.locator('.booking-submit').evaluate(button=>{
    const rect=button.getBoundingClientRect(),cover=document.querySelector('.booking-search-spotlight');
    return {clickable:button.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)),animation:button.getAnimations().some(animation=>animation.playState==='running'),shade:getComputedStyle(cover).boxShadow};
   });
   assert.equal(spotlightState.clickable,true,'the genuine search button remains clickable through the spotlight');
   assert.equal(spotlightState.animation,true);
   assert.match(spotlightState.shade,/0\.56/,'the rest of the viewport is shaded');
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await page.locator('.booking-submit').evaluate(e=>e.getAnimations().some(animation=>animation.playState==='running')),true,'the requested button pulse also works with the user’s Windows setting');
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>window.scrollBy({top:16,behavior:'instant'}));
   await page.waitForFunction(()=>Math.abs(document.querySelector('.booking-search-spotlight').getBoundingClientRect().top-document.querySelector('.booking-submit').getBoundingClientRect().top)<1);
   assert.equal(calls.filter(url=>url.pathname==='/api/availability').length,quotesBefore,'guidance never launches the search automatically');
   if([1440,390].includes(width))await page.screenshot({path:`var/guide-search-step-${width}.png`});
   if(width===320)await page.keyboard.press('Enter');
   else{
    const target=await page.locator('.booking-submit').boundingBox();
    await page.mouse.move(target.x+target.width/2,target.y+target.height/2);
    await page.waitForFunction(()=>document.querySelector('.booking-submit').getAnimations().every(animation=>animation.playState==='paused'));
    await page.locator('.booking-submit').click();
   }
   await page.waitForSelector('.booking-quote-card');
   assert.equal(await page.locator('#booking-guide').isVisible(),false);
   assert.equal(await page.locator('.booking-search-spotlight').count(),0,'search removes the shade');
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
   assert.equal(await page.locator('.showcase-slide.is-active').count(),1);
   assert.equal(await page.locator('.showcase-slide:not(.is-active) [data-showcase-card]').evaluateAll(cards=>cards.every(card=>card.inert)),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const card=await active().boundingBox();assert.ok(card.x>=0&&card.x+card.width<=width,JSON.stringify({locale,theme,width,card}));
   if(locale==='fr'&&theme==='light'&&[1440,390].includes(width))await page.screenshot({path:`var/showcase-${width}.png`,fullPage:false});
  }
  // The shade must never survive dismissal or navigation away from the guide.
  for(const dismissal of ['escape','outside','focus','turbo']){
   await page.goto(base+'/?_locale=fr');await fresh();
   await page.evaluate(value=>document.documentElement.dataset.bsTheme=value,dismissal==='outside'?'dark':'light');
   await page.evaluate(slug=>document.dispatchEvent(new CustomEvent('booking:guide',{detail:{slug},cancelable:true})),photoSlug);
   await page.waitForSelector('#date-panel[open]');
   await page.waitForFunction(()=>document.getElementById('date-availability-status').dataset.state==='fresh');
   const dates=await page.evaluate(()=>{
    const start=new Date();start.setDate(start.getDate()+3);const end=new Date(start);end.setDate(end.getDate()+2);
    return [start,end].map(d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(d));
   });
   await page.locator(`#date-panel .flatpickr-day[data-date="${dates[0]}"]`).click();
   await page.locator(`#date-panel .flatpickr-day[data-date="${dates[1]}"]`).click();
   await page.locator('#date-apply').click();await page.locator('#guests-apply').click();
   assert.equal(await page.locator('.booking-search-spotlight').count(),1);
   await page.setViewportSize({width:390,height:844});
   await page.waitForFunction(()=>{
    const hole=document.querySelector('.booking-search-spotlight').getBoundingClientRect(),button=document.querySelector('.booking-submit').getBoundingClientRect();
    return Math.abs(hole.width-button.width)<1&&Math.abs(hole.left-button.left)<1;
   });
   if(dismissal==='escape')await page.keyboard.press('Escape');
   if(dismissal==='outside')await page.locator('#featured h2').click();
   if(dismissal==='focus')await page.locator('#date-display').focus();
   if(dismissal==='turbo'){await page.evaluate(()=>window.Turbo.visit('/contact-us'));await page.waitForURL('**/contact-us*');}
   assert.equal(await page.locator('.booking-search-spotlight').count(),0,`${dismissal} removes the shade`);
   if(dismissal!=='turbo')assert.equal(await page.locator('.booking-submit').evaluate(button=>button.getAnimations().some(animation=>animation.effect.getTiming().iterations===Infinity)),false,'the invitation animation is cancelled');
  }
  await page.goto(base+'/?_locale=fr');await fresh();
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await active().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  await choose(photoSlug);await active().locator('.showcase-book').click();await page.waitForSelector('#date-panel[open]');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#booking-guide').isVisible(),false);
  assert.equal(await page.locator('#date-display').evaluate(e=>e===document.activeElement),true);
  offline=true;
  await page.evaluate(slug=>document.dispatchEvent(new CustomEvent('booking:guide',{detail:{slug},cancelable:true})),photoSlug);
  await page.waitForSelector('#date-panel[open]');
  await page.waitForFunction(()=>document.getElementById('date-availability-status').dataset.state==='unverified');
  assert.equal(await page.locator('#date-apply').isDisabled(),true);
  await page.keyboard.press('Escape');
  const noJs=await browser.newContext({javaScriptEnabled:false,...(process.env.ROAMING_BROWSER_STORAGE?{storageState:process.env.ROAMING_BROWSER_STORAGE}:{})});
  const noJsPage=await noJs.newPage();await noJsPage.goto(base+'/?_locale=fr');
  assert.equal(await noJsPage.locator('.showcase-card').count(),properties.length);
  assert.equal(await noJsPage.locator('.showcase-card a.showcase-book[href*="slug="]').count(),properties.length);
  await noJs.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: carousel navigation and motion, automatic property/dates/guests/search guide and carousel entry at 1440/390/320, same/all property confirmation, capacities, 16 FR/EN light/dark layouts, reduced motion, cancellation, calendar failure and no-JS fallback. Provider calls simulated; no bookings.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
