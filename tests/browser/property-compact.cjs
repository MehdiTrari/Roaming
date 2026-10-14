const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const catalogue = require('../../config/guestlucky/catalogue.json').properties;
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const [year, month] = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date()).split('-').map(Number);
const date = day => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
const target = name => `[data-calendar-target="${name}"]`;
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const context = await browser.newContext(); const page = await context.newPage();
    let mode = 'open', published = true, calendarCalls = 0, quoteCalls = 0;
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin || route.request().method() !== 'GET') return route.abort();
        if (url.pathname.startsWith('/reservation/')) return route.fulfill({contentType: 'text/html', body: '<p>Mock only; no booking.</p>'});
        if (url.pathname.startsWith('/property/') && route.request().isNavigationRequest()) {
            const response = await route.fetch();
            return route.fulfill({response, body: (await response.text()).replace(/data-calendar-published-value="(?:true|false)"/, `data-calendar-published-value="${published}"`)});
        }
        if (url.pathname === '/api/availability') {
            quoteCalls++; const slug = url.searchParams.get('slug'), property = catalogue.find(p => p.slug === slug);
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, availability: [{slug, name: property.name, maxGuests: property.capacity, status: 'available', available: true, price: 400, nights: 2, currency: 'EUR', fees: {cleaning_fee: 50}, detailsUrl: '/property/' + slug, bookingUrl: '/reservation/' + slug + '?' + url.searchParams}]})});
        }
        if (url.pathname.startsWith('/api/')) {
            calendarCalls++; if (mode === 'error') return route.fulfill({status: 500, body: '{}'});
            const y = Number(url.searchParams.get('year')), m = Number(url.searchParams.get('month'));
            const properties = catalogue.map(p => ({slug: p.slug, status: mode === 'unknown' ? 'unverified' : 'fresh', fetchedAt: new Date().toISOString(), days: Array.from({length: new Date(y, m, 0).getDate()}, (_, i) => ({date: `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, available: mode !== 'adjacent' || `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}` !== date(7), minStay: 2, price: 100}))}));
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: mode !== 'closed', properties})});
        }
        return route.continue();
    });
    const visit = async (slug = catalogue[0].slug, criteria = {}, locale = 'fr') => {
        await page.goto(base + '/property/' + slug + '?' + new URLSearchParams({_locale: locale, ...criteria}));
        await page.locator('.property-booking-compact').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => Boolean(document.querySelector('[data-calendar-target="status"]').dataset.state) && document.querySelector('[data-calendar-target="status"]').dataset.state !== 'loading' || !document.querySelector('[data-calendar-target="notice"]').hidden);
    };
    const trigger = part => page.locator(`[data-date-part="${part}"]`);
    const day = value => page.locator(`.property-date-popover [data-date="${value}"]`);
    const bounded = async () => {
        const box = await page.locator('.property-date-popover').boundingBox(), size = page.viewportSize();
        assert.ok(box && box.x >= 10 && box.y >= 10 && box.x + box.width <= size.width - 10 && box.y + box.height <= size.height - 10, JSON.stringify(box));
        assert.equal(await page.locator('.property-date-popover').evaluate(e => e.scrollWidth > e.clientWidth), false);
    };
    const quote = async () => { await page.locator(target('submit')).click(); await page.waitForSelector('.booking-quote-card'); };
    const closed = () => page.waitForFunction(() => !document.querySelector('.property-date-popover').open);
    try {
        let layouts = 0;
        for (const locale of ['fr', 'en']) for (const theme of ['light', 'dark']) for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({width, height: width === 320 ? 568 : 900});
            await visit(); await page.evaluate(value => localStorage.setItem('theme', value), theme);
            await visit(catalogue[layouts % 3].slug, {arrivalDate: date(5), departureDate: date(7), guests: '2'}, locale);
            assert.equal(await page.locator('.property-date-popover').isVisible(), false);
            assert.equal(await page.locator('.stay-month').count(), 2);
            assert.equal(await page.locator(target('guests') + ' option').count(), catalogue[layouts % 3].capacity);
            assert.equal(await page.locator('.guestlucky-booking-frame, .booking-total').count(), 0);
            assert.ok((await page.locator('.property-booking-compact').boundingBox()).height < 600, 'compact panel before quote');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            const before = await page.locator('.property-booking-compact').boundingBox();
            if (process.env.ROAMING_BROWSER_SCREENSHOTS === '1' && locale === 'fr' && theme === 'light' && [1440, 390].includes(width)) await page.screenshot({path: `var/lot-c-panel-${width}.png`});
            await trigger('arrival').click(); await bounded();
            await page.waitForTimeout(180);
            if (process.env.ROAMING_BROWSER_SCREENSHOTS === '1' && locale === 'fr' && theme === 'light' && [1440, 390].includes(width)) await page.screenshot({path: `var/lot-c-calendar-${width}.png`});
            assert.equal((await page.locator('.property-booking-compact').boundingBox()).height, before.height, 'opening causes no layout shift');
            await page.keyboard.press('Escape'); await closed(); assert.equal(await trigger('arrival').evaluate(e => e === document.activeElement), true);
            await trigger('departure').click(); await page.mouse.click(2, 2);
            await closed();
            assert.equal(await page.locator('.property-date-popover').isVisible(), false);
            assert.equal(await trigger('departure').evaluate(e => e === document.activeElement), true);
            await trigger('arrival').click(); await day(date(6)).focus(); await page.keyboard.press('Enter');
            assert.equal(await page.locator(target('arrival')).inputValue(), date(6)); assert.equal(await page.locator(target('departure')).inputValue(), '');
            assert.equal(await day(date(7)).isDisabled(), true, 'minimum stay');
            await day(date(8)).click(); assert.equal(await page.locator(target('departure')).inputValue(), date(8));
            await page.locator(target('applyDates')).click(); await closed(); assert.equal(await trigger('arrival').evaluate(e => e === document.activeElement), true);
            assert.equal(await page.locator('.property-date-popover').isVisible(), false);
            await quote(); assert.match(await page.locator('.booking-total').innerText(), /400/);
            await page.locator(target('guests')).selectOption('3'); assert.equal(await page.locator('.booking-quote-card').count(), 0);
            await quote(); await page.locator('.booking-module-actions button').click(); await page.waitForSelector('.booking-modal[open]');
            await page.evaluate(() => document.querySelector('[data-calendar-target="clear"]').click());
            assert.equal(await page.locator('.booking-modal, .guestlucky-booking-frame, .booking-quote-card').count(), 0);
            assert.equal(await page.locator(target('arrival')).inputValue(), ''); assert.equal(await page.locator(target('departure')).inputValue(), '');
            assert.equal(await page.locator(target('guests')).inputValue(), '3'); assert.equal(await page.locator(target('clear')).isDisabled(), true);
            assert.equal(await trigger('arrival').evaluate(e => e === document.activeElement), true);
            layouts++;
        }
        mode = 'adjacent'; await visit(catalogue[0].slug, {arrivalDate: date(5)});
        await trigger('departure').click(); assert.equal(await day(date(7)).isDisabled(), false);
        assert.match(await day(date(7)).getAttribute('aria-label'), /Départ uniquement/);
        assert.equal(await day(date(8)).isDisabled(), true, 'cannot cross occupied night');
        await day(date(7)).click(); await page.locator(target('applyDates')).click(); await quote();
        mode = 'open'; const last = date(new Date(Date.UTC(year, month + 1, 0)).getUTCDate()), end = new Date(Date.UTC(year, month + 1, 2)).toISOString().slice(0, 10);
        await visit(catalogue[0].slug, {arrivalDate: last}); await trigger('departure').click();
        await page.locator(target('next')).click(); await page.waitForFunction(() => !document.querySelector('[data-calendar-target="fields"]').disabled);
        await day(end).click(); assert.equal(await page.locator(target('departure')).inputValue(), end);
        await page.locator(target('applyDates')).click(); await quote();
        await trigger('departure').click();
        await page.evaluate(() => window.Turbo.visit('/contact-us'));
        await page.waitForURL('**/contact-us*'); await page.goBack(); await page.waitForSelector('.property-booking-compact');
        assert.equal(await page.locator('dialog[open], .booking-quote-card').count(), 0, 'Turbo must not restore dialogs or quotes');
        for (mode of ['error', 'unknown']) {
            await visit(); await trigger('arrival').click(); await bounded();
            assert.equal(await page.locator('.property-date-popover .stay-day:not(:disabled)').count(), 0);
            assert.equal(await page.locator(target('applyDates')).isDisabled(), true); await page.keyboard.press('Escape');
            assert.equal(await page.locator('.calendar-contact').isVisible(), true);
        }
        mode = 'closed'; await visit(); assert.equal(await page.locator('.calendar-unavailable').isVisible(), true);
        mode = 'open'; await page.emulateMedia({reducedMotion: 'reduce'}); await visit(); await trigger('arrival').click();
        assert.equal(await page.locator('.property-date-popover').evaluate(e => getComputedStyle(e).animationName), 'none');
        await page.keyboard.press('Escape'); await closed(); assert.equal(await trigger('arrival').evaluate(e => e === document.activeElement), true);
        await page.emulateMedia({reducedMotion: 'no-preference'});
        published = false; const reads = calendarCalls, quotes = quoteCalls;
        await visit(); assert.equal(calendarCalls, reads); assert.equal(quoteCalls, quotes);
        assert.equal(await page.locator('.booking-module-actions, iframe.guestlucky-booking-frame').count(), 0);
        assert.equal(await page.locator('.calendar-unavailable a').first().isVisible(), true);
        assert.deepEqual(errors, []);
        console.log(`PASS property compact: ${layouts} FR/EN/theme 1440/768/390/320 layouts; closed calendar, no layout gap, focus/Escape/outside/apply, dates/minStay/checkout/cross-month, guests/quote/iframe invalidation, Turbo, provider errors, closed publication. All remote responses mocked.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
