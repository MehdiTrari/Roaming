const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const catalogue = require('../../config/guestlucky/catalogue.json').properties;
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const [year, month] = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date()).split('-').map(Number);
const date = day => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
const stay = {arrivalDate: date(5), departureDate: date(7), guests: '2'};
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const context = await browser.newContext(); const page = await context.newPage();
    let mode = 'adjacent', publication = true, quoteCalls = 0;
    const calendars = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin || route.request().method() !== 'GET') return route.abort();
        if (url.pathname.startsWith('/reservation/')) return route.fulfill({contentType: 'text/html', body: '<p>Mock booking module; no booking</p>'});
        if (url.pathname === '/' && route.request().isNavigationRequest()) {
            const response = await route.fetch();
            return route.fulfill({response, body: (await response.text()).replace(/data-availability-enabled="(?:true|false)"/, `data-availability-enabled="${publication}"`)});
        }
        if (url.pathname === '/api/availability') {
            quoteCalls++;
            const property = catalogue.find(p => p.slug === url.searchParams.get('slug')) || catalogue[0];
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, availability: [{slug: property.slug, name: property.name, maxGuests: property.capacity, status: 'available', available: true, price: 400, nights: 2, currency: 'EUR', fees: {}, bookingUrl: '/reservation/' + property.slug + '?' + new URLSearchParams(stay), detailsUrl: '/property/' + property.slug}]})});
        }
        if (url.pathname.startsWith('/api/')) {
            calendars.push(url);
            if (mode === 'error') return route.fulfill({status: 500, body: '{}'});
            const y = Number(url.searchParams.get('year')), m = Number(url.searchParams.get('month'));
            const properties = catalogue.map((p, i) => ({slug: p.slug, status: mode === 'partial' && i === 2 ? 'unverified' : 'fresh', fetchedAt: new Date().toISOString(), days: Array.from({length: new Date(y, m, 0).getDate()}, (_, n) => {
                const value = `${y}-${String(m).padStart(2, '0')}-${String(n + 1).padStart(2, '0')}`;
                let available = true;
                if (mode === 'blocked') available = false;
                if (mode === 'partial') available = i === 0 && value === date(5);
                if (mode === 'split') available = (i === 0 && value === date(5)) || (i === 1 && value === date(6));
                if (mode === 'adjacent') available = value !== date(7);
                return {date: value, available, minStay: mode === 'minimum' ? 3 : 2, price: 100};
            })}));
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: mode !== 'closed', properties})});
        }
        return route.continue();
    });
    const home = async (criteria = {arrivalDate: date(5), guests: '2'}, locale = 'fr') => {
        await page.goto(base + '/?' + new URLSearchParams({...criteria, _locale: locale}));
        await page.waitForFunction(() => !!document.querySelector('#date-range')._flatpickr);
    };
    const open = async () => { await page.locator('#date-display').click(); await page.waitForFunction(() => document.querySelector('#date-availability-status').dataset.state !== 'loading'); };
    const day = value => page.locator(`#date-calendar .flatpickr-day[data-date="${value}"]`);
    const clear = async () => { await page.locator('#date-cancel').click(); await open(); };
    const search = async () => { await page.locator('#booking-search-form [type="submit"]').click(); await page.waitForFunction(() => document.querySelector('#booking-search-form').getAttribute('aria-busy') === 'false'); };
    try {
        mode = 'blocked'; await home(); await open();
        assert.equal(await day(date(5)).evaluate(e => e.classList.contains('stay-closed') && e.classList.contains('flatpickr-disabled')), true);
        mode = 'partial'; await home(); await open();
        assert.equal(await day(date(5)).evaluate(e => e.classList.contains('stay-open') && !e.classList.contains('flatpickr-disabled')), true);
        assert.match(await day(date(6)).getAttribute('aria-label'), /Non vérifié/);
        mode = 'split'; await home(stay); const before = quoteCalls; await search();
        assert.equal(quoteCalls, before, 'split-property stay must never reach quote/booking');
        assert.match(await page.locator('#results-list').innerText(), /indisponible/);
        mode = 'minimum'; await home({slug: catalogue[0].slug, guests: '2', arrivalDate: date(5)}); await open();
        await clear(); await day(date(5)).click(); await day(date(7)).click();
        assert.equal(await page.locator('#departure-date').inputValue(), '');
        assert.match(await page.locator('#date-availability-status').innerText(), /minimum/);
        await page.keyboard.press('Escape');
        mode = 'adjacent';
        for (const locale of ['fr', 'en']) for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
            await page.setViewportSize({width, height: width === 320 ? 568 : 900});
            await home({slug: catalogue[0].slug, guests: '2', arrivalDate: date(5)}, locale);
            await page.evaluate(value => localStorage.setItem('theme', value), theme); await page.reload();
            await open(); await clear();
            const count = calendars.length;
            await day(date(5)).focus(); await page.keyboard.press('Enter');
            assert.equal(await page.locator('#arrival-date').inputValue(), date(5));
            assert.equal(await day(date(7)).evaluate(e => e.classList.contains('stay-checkout-only')), true);
            assert.match(await day(date(7)).getAttribute('aria-label'), locale === 'fr' ? /Départ uniquement/ : /Check-out only/);
            assert.equal(await day(date(6)).evaluate(e => e.classList.contains('stay-checkout-only')), false);
            await day(date(7)).focus(); await page.keyboard.press('Enter');
            assert.equal(await page.locator('#departure-date').inputValue(), date(7));
            assert.equal(await page.locator('#date-apply').isEnabled(), true);
            assert.equal(calendars.length, count, 'day focus/selection must not issue requests');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert.equal(await page.locator('#date-panel').evaluate(e => e.scrollWidth <= e.clientWidth), true);
            await page.locator('#date-apply').click(); await search(); await page.waitForSelector('.booking-quote-card');
            await page.locator('.booking-module-actions button').click(); await page.waitForSelector('.booking-modal[open]');
            await page.evaluate(slug => { const property = document.querySelector('#booking-property'); property.value = slug; property.dispatchEvent(new Event('change')); }, catalogue[1].slug);
            assert.equal(await page.locator('#arrival-date').inputValue(), ''); assert.equal(await page.locator('#departure-date').inputValue(), '');
            assert.equal(await page.locator('.booking-modal, .booking-quote-card, iframe').count(), 0);
            assert.equal(await page.locator('#guests-count').inputValue(), '2');
            await open(); assert.equal(await page.locator('#date-cancel').isDisabled(), true);
            await page.keyboard.press('Escape');
        }
        mode = 'open';
        const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
        const cross = {...stay, slug: catalogue[0].slug, arrivalDate: end, departureDate: new Date(Date.UTC(year, month + 1, 2)).toISOString().slice(0, 10)};
        await home(cross); await open(); await clear();
        await day(end).click(); await page.locator('.flatpickr-next-month').click();
        await page.waitForFunction(() => document.querySelector('#date-availability-status').dataset.state === 'fresh');
        await day(cross.departureDate).click(); assert.equal(await page.locator('#departure-date').inputValue(), cross.departureDate);
        await page.locator('#date-cancel').click();
        assert.equal(await page.locator('#booking-property').inputValue(), catalogue[0].slug); assert.equal(await page.locator('#guests-count').inputValue(), '2');
        mode = 'error'; await home(); await open();
        assert.match(await page.locator('#date-availability-status').innerText(), /impossible/); assert.equal(await page.locator('#date-calendar-contact').isVisible(), true);
        publication = false; const closedCount = calendars.length, closedQuotes = quoteCalls;
        await home(stay); await open(); assert.equal(await page.locator('#date-apply').isDisabled(), true);
        assert.match(await page.locator('#date-availability-status').innerText(), /fermée/);
        await page.keyboard.press('Escape'); await search();
        assert.equal(calendars.length, closedCount); assert.equal(quoteCalls, closedQuotes);
        assert.equal(await page.locator('.booking-module-actions').count(), 0);
        assert.ok(await page.locator('#results-list a[href^="/contact-us"]').count());
        assert.deepEqual(errors, []);
        console.log('PASS lot B: global unavailable/candidate/partial/unknown, split-property rejection, minStay, checkout-only via keyboard, cross-month, clear/property/iframe invalidation, cache/no hover requests, provider error, closed publication (zero API reads), 12 FR/EN/light/dark 1440/390/320 layouts. All provider responses mocked.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
