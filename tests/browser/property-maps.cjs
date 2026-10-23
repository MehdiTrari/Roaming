// Provider calendars/quotes and bookings are always simulated/blocked.
// ROAMING_REAL_MAP_TILES=1 only reads a small interactive OpenFreeMap map.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const realTiles = process.env.ROAMING_REAL_MAP_TILES === '1';
const mapSelector = '.availability-explorer .stay-map';
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    try {
        const context = await browser.newContext(process.env.ROAMING_BROWSER_STORAGE ? {storageState: process.env.ROAMING_BROWSER_STORAGE} : {});
        const page = await context.newPage(), errors = [], tiles = [], calls = [];
        let properties = [], offlineTiles = false;
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && /Error (connecting|invoking|disconnecting)/.test(message.text())) errors.push(message.text()); });
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.hostname === 'tiles.openfreemap.org') {
                tiles.push({url: url.href, headers: route.request().headers()});
                if (realTiles) return route.continue();
                if (offlineTiles) return route.abort();
                return route.fulfill({contentType: 'application/json', body: JSON.stringify({version: 8, sources: {}, layers: [{id: 'background', type: 'background', paint: {'background-color': '#eceeea'}}]})});
            }
            if (url.origin !== base || url.pathname.startsWith('/reservation/') || route.request().method() === 'POST') return route.abort();
            if (!url.pathname.startsWith('/api/')) return route.continue();
            calls.push(url);
            const selected = url.pathname.match(/^\/api\/properties\/([^/]+)\/availability$/)?.[1];
            const year = Number(url.searchParams.get('year')), month = Number(url.searchParams.get('month'));
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, properties: properties.filter(item => !selected || item.slug === selected).map(item => ({slug: item.slug, status: 'fresh', fetchedAt: new Date().toISOString(), days: Array.from({length: new Date(year, month, 0).getDate()}, (_, i) => ({date: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, available: true, minStay: 2, price: 100}))}))})});
        });
        const ready = () => page.waitForSelector('.availability-showcase.is-ready');
        const waitFlight = () => page.waitForFunction(selector => {
            const map = document.querySelector(selector);
            return map.dataset.mapMoving === 'false' && !document.querySelector('.availability-showcase.is-moving');
        }, mapSelector);
        const waitDestination = property => page.waitForFunction(({selector, property}) => {
            const map = document.querySelector(selector);
            return map.dataset.mapMoving === 'false'
                && Math.abs(Number(map.dataset.mapLatitude) - property.latitude) < .00001
                && Math.abs(Number(map.dataset.mapLongitude) - property.longitude) < .00001
                && !document.querySelector('.availability-showcase.is-moving');
        }, {selector: mapSelector, property});
        await page.setViewportSize({width: 1440, height: 1000});
        await page.goto(base + '/disponibilites?_locale=fr'); await ready();
        properties = await page.locator(mapSelector).evaluate(element => JSON.parse(element.dataset.propertyMapPropertiesValue));
        assert.equal(properties.length, 4);
        assert.ok(properties.every(item => item.address && Number.isFinite(item.latitude) && Number.isFinite(item.longitude)));
        assert.equal(calls.length, 0, 'choosing a property does not query availability');
        await page.waitForSelector(`${mapSelector}[data-map-ready="true"]`);
        await page.waitForSelector(`${mapSelector}[data-map-loaded="true"]`);
        assert.equal(await page.evaluate(() => localStorage.getItem('roaming.maps.v1')), null, 'automatic display does not invent or persist consent');
        assert.equal(await page.evaluate(() => localStorage.getItem('roaming.privacy.v1')), null, 'automatic maps never grant booking consent');
        if (!realTiles) for (const version of [1, 2]) {
            await page.evaluate(version => localStorage.setItem('roaming.maps.v1', JSON.stringify({version, maps: false, updatedAt: Date.now(), expiresAt: Date.now() + 86400000})), version);
            const before = tiles.length; await page.reload(); await ready();
            await page.locator(mapSelector).scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
            assert.equal(tiles.length, before, 'an earlier refusal still prevents provider requests');
            assert.equal(await page.locator(mapSelector).getAttribute('data-map-ready'), 'false');
        }
        if (!realTiles) {
            await page.locator(`${mapSelector} [data-action="property-map#allow"]`).click();
            await page.waitForSelector(`${mapSelector}[data-map-loaded="true"]`);
            assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('roaming.maps.v1')).version), 3);
        }
        assert.equal(await page.locator('.stay-map-marker').count(), properties.length);
        assert.equal(await page.locator(mapSelector).getAttribute('data-map-style'), 'roaming-pastel');
        assert.ok(tiles.some(tile => tile.url.endsWith('/styles/liberty')));
        const zoom = await page.locator(mapSelector).evaluate(element => Number(element.dataset.mapZoom));
        const mapBounds = await page.locator(`${mapSelector} canvas`).boundingBox();
        await page.mouse.move(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2);
        const scrollBeforeZoom = await page.evaluate(() => scrollY);
        await page.mouse.wheel(0, -300);
        await page.waitForFunction(({selector, zoom}) => Number(document.querySelector(selector).dataset.mapZoom) > zoom + .2, {selector: mapSelector, zoom});
        await waitFlight();
        assert.ok(Math.abs(await page.evaluate(() => scrollY) - scrollBeforeZoom) < 2, 'wheel over the map zooms without moving the page');
        const zoomed = Number(await page.locator(mapSelector).getAttribute('data-map-zoom'));
        await page.mouse.wheel(0, 300);
        await page.waitForFunction(({selector, zoomed}) => Number(document.querySelector(selector).dataset.mapZoom) < zoomed - .2, {selector: mapSelector, zoomed});
        await waitFlight();
        const stageBounds = await page.locator('.availability-showcase .showcase-stage').boundingBox();
        await page.mouse.move(stageBounds.x + stageBounds.width / 2, mapBounds.y + mapBounds.height / 2);
        await page.mouse.wheel(0, scrollBeforeZoom > 40 ? -200 : 200);
        await page.waitForFunction(previous => Math.abs(scrollY - previous) > 20, scrollBeforeZoom);
        const beforeTheme = await page.locator(mapSelector).evaluate(element => [element.dataset.mapLatitude, element.dataset.mapLongitude, element.dataset.mapZoom]);
        await page.evaluate(() => document.documentElement.dataset.bsTheme = 'dark');
        assert.deepEqual(await page.locator(mapSelector).evaluate(element => [element.dataset.mapLatitude, element.dataset.mapLongitude, element.dataset.mapZoom]), beforeTheme, 'theme changes keep the same detailed map and camera');
        await page.evaluate(() => document.documentElement.dataset.bsTheme = 'light');
        assert.equal(await page.evaluate(() => localStorage.getItem('roaming.privacy.v1')), null, 'map permission is independent from booking permission');
        if (!realTiles) {
            const mapChoice = await page.evaluate(() => JSON.parse(localStorage.getItem('roaming.maps.v1')));
            assert.equal(mapChoice.maps, true); assert.equal(mapChoice.expiresAt - mapChoice.updatedAt, 180 * 86400000);
        }
        const destination = properties.find(item => item.city === 'Douai');
        const start = await page.locator(mapSelector).evaluate(element => Number(element.dataset.mapLatitude));
        await page.locator('[data-availability-explorer-target="select"]').selectOption(destination.slug);
        assert.equal(await page.locator(mapSelector).getAttribute('data-map-selected-slug'), destination.slug);
        assert.equal(await page.locator('.availability-showcase .showcase-slide.is-active').getAttribute('data-slug'), destination.slug);
        await page.waitForTimeout(220);
        const intermediate = await page.locator(mapSelector).evaluate(element => ({latitude: Number(element.dataset.mapLatitude), moving: element.dataset.mapMoving}));
        assert.equal(intermediate.moving, 'true');
        assert.ok(Math.abs(intermediate.latitude - start) > .00001 && Math.abs(intermediate.latitude - destination.latitude) > .00001, 'the map actually moves through intermediate coordinates');
        await waitFlight();
        assert.ok(Math.abs(Number(await page.locator(mapSelector).getAttribute('data-map-latitude')) - destination.latitude) < .00001);
        const route = new URL(await page.locator(`${mapSelector} [data-property-map-target="directions"]`).getAttribute('href'));
        assert.equal(route.searchParams.get('destination'), destination.address); assert.equal(route.searchParams.has('origin'), false);
        assert.equal(calls.length, 0);
        // Markers select the carousel too, and both can interrupt a flight.
        await page.locator(`${mapSelector} [data-action="property-map#overview"]`).click(); await waitFlight();
        await page.locator('.stay-map-marker').first().focus(); await page.keyboard.press('Enter'); await waitFlight();
        assert.equal(await page.locator('[data-availability-explorer-target="select"]').inputValue(), properties[0].slug);
        await page.locator('.availability-showcase .showcase-arrow').last().click();
        await page.waitForTimeout(100);
        await page.locator('[data-availability-explorer-target="select"]').selectOption(destination.slug); await waitDestination(destination);
        assert.equal(await page.locator(mapSelector).getAttribute('data-map-selected-slug'), destination.slug);
        if (realTiles) {
            await page.waitForSelector(`${mapSelector}[data-map-loaded="true"]`);
            assert.ok(tiles.some(tile => tile.url.includes('/planet/')));
            assert.ok(tiles.every(tile => !tile.headers.cookie), 'map requests carry no cookies');
            assert.ok(tiles.every(tile => !tile.headers.referer || new URL(tile.headers.referer).pathname === '/' && !new URL(tile.headers.referer).search), 'map requests do not disclose stay criteria');
            await page.evaluate(() => {document.activeElement.blur(); window.scrollTo({top: 0, behavior: 'instant'});});
            await page.waitForTimeout(1400);
            await page.screenshot({path: 'var/availability-map-real.png'});
            await page.setViewportSize({width: 390, height: 900});
            await page.evaluate(() => document.documentElement.dataset.bsTheme = 'dark');
            await page.locator(mapSelector).scrollIntoViewIfNeeded();
            await page.waitForSelector(`${mapSelector}[data-map-loaded="true"]`);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.waitForTimeout(800); await page.screenshot({path: 'var/pastel-map-mobile.png'});
            assert.deepEqual(errors, []); console.log('PASS real OpenFreeMap: automatic pastel map, cookie-free requests, wheel zoom, exact coordinates, smooth flight and active mobile map. No booking/provider API calls.');
            return;
        }
        // Dragging changes both the active photo card and selected map address.
        const stage = page.locator('.availability-showcase .showcase-stage'); const box = await stage.boundingBox();
        const beforeDrag = await page.locator('[data-availability-explorer-target="select"]').inputValue();
        await page.mouse.move(box.x + box.width * .7, box.y + 100); await page.mouse.down(); await page.mouse.move(box.x + box.width * .2, box.y + 100, {steps: 12}); await page.mouse.up();
        await waitFlight(); assert.notEqual(await page.locator('[data-availability-explorer-target="select"]').inputValue(), beforeDrag);
        // Choosing dates keeps the exact location on the selected property's page.
        const selected = await page.locator('[data-availability-explorer-target="select"]').inputValue();
        await page.locator('.availability-showcase .showcase-slide.is-active [data-booking-slug]').click();
        await page.waitForURL(url => url.searchParams.get('slug') === selected);
        await page.waitForFunction(() => !document.querySelector('[data-calendar-target="fields"]').disabled);
        assert.equal(await page.locator('.availability-location-aside .stay-map').getAttribute('data-map-selected-slug'), selected);
        assert.ok(calls.every(url => url.pathname === '/api/properties/' + selected + '/availability'));
        // Property page uses the exact same component and no Google iframe.
        await page.goto(base + '/property/' + selected + '?_locale=fr');
        await page.locator('#property-location').scrollIntoViewIfNeeded();
        await page.waitForSelector('#property-location .stay-map[data-map-ready="true"]');
        assert.equal(await page.locator('iframe[src*="google"]').count(), 0);
        assert.equal(await page.locator('#property-location [data-property-map-target="address"]').innerText(), properties.find(item => item.slug === selected).address);
        // Independent per-purpose withdrawal removes maps without granting booking.
        await page.locator('.legal-footer-links [data-privacy-open]').click();
        assert.equal(await page.locator('[data-privacy-service="guestlucky"]').isChecked(), false);
        await page.locator('[data-privacy-service="maps"]').uncheck(); await page.locator('[data-privacy-save]').click();
        assert.equal(await page.locator('.maplibregl-canvas').count(), 0);
        assert.equal(await page.locator('#property-location .stay-map-placeholder').isVisible(), true);
        assert.equal(await page.locator('#property-location [data-property-map-target="directions"]').isVisible(), true);
        // A map provider outage keeps the exact address and directions usable.
        offlineTiles = true;
        await page.locator('#property-location [data-action="property-map#allow"]').click();
        await page.waitForSelector('#property-location .stay-map-error:not([hidden])');
        assert.equal(await page.locator('#property-location [data-property-map-target="directions"]').isVisible(), true);
        await page.locator('.legal-footer-links [data-privacy-open]').click();
        await page.locator('[data-privacy-service="maps"]').uncheck(); await page.locator('[data-privacy-save]').click();
        offlineTiles = false;
        // All layouts retain accessible cards, responsive map and exact links.
        for (const locale of ['fr', 'en']) for (const theme of ['light', 'dark']) for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({width, height: 950}); await page.goto(base + '/disponibilites?_locale=' + locale); await ready();
            await page.evaluate(value => document.documentElement.dataset.bsTheme = value, theme);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${locale}/${theme}/${width}`);
            for (const property of properties) {
                await page.locator('[data-availability-explorer-target="select"]').selectOption(property.slug);
                assert.equal(await page.locator(mapSelector).getAttribute('data-map-selected-slug'), property.slug);
                const href = await page.locator(`${mapSelector} [data-property-map-target="directions"]`).getAttribute('href');
                assert.equal(new URL(href).searchParams.get('destination'), property.address);
            }
            await page.locator(mapSelector).scrollIntoViewIfNeeded();
            const bounds = await page.locator(mapSelector).boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
            if (locale === 'fr' && [1440, 390].includes(width)) {
                await page.waitForFunction(() => !document.querySelector('.availability-showcase.is-moving'));
                await page.waitForTimeout(1400);
                await page.screenshot({path: `var/property-map-${theme}-${width}.png`});
            }
        }
        // Changing only the map setting never renews existing booking consent.
        const existingGuestChoice = JSON.stringify({version: 1, guestlucky: true, updatedAt: Date.now() - 10000, expiresAt: Date.now() + 86400000});
        await page.evaluate(value => localStorage.setItem('roaming.privacy.v1', value), existingGuestChoice);
        await page.locator(`${mapSelector} [data-privacy-open]`).last().click();
        await page.locator('[data-privacy-service="maps"]').check(); await page.locator('[data-privacy-save]').click();
        assert.equal(await page.evaluate(() => localStorage.getItem('roaming.privacy.v1')), existingGuestChoice);
        await page.evaluate(() => localStorage.removeItem('roaming.privacy.v1'));
        // The exact address and directions also work without graphics support.
        await page.addInitScript(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type.includes('webgl') ? null : original.call(this, type, ...args); };
        });
        await page.evaluate(() => localStorage.removeItem('roaming.maps.v1'));
        await page.goto(base + '/disponibilites?_locale=fr'); await ready();
        await page.locator(mapSelector).scrollIntoViewIfNeeded();
        await page.waitForSelector(`${mapSelector} .stay-map-error:not([hidden])`);
        assert.equal(await page.locator(`${mapSelector} [data-property-map-target="directions"]`).isVisible(), true);
        // No-JS fallback keeps every property's link available.
        const noJs = await browser.newContext({javaScriptEnabled: false, ...(process.env.ROAMING_BROWSER_STORAGE ? {storageState: process.env.ROAMING_BROWSER_STORAGE} : {})});
        await noJs.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
        const noJsPage = await noJs.newPage(); await noJsPage.goto(base + '/disponibilites?_locale=fr');
        assert.equal(await noJsPage.locator('.availability-property-card [data-booking-slug]').count(), properties.length);
        assert.equal(await noJsPage.locator('noscript a[href^="https://www.google.com/maps/dir/"]').count(), properties.length);
        assert.equal(await noJsPage.locator('.availability-property-card').first().isVisible(), true); await noJs.close();
        assert.deepEqual(errors, []);
        console.log('PASS maps: automatic display, legacy opt-outs, independent booking consent without renewal, 4 exact locations, wheel zoom and intermediate flight coordinates, carousel/markers/drag sync, directions, calendars, disable/re-enable, outages, 16 layouts and no-WebGL/no-JS fallbacks. All provider calls mocked.');
    } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
