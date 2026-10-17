// Delayed/mock calendar reads only. Never contact the provider or create bookings.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
const [year, month] = today.split('-').map(Number);
const date = day => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
const deferred = () => { let resolve; const promise = new Promise(done => resolve = done); return {promise, resolve}; };
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const context = await browser.newContext(process.env.ROAMING_BROWSER_STORAGE ? {storageState: process.env.ROAMING_BROWSER_STORAGE} : {});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let gate = deferred(), failure = false, slugs = [], requests = 0;
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== base || route.request().method() !== 'GET' || url.pathname.startsWith('/reservation/')) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (url.pathname === '/api/availability') return route.fulfill({contentType: 'application/json', body: '{"enabled":true,"availability":[]}'});
        const reject = failure; requests++; await gate.promise;
        if (reject) return route.fulfill({status: 500, body: '{}'});
        const y = Number(url.searchParams.get('year')), m = Number(url.searchParams.get('month'));
        return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, properties: slugs.map(slug => ({slug, status: 'fresh', fetchedAt: new Date().toISOString(), days: Array.from({length: new Date(y, m, 0).getDate()}, (_, i) => ({date: new Date(Date.UTC(y, m - 1, i + 1)).toISOString().slice(0, 10), available: true, price: 100, minStay: 2}))}))})});
    });
    const home = async (locale = 'fr') => {
        await page.goto(base + '/?' + new URLSearchParams({_locale: locale, slug: 'lambersart', arrivalDate: date(5), departureDate: date(7), guests: '2'}));
        await page.waitForFunction(() => !!document.querySelector('#date-range')?._flatpickr);
        await page.locator('#date-display').click();
        await page.locator('#date-calendar-surface.is-checking .calendar-fetch-loader').waitFor({state: 'visible'});
    };
    const ready = () => page.waitForFunction(() => document.querySelector('#date-availability-status').dataset.state === 'fresh' && !document.querySelector('#date-calendar-surface').classList.contains('is-checking'));
    try {
        await page.goto(base + '/');
        slugs = await page.locator('#booking-property option:not([value=""])').evaluateAll(options => options.map(option => option.value));
        let layouts = 0;
        for (const locale of ['fr', 'en']) for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
            await page.setViewportSize({width, height: width === 320 ? 568 : 900});
            await page.goto(base + '/?_locale=' + locale);
            await page.evaluate(value => localStorage.setItem('theme', value), theme);
            gate = deferred(); await home(locale);
            const surface = page.locator('#date-calendar-surface'), loader = surface.locator('.calendar-fetch-loader');
            assert.equal(await surface.getAttribute('aria-busy'), 'true');
            assert.match(await loader.innerText(), locale === 'fr' ? /Vérification des disponibilités/ : /Checking available dates/);
            assert.equal(await page.locator('#date-calendar .flatpickr-days').isVisible(), false, 'no provisional dates or question marks while checking');
            assert.equal(await page.locator('#date-calendar .flatpickr-days').evaluate(e => e.inert), true);
            assert.equal(await page.locator('#date-apply').isDisabled(), true);
            assert.equal(await page.locator('#date-panel [data-search-dismiss]').isEnabled(), true, 'the user can always close the calendar');
            const before = await surface.boundingBox();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            const card = await loader.locator('.calendar-fetch-card').boundingBox();
            assert.ok(card.x >= before.x && card.x + card.width <= before.x + before.width + 1, 'loader fits small screens');
            if (locale === 'fr' && [1440, 390].includes(width)) await page.screenshot({path: `var/calendar-loading-${theme}-${width}.png`});
            await page.emulateMedia({reducedMotion: 'reduce'});
            assert.equal(await loader.locator('.calendar-fetch-track > span').evaluate(e => getComputedStyle(e).animationName), 'none');
            await page.emulateMedia({reducedMotion: 'no-preference'});
            gate.resolve(); await ready();
            assert.equal(await loader.isVisible(), false);
            assert.equal(await page.locator('#date-calendar .flatpickr-days').isVisible(), true);
            assert.equal(await page.locator('#date-calendar .flatpickr-days').evaluate(e => e.inert), false);
            assert.equal(await page.locator('#date-apply').isEnabled(), true);
            assert.ok(Math.abs((await surface.boundingBox()).height - before.height) < 1, 'loading preserves the calendar height');
            await page.locator('#date-cancel').click(); await page.locator('#date-display').click(); await ready();
            const count = requests;
            await page.keyboard.press('Escape'); await page.locator('#date-display').click(); await ready();
            assert.equal(requests, count, 'fresh cached months do not wait for another network request');
            await page.keyboard.press('Escape'); layouts++;
        }
        // Changing month quickly must not let an old request clear the new loader.
        gate = deferred(); await home();
        const old = gate; gate = deferred();
        await page.locator('.flatpickr-next-month').click(); old.resolve();
        assert.equal(await page.locator('#date-calendar-surface').getAttribute('aria-busy'), 'true');
        gate.resolve(); await ready();
        // Real errors remain distinct from checking; reopening can retry.
        failure = true; gate = deferred();
        await home(); gate.resolve();
        await page.waitForFunction(() => document.querySelector('#date-availability-status').dataset.state === 'unverified');
        assert.equal(await page.locator('#date-calendar-surface .calendar-fetch-loader').isVisible(), false);
        assert.equal(await page.locator('#date-calendar-contact').isVisible(), true);
        failure = false; await page.keyboard.press('Escape'); await page.locator('#date-display').click(); await ready();
        // Both shared calendars use the same component and keep dates inert.
        for (const path of ['/property/lambersart', '/disponibilites']) {
            gate = deferred();
            await page.goto(base + path + '?' + new URLSearchParams({slug: 'lambersart', arrivalDate: date(5), departureDate: date(7), guests: '2'}));
            await page.locator('[data-controller="calendar"]').scrollIntoViewIfNeeded();
            if (path.startsWith('/property/')) await page.locator('[data-date-part="arrival"]').click();
            const surface = page.locator('[data-calendar-target="calendarSurface"]');
            await surface.locator('.calendar-fetch-loader').waitFor({state: 'visible'});
            assert.equal(await page.locator('[data-calendar-target="board"]').evaluate(e => e.inert), true);
            gate.resolve();
            await page.waitForFunction(() => document.querySelector('[data-calendar-target="status"]').dataset.state === 'fresh');
            assert.equal(await surface.locator('.calendar-fetch-loader').isVisible(), false);
            assert.equal(await page.locator('[data-calendar-target="board"]').evaluate(e => e.inert), false);
        }
        gate = deferred(); await home();
        await page.evaluate(() => window.Turbo.visit('/contact-us'));
        await page.waitForURL('**/contact-us*'); gate.resolve();
        await page.waitForTimeout(100);
        assert.equal(await page.locator('dialog[open], .calendar-fetch-loader').count(), 0, 'navigation during a read removes the pending surface');
        assert.deepEqual(errors, []);
        console.log(`PASS calendar loading: ${layouts} FR/EN light/dark 1440/390/320 layouts, reserved height, hidden provisional dates, inert dates, cache, cancellation, month changes, errors/retry, reduced motion, home/property/availability. All API responses mocked.`);
    } finally { gate.resolve(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
