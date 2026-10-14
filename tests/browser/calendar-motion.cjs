// Compare the real home reference to both shared calendars. Local mocked reads only.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const catalogue = require('../../config/guestlucky/catalogue.json').properties;
const now = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
const [year, month] = now.split('-').map(Number);
const date = d => new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10);
const target = name => `[data-calendar-target="${name}"]`;
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const context = await browser.newContext(); const page = await context.newPage();
    const errors = [], forbidden = []; page.on('pageerror', e => errors.push(e.message));
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname.endsWith('google.com') && url.pathname === '/maps') return route.fulfill({contentType: 'text/html',body:'<p>Local map placeholder</p>'});
        if (url.origin !== new URL(base).origin || route.request().method() !== 'GET' || url.pathname.startsWith('/reservation/')) { forbidden.push(url.pathname); return route.abort(); }
        if (url.pathname === '/api/availability') return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, availability: []})});
        if (url.pathname.startsWith('/api/')) {
            const y = Number(url.searchParams.get('year')), m = Number(url.searchParams.get('month'));
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, properties: catalogue.map(p => ({slug: p.slug, status: 'fresh', fetchedAt: new Date().toISOString(), days: Array.from({length: new Date(y,m,0).getDate()}, (_,i) => ({date: `${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`, available: true, minStay: 2, price: 100}))}))})});
        }
        if (route.request().isNavigationRequest()) {
            const response = await route.fetch();
            return route.fulfill({response, body: (await response.text()).replace(/data-calendar-published-value="(?:true|false)"/, 'data-calendar-published-value="true"').replace(/data-availability-enabled="(?:true|false)"/, 'data-availability-enabled="true"')});
        }
        return route.continue();
    });
    const motion = locator => locator.evaluate(e => {
        const s = getComputedStyle(e);
        return {animation: s.animationName, animationDuration: s.animationDuration, duration: s.transitionDuration, easing: s.transitionTimingFunction, transform: s.transform};
    });
    const colors = locator => locator.evaluate(e => {const s = getComputedStyle(e); return {background: s.backgroundColor, border: s.borderTopColor};});
    const stable = async (surface, action) => {
        const before = await surface.boundingBox(); await action();
        const after = await surface.boundingBox();
        assert.ok(Math.abs(after.height - before.height) < 1, 'selection must not shift the calendar');
        assert.ok(Math.abs(after.width - before.width) < 1);
    };
    try {
        let comparisons = 0;
        for (const locale of ['fr','en']) for (const theme of ['light','dark']) for (const width of [1440,390,320]) {
            await page.setViewportSize({width, height: width === 320 ? 568 : 900});
            await page.emulateMedia({reducedMotion:'no-preference'});
            await page.goto(base + '/?_locale=' + locale);
            await page.evaluate(t => localStorage.setItem('theme',t),theme);
            await page.reload(); await page.waitForFunction(() => !!document.querySelector('#date-range')._flatpickr);
            await page.locator('#date-display').click();
            await page.locator('.flatpickr-next-month').click();
            await page.waitForFunction(() => document.querySelector('#date-availability-status').dataset.state === 'fresh');
            const home = page.locator('#date-panel'), homeDay = d => page.locator(`.flatpickr-day[data-date="${date(d)}"]`);
            const reference = {surface: await motion(home), day: await motion(homeDay(5)), nav: await motion(page.locator('.flatpickr-next-month svg path'))};
            assert.equal(reference.day.duration, '0s'); assert.equal(reference.surface.animation, 'none');
            await homeDay(5).hover(); const hover = await colors(homeDay(5));
            await homeDay(5).focus(); const focus = await colors(homeDay(5));
            let preview;
            await stable(home, async () => {
                await homeDay(5).click(); await homeDay(7).hover();
                preview = {range: await colors(homeDay(6)), end: await colors(homeDay(7))};
                assert.equal(await page.locator('#departure-date').inputValue(),'');
                await homeDay(7).click();
            });
            const boundary = await colors(homeDay(5)), range = await colors(homeDay(6));
            if (locale === 'fr' && theme === 'light' && width !== 320) await page.screenshot({path:`var/motion-home-${width}.png`});
            await page.locator('#date-apply').click(); assert.equal(await home.evaluate(e => e.open),false);
            await page.locator('#date-display').click(); await page.locator('#date-cancel').click();
            assert.equal(await page.locator('#arrival-date').inputValue(),'');
            for (const kind of ['availability','property']) {
                await page.goto(base + (kind === 'property' ? '/property/lambersart' : '/disponibilites') + '?' + new URLSearchParams({_locale:locale,slug:'lambersart',guests:'2'}));
                await page.locator('[data-controller="calendar"]').scrollIntoViewIfNeeded();
                await page.waitForFunction(() => document.querySelector('[data-calendar-target="status"]').dataset.state === 'fresh');
                const popover = page.locator('.property-date-popover');
                if (kind === 'property') {
                    await page.locator('[data-date-part="arrival"]').click();
                    assert.deepEqual(await motion(popover),reference.surface,'same immediate opening as home');
                    assert.equal(await popover.evaluate(e => e.getAnimations().length),0);
                }
                await page.locator(target('next')).click();
                await page.waitForFunction(() => document.querySelector('[data-calendar-target="status"]').dataset.state === 'fresh' && !document.querySelector('[data-calendar-target="fields"]').disabled);
                assert.equal(await page.locator('.stay-month').count(),2);
                const day = d => page.locator(`.stay-day[data-date="${date(d)}"]`), board = page.locator(target('board'));
                assert.deepEqual(await motion(day(5)),reference.day);
                const navMotion = await motion(page.locator(target('next')));
                assert.equal(navMotion.duration,reference.nav.duration); assert.equal(navMotion.easing,reference.nav.easing);
                await day(5).hover(); assert.deepEqual(await colors(day(5)),hover,'same hover reaction');
                await day(5).focus(); assert.deepEqual(await colors(day(5)),focus,'same focus reaction');
                await stable(board,async () => {await day(5).click(); await day(7).hover();});
                assert.deepEqual(await colors(day(6)),preview.range,'same range hover preview');
                assert.deepEqual(await colors(day(7)),preview.end,'same provisional departure');
                assert.equal(await page.locator(target('departure')).inputValue(),'','preview does not select or request a quote');
                await page.mouse.move(2,2); assert.equal(await page.locator('.stay-preview-range, .stay-preview-end').count(),0);
                await day(7).click();
                assert.deepEqual(await colors(day(5)),boundary); assert.deepEqual(await colors(day(6)),range);
                assert.equal(await day(5).evaluate(e => e.getAnimations().length),0);
                if (locale === 'fr' && theme === 'light' && width !== 320) await page.screenshot({path:`var/motion-${kind}-${width}.png`});
                if (kind === 'property') {
                    await page.locator(target('applyDates')).click(); assert.equal(await popover.evaluate(e => e.open),false,'immediate closing');
                    await page.locator('[data-date-part="departure"]').click(); await page.keyboard.press('Escape');
                    assert.equal(await popover.evaluate(e => e.open),false);
                    assert.equal(await page.locator('[data-date-part="departure"]').evaluate(e => e === document.activeElement),true);
                } else assert.ok(await page.locator('.stay-night-price').count() > 0,'extended prices preserved');
                await page.locator(target('clear')).click();
                assert.equal(await page.locator(target('arrival')).inputValue(),'');
                assert.equal(await page.locator('.stay-selected').count(),0);
                await page.emulateMedia({reducedMotion:'reduce'});
                assert.equal((await motion(page.locator(target('next')))).duration,'0s');
                if (kind === 'property') {await page.locator('[data-date-part="arrival"]').click(); assert.equal(await popover.evaluate(e => e.getAnimations().length),0); await page.keyboard.press('Escape');}
                await page.emulateMedia({reducedMotion:'no-preference'});
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
                comparisons++;
            }
        }
        assert.deepEqual(errors,[]); assert.deepEqual(forbidden,[]);
        console.log(`PASS calendar motion: ${comparisons} comparisons with live home reference; desktop/mobile FR/EN/light/dark, open/close/range/clear/month/hover/focus/reduced motion, two months, local screenshots; zero provider traffic.`);
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
