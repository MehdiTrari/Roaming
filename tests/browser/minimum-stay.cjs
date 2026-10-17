// Browser regression for both public date selectors. All provider traffic is mocked.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
const [year, month] = today.split('-').map(Number);
const date = day => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
const target = name => `[data-calendar-target="${name}"]`;
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const context = await browser.newContext(process.env.ROAMING_BROWSER_STORAGE ? {storageState: process.env.ROAMING_BROWSER_STORAGE} : {});
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let mode = 'two', quotes = 0, slugs = [];
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== base || url.pathname.startsWith('/reservation/')) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (url.pathname === '/api/availability' || url.pathname === '/api/test/availability') {
            quotes++;
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, availability: []})});
        }
        const y = Number(url.searchParams.get('year')), m = Number(url.searchParams.get('month'));
        const properties = slugs.map((slug, i) => ({slug, status: 'fresh', fetchedAt: new Date().toISOString(), days: Array.from({length: new Date(y, m, 0).getDate()}, (_, n) => {
            const value = new Date(Date.UTC(y, m - 1, n + 1)).toISOString().slice(0, 10);
            const available = mode === 'split' ? value === date(i ? 6 : 5) : ![date(6), date(10)].includes(value);
            return {date: value, available, price: 100, minStay: mode === 'one' ? 1 : mode === 'three' ? 3 : 2};
        })}));
        return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, properties})});
    });
    const open = async (surface, extra = {}) => {
        const params = new URLSearchParams({slug: 'lambersart', arrivalDate: date(5), guests: '2', ...extra});
        await page.goto(base + (surface === 'home' ? '/?' : '/disponibilites?') + params);
        if (surface === 'home') {
            await page.waitForFunction(() => !!document.querySelector('#date-range')?._flatpickr);
            await page.locator('#date-display').click();
            await page.waitForFunction(() => document.querySelector('#date-availability-status').dataset.state === 'fresh');
            await page.locator('#date-cancel').click(); await page.locator('#date-display').click();
        } else {
            await page.locator('.stay-calendar').scrollIntoViewIfNeeded();
            await page.waitForFunction(() => document.querySelector('[data-calendar-target="status"]').dataset.state === 'fresh');
            await page.locator(target('clear')).click();
        }
    };
    const day = (surface, value) => page.locator(surface === 'home' ? `#date-calendar .flatpickr-day[data-date="${value}"]` : `.stay-calendar button[data-date="${value}"]`);
    const disabled = (surface, value) => day(surface, value).evaluate(e => e.disabled || e.classList.contains('flatpickr-disabled'));
    const arrival = surface => page.locator(surface === 'home' ? '#arrival-date' : target('arrival'));
    const departure = surface => page.locator(surface === 'home' ? '#departure-date' : target('departure'));
    try {
        await page.goto(base + '/');
        slugs = await page.locator('#booking-property option:not([value=""])').evaluateAll(options => options.map(option => option.value));
        for (const width of [1440, 390]) for (const surface of ['home', 'calendar']) {
            await page.setViewportSize({width, height: 950});
            mode = 'two'; await open(surface);
            assert.equal(await disabled(surface, date(5)), true, 'isolated open night is not a valid arrival');
            assert.match(await day(surface, date(5)).getAttribute('aria-label'), /nuits consécutives|consecutive nights/);
            assert.equal(await disabled(surface, date(9)), true, 'last night before a booking cannot start a two-night stay');
            await day(surface, date(7)).click();
            assert.equal(await arrival(surface).inputValue(), date(7));
            assert.equal(await disabled(surface, date(8)), true, 'one-night checkout is disabled');
            assert.equal(await disabled(surface, date(9)), false, 'two-night checkout remains possible even when it cannot be an arrival');
            assert.equal(await disabled(surface, date(10)), false, 'occupied checkout night is excluded from the stay');
            assert.equal(await disabled(surface, date(11)), true, 'cannot cross an occupied night');
            if (surface === 'home') {
                await day(surface, date(9)).hover();
                assert.equal(await page.locator('#date-calendar .notAllowed').count(), 0, 'hover must not falsely gray out valid departures');
                assert.equal(await day(surface, date(8)).evaluate(e => e.classList.contains('inRange')), true, 'minimum-stay interior night is highlighted despite being invalid as a checkout');
                assert.equal(await day(surface, date(9)).evaluate(e => e.classList.contains('endRange')), true, 'hover shows the proposed checkout');
                assert.equal(await departure(surface).inputValue(), '', 'hover does not commit the date');
                await day(surface, date(10)).hover();
                assert.equal(await day(surface, date(9)).evaluate(e => e.classList.contains('inRange')), true, 'preview follows the pointer to an occupied but valid checkout');
                assert.equal(await day(surface, date(10)).evaluate(e => e.classList.contains('endRange')), true);
                await day(surface, date(11)).hover();
                assert.equal(await page.locator('#date-calendar .inRange, #date-calendar .notAllowed').count(), 0, 'invalid stay has no misleading preview and does not disable other dates');
                await day(surface, date(9)).hover();
                await page.locator('#date-panel h5').hover();
                assert.equal(await page.locator('#date-calendar .inRange, #date-calendar .endRange').count(), 0, 'leaving the calendar clears the provisional range');
                await day(surface, date(7)).focus(); await page.keyboard.press('ArrowRight');
                assert.equal(await page.evaluate(() => document.activeElement.dataset.date), date(9), 'keyboard skips an invalid one-night checkout');
                assert.equal(await page.locator('#date-calendar .notAllowed').count(), 0, 'native keyboard navigation cannot reintroduce the false disabled state');
                assert.equal(await day(surface, date(8)).evaluate(e => e.classList.contains('inRange')), true, 'keyboard focus previews the same valid range');
            }
            const before = quotes;
            await day(surface, date(9)).click();
            assert.equal(await departure(surface).inputValue(), date(9));
            if (surface === 'home') {
                assert.equal(quotes, before, 'selection does not request a quote');
                assert.equal(await day(surface, date(8)).evaluate(e => e.classList.contains('inRange')), true, 'committed range remains highlighted');
            }
            else assert.equal(await departure(surface).getAttribute('min'), date(9));
            mode = 'three'; await open(surface);
            await day(surface, date(7)).click();
            assert.equal(await disabled(surface, date(9)), true, 'variable three-night minimum');
            assert.equal(await disabled(surface, date(10)), false);
            if (surface === 'home') {
                await day(surface, date(10)).hover();
                assert.equal(await page.locator('#date-calendar .inRange').count(), 2, 'three-night preview crosses both disabled short checkout options');
                assert.equal(await page.locator('#date-calendar .notAllowed').count(), 0);
            }
            mode = 'one'; await open(surface);
            assert.equal(await disabled(surface, date(5)), false, 'real one-night permissions are preserved');
            await day(surface, date(5)).click();
            assert.equal(await disabled(surface, date(6)), false, 'valid one-night checkout');
            mode = 'two'; await open(surface);
            const last = new Date(Date.UTC(year, month + 2, 0)).toISOString().slice(0, 10);
            if (surface === 'home') {
                await page.locator('.flatpickr-next-month').click();
                await page.waitForFunction(() => document.querySelector('#date-availability-status').dataset.state === 'fresh');
            }
            assert.equal(await disabled(surface, last), false, 'lookahead preserves month-end arrivals');
        }
        mode = 'split'; await open('home', {slug: ''});
        assert.equal(await disabled('home', date(5)), true, 'different properties cannot supply consecutive nights of one stay');
        assert.deepEqual(errors, []);
        console.log('PASS minimum stays: home + availability, desktop/mobile, isolated gaps, 1/2/3 nights, valid occupied checkout, same-property continuity, month-end lookahead. All GuestLucky responses mocked.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
