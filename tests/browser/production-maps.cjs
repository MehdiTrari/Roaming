// Live map reads with existing team access. No booking/payment/provider API writes.
const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const base = 'https://roaminglille.com';
const audit = 'var/backups/hostinger-map-lille-20261028';
const privateValues = [];
(async () => {
    const credentials = JSON.parse(await fs.readFile('var/private/hostinger-team-activation-20261024/team-credentials.json', 'utf8'));
    privateValues.push(credentials.email, credentials.password);
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const report = {checkedAt: new Date().toISOString(), visits: [], mapRequests: 0, providerApiCalls: false, businessWrites: false};
    try {
        const context = await browser.newContext({viewport: {width: 1440, height: 1000}}), page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await context.route('**/*', route => {
            const request = route.request(), url = new URL(request.url());
            if (url.hostname === 'tiles.openfreemap.org') { report.mapRequests++; return route.continue(); }
            if (url.origin !== base || url.pathname.startsWith('/reservation/')) return route.abort();
            if (url.pathname.startsWith('/api/')) return route.fulfill({status: 503, contentType: 'application/json', body: '{}'});
            if (request.method() === 'POST' && !['/equipe/connexion', '/equipe/deconnexion'].includes(url.pathname)) return route.abort();
            return route.continue();
        });
        await page.goto(base + '/equipe/connexion', {waitUntil: 'networkidle'});
        await page.locator('#username').fill(credentials.email);
        await page.locator('#password').fill(credentials.password);
        await Promise.all([page.waitForURL(base + '/'), page.locator('form[action="/equipe/connexion"] button').click()]);
        const properties = await page.locator('.property-nav-menu a').evaluateAll(links => links.map(link => new URL(link.href).pathname));
        assert.equal(properties.length, 5);
        const lille = properties.find(value => value.includes('la-petite-cour'));
        for (const currentPath of ['/disponibilites', ...properties, '/disponibilites', lille]) {
            await page.evaluate(url => window.Turbo.visit(url), base + currentPath);
            await page.waitForURL(base + currentPath);
            await page.waitForFunction(currentPath => !document.documentElement.hasAttribute('data-turbo-preview') && (currentPath === '/disponibilites'
                ? !!document.querySelector('.calendar-page .stay-map')
                : document.querySelector('#property-location .stay-map')?.dataset.mapSelectedSlug === currentPath.split('/').pop()), currentPath);
            const map = page.locator('.stay-map').first();
            await map.scrollIntoViewIfNeeded();
            await page.waitForSelector('.stay-map[data-map-loaded="true"]', {timeout: 30000});
            const row = await map.evaluate(element => ({path: location.pathname, loaded: element.dataset.mapLoaded === 'true', error: !element.querySelector('[data-property-map-target="error"]').hidden,
                locations: JSON.parse(element.dataset.propertyMapPropertiesValue).map(({slug, latitude, longitude}) => ({slug, latitude, longitude}))}));
            assert(!row.error);
            assert(row.locations.every(location => Number.isFinite(location.latitude) && Number.isFinite(location.longitude)));
            assert.equal(await map.locator('.stay-map-marker').count(), row.locations.length);
            if (currentPath === lille) {
                assert.equal(row.locations[0].latitude, 50.623037);
                assert.equal(row.locations[0].longitude, 3.056473);
                await map.screenshot({path: audit + '/lille-map-desktop.png'});
            }
            report.visits.push(row);
            console.log(JSON.stringify({path: currentPath, mapLoaded: row.loaded, markers: row.locations.length}));
        }
        await page.setViewportSize({width: 390, height: 900});
        await page.locator('.stay-map').first().scrollIntoViewIfNeeded();
        await page.waitForSelector('.stay-map[data-map-loaded="true"]');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.locator('.stay-map').first().screenshot({path: audit + '/lille-map-mobile.png'});
        report.mobileVerified = true;
        assert.deepEqual(errors, []);
        await Promise.all([page.waitForURL(base + '/'), page.locator('form[action="/equipe/deconnexion"] button').click()]);
        await page.locator('.team-maintenance').waitFor();
        report.maintenancePreserved = true;
        report.status = 'PASS';
        await fs.writeFile(audit + '/MAPS-VERIFIED.json', JSON.stringify(report, null, 2));
        console.log('PASS: 8 real production map loads via Turbo, all five coordinates/markers, Lille on desktop/mobile, maintenance preserved.');
    } finally { await browser.close(); }
})().catch(error => {
    let message = error.message;
    for (const value of privateValues) message = message.split(value).join('[private]');
    console.error(message);
    process.exitCode = 1;
});
