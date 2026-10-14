// Local UI checks only: intercept every API, booking route and external origin.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const catalogue = require('../../config/guestlucky/catalogue.json').properties;
const now = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
const [year, month] = now.split('-').map(Number);
const date = day => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
const stay = {arrivalDate: date(5), departureDate: date(7), guests: '2'};

(async () => {
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const context = await browser.newContext();
    const page = await context.newPage(), calls = [], errors = [];
    let enabled = true;
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== base || route.request().method() === 'POST') return route.abort();
        if (url.pathname.startsWith('/reservation/')) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Mock module</title><p>Local simulation only</p>'});
        if (!url.pathname.startsWith('/api/')) return route.continue();
        calls.push(url);
        if (url.pathname === '/api/availability') {
            const property = catalogue.find(p => p.slug === url.searchParams.get('slug'));
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled, ...stay, availability: [{slug: property.slug, name: property.name, city: property.city, maxGuests: property.capacity, status: 'available', available: true, price: 400, nights: 2, currency: 'EUR', fees: {}, detailsUrl: '/property/' + property.slug, bookingUrl: '/reservation/' + property.slug + '?' + new URLSearchParams(stay)}]})});
        }
        const y = Number(url.searchParams.get('year')), m = Number(url.searchParams.get('month'));
        const properties = catalogue.map(p => ({slug: p.slug, status: enabled ? 'fresh' : 'unverified', fetchedAt: new Date().toISOString(), days: enabled ? Array.from({length: new Date(y, m, 0).getDate()}, (_, i) => ({date: `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, available: true, minStay: 2, price: 100})) : []}));
        return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled, properties})});
    });
    page.on('pageerror', error => errors.push(error.message));
    const fresh = () => page.waitForFunction(() => !document.documentElement.hasAttribute('data-turbo-preview') && !document.documentElement.hasAttribute('aria-busy'));
    const chooser = async () => { await page.waitForSelector('.stay-property-picker:not([hidden])'); await fresh(); assert.equal(await page.locator('.availability-property-card').count(), 3); assert.equal(await page.locator('[data-calendar-target="stage"]').isVisible(), false); await page.waitForFunction(() => document.activeElement.id === 'availability-choice-title'); };
    const ready = async slug => { await page.waitForFunction(() => !document.querySelector('[data-calendar-target="fields"]').disabled); await fresh(); assert.equal(new URL(page.url()).searchParams.get('slug'), slug); assert.equal(await page.locator('[data-calendar-target="propertyName"]').evaluate(e => e === document.activeElement), true); };
    let layouts = 0;
    try {
        for (const locale of ['fr', 'en']) for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
            await page.setViewportSize({width, height: 950});
            await page.goto(base + '/disponibilites'); await page.evaluate(value => localStorage.setItem('theme', value), theme);
            const before = calls.length;
            await page.goto(base + '/disponibilites?' + new URLSearchParams({...stay, _locale: locale})); await chooser(); await page.waitForTimeout(180);
            assert.equal(calls.length, before, 'selection must make no availability requests');
            assert.equal(await page.locator('html').getAttribute('lang'), locale);
            assert.equal(await page.locator('html').getAttribute('data-bs-theme'), theme);
            assert.equal(await page.locator('.availability-property-card img').count(), 2);
            assert.equal(await page.locator('.availability-property-card.without-photo').count(), 1);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            if (process.env.ROAMING_BROWSER_SCREENSHOTS === '1') await page.screenshot({path: `var/availability-choices-${locale}-${theme}-${width}.png`, fullPage: true});
            for (const property of catalogue) {
                await page.goto(base + '/disponibilites?' + new URLSearchParams({...stay, _locale: locale})); await chooser();
                const count = calls.length;
                await page.locator(`[data-booking-slug="${property.slug}"]`).focus(); await page.keyboard.press('Enter'); await ready(property.slug);
                assert.equal(calls.length, count + 2, 'only the two selected-property months are requested');
                assert.ok(calls.slice(count).every(url => url.pathname === '/api/properties/' + property.slug + '/availability'));
                assert.equal(await page.locator('[data-calendar-target="arrival"]').inputValue(), stay.arrivalDate);
                assert.equal(await page.locator('[data-calendar-target="departure"]').inputValue(), stay.departureDate);
                assert.equal(await page.locator('.stay-month').count(), 2);
                assert.equal(await page.locator('.stay-clear').isEnabled(), true);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                await page.locator('.availability-change-property').click(); await chooser();
                assert.equal(new URL(page.url()).searchParams.get('slug'), null);
                assert.equal(new URL(page.url()).searchParams.get('arrivalDate'), null);
                assert.equal(new URL(page.url()).searchParams.get('departureDate'), null);
                assert.equal(new URL(page.url()).searchParams.get('guests'), stay.guests);
                assert.equal(new URL(page.url()).searchParams.get('_locale'), locale);
            }
            await page.locator(`[data-booking-slug="${catalogue[0].slug}"]`).click(); await ready(catalogue[0].slug);
            await page.locator('[data-calendar-target="arrival"]').fill(stay.arrivalDate);
            await page.locator('[data-calendar-target="departure"]').fill(stay.departureDate);
            await page.locator('.stay-clear').click();
            assert.equal(await page.locator('[data-calendar-target="arrival"]').inputValue(), '');
            assert.equal(await page.locator('[data-calendar-target="departure"]').inputValue(), '');
            assert.equal(await page.locator('.stay-clear').isDisabled(), true);
            assert.equal(new URL(page.url()).searchParams.get('slug'), catalogue[0].slug);
            assert.equal(new URL(page.url()).searchParams.get('arrivalDate'), null);
            if (width < 1200) await page.locator('.navbar-toggler').click();
            await page.locator('.navbar .nav-link[data-booking-reset-property]').click(); await chooser();
            layouts++;
        }
        // Genuine Turbo history, invalid slug, quote invalidation and no restored old quote.
        await page.goto(base + '/disponibilites?' + new URLSearchParams({...stay, _locale: 'en', slug: 'unknown'})); await chooser();
        assert.equal(new URL(page.url()).searchParams.get('slug'), null);
        await page.locator(`[data-booking-slug="${catalogue[0].slug}"]`).click(); await ready(catalogue[0].slug);
        await page.locator('[data-calendar-target="submit"]').click(); await page.waitForSelector('.booking-quote-card');
        await page.locator('.availability-change-property').click(); await chooser();
        await page.goBack(); await ready(catalogue[0].slug);
        assert.equal(await page.locator('.booking-quote-card, .guestlucky-booking-frame').count(), 0);
        await page.goBack(); await chooser();
        await page.goForward(); await ready(catalogue[0].slug);
        await page.locator('[data-calendar-target="submit"]').click(); await page.waitForSelector('.booking-quote-card');
        await page.locator('.booking-module-actions button').click(); await page.waitForSelector('.booking-modal[open]');
        await page.evaluate(() => document.querySelector('.stay-clear').click());
        assert.equal(await page.locator('.booking-quote-card, .guestlucky-booking-frame').count(), 0);
        assert.equal(await page.locator('.booking-modal').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('booking-modal-open')), false);
        // Publication closed still allows returning to the chooser, without booking controls.
        enabled = false;
        await page.goto(base + '/disponibilites?' + new URLSearchParams({...stay, slug: catalogue[1].slug}));
        await page.waitForSelector('.calendar-unavailable:not([hidden])');
        assert.equal(await page.locator('.booking-module-actions').count(), 0);
        await page.locator('.availability-change-property').click(); await chooser();
        assert.deepEqual(errors, []);
        console.log(`PASS: ${layouts} FR/EN light/dark 1440/390/320 layouts; all 3 real properties, photo fallback, zero initial API calls, targeted months, dates/locale/menu, clear/disable, keyboard/focus, Turbo history, invalid slug, quote invalidation and closed publication. No provider traffic or bookings.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
