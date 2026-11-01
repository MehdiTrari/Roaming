// Production checks: only team login/logout may POST. Never books or calls GuestLucky.
const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = 'https://roaminglille.com';
const secrets = [];
(async () => {
    const root = path.resolve(__dirname, '..');
    const credentials = JSON.parse(await fs.readFile(path.join(root, 'var/private/hostinger-team-activation-20261024/team-credentials.json'), 'utf8'));
    secrets.push(credentials.password, credentials.email);
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const report = {production: base, checkedAt: new Date().toISOString(), providerCalls: false, businessWrites: false, pages: []};
    try {
        const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
        await context.route('**/*', route => {
            const request = route.request(), url = new URL(request.url());
            if (url.origin !== base || url.pathname.startsWith('/reservation/')) return route.abort();
            if (url.pathname.startsWith('/api/')) return route.fulfill({status: 503, contentType: 'application/json', body: '{}'});
            if (!['GET', 'HEAD'].includes(request.method()) && !['/equipe/connexion', '/equipe/deconnexion'].includes(url.pathname)) return route.abort();
            return route.continue();
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/', {waitUntil: 'networkidle'});
        assert.equal(await page.locator('.team-maintenance').count(), 1);
        report.anonymousMaintenance = true;
        const publicApi = await context.request.get(base + '/api/calendar');
        assert.equal(publicApi.status(), 503);
        report.anonymousApiBlocked = true;
        const robots = await context.request.get(base + '/robots.txt');
        assert.equal(robots.status(), 200);
        assert.match(await robots.text(), /Sitemap: https:\/\/roaminglille\.com\/sitemap\.xml/);
        report.robotsVerified = true;
        await page.goto(base + '/equipe/connexion?_locale=fr', {waitUntil: 'networkidle'});
        await page.locator('#username').fill(credentials.email);
        await page.locator('#password').fill(credentials.password);
        await Promise.all([page.waitForURL(base + '/'), page.locator('form[action="/equipe/connexion"] button').click()]);
        await page.locator('[data-team-report]').waitFor();
        report.teamLogin = true;
        const propertyPaths = await page.locator('.property-nav-menu a').evaluateAll(links => links.map(link => new URL(link.href).pathname));
        assert(propertyPaths.length >= 4);
        report.propertyPaths = propertyPaths;
        for (const locale of ['fr', 'en']) {
            for (const currentPath of ['/', '/disponibilites', ...propertyPaths]) {
                const response = await page.goto(base + currentPath + '?_locale=' + locale + '&guests=2&arrivalDate=2026-11-01&utm_source=release-test', {waitUntil: 'domcontentloaded'});
                assert.equal(response.status(), 200, currentPath);
                assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), base + currentPath + '?_locale=' + locale);
                assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), base + currentPath + '?_locale=' + locale);
                assert.equal(await page.locator('#guest-reviews, .guest-review-source-card').count(), 0);
                for (const json of await page.locator('script[type="application/ld+json"]').allTextContents()) JSON.parse(json);
                const row = {path: currentPath, locale, http: response.status()};
                if (currentPath.startsWith('/property/')) {
                    const locations = JSON.parse(await page.locator('#property-location .stay-map').getAttribute('data-property-map-properties-value'));
                    assert(locations.length === 1 && locations.every(location => Number.isFinite(location.latitude) && Number.isFinite(location.longitude)), 'Every production property needs saved map coordinates: ' + currentPath);
                    row.coordinatesPresent = true;
                    row.amenities = await page.locator('.property-amenities li').count();
                    row.icons = await page.locator('.property-amenity-icon svg').count();
                    assert.equal(row.icons, row.amenities, 'Every displayed amenity has an SVG');
                }
                report.pages.push(row);
            }
            await page.goto(base + '/?_locale=' + locale, {waitUntil: 'networkidle'});
            assert.equal(await page.locator('script[src$="/app.f9b5357d.js"]').count(), 1);
            for (const width of [390, 320]) {
                await page.setViewportSize({width, height: 900});
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No mobile overflow');
            }
            await page.setViewportSize({width: 1440, height: 1000});
        }
        const sitemapResponse = await context.request.get(base + '/sitemap.xml');
        assert.equal(sitemapResponse.status(), 200);
        const sitemap = await sitemapResponse.text();
        assert(!sitemap.includes('127.0.0.1') && !sitemap.includes('localhost'));
        report.sitemapUrls = (sitemap.match(/<loc>/g) || []).length;
        report.sitemapHasFifthProperty = sitemap.includes('la-petite-cour');
        for (const origin of ['http://roaminglille.com', 'http://www.roaminglille.com', 'https://www.roaminglille.com']) {
            const response = await context.request.get(origin + '/property/lambersart?_locale=en&guests=2', {maxRedirects: 0});
            assert.equal(response.status(), 301);
            assert.equal(response.headers().location, base + '/property/lambersart?_locale=en&guests=2');
        }
        report.redirectsVerified = true;
        await Promise.all([page.waitForURL(base + '/'), page.locator('form[action="/equipe/deconnexion"] button').click()]);
        await page.locator('.team-maintenance').waitFor();
        report.teamLogout = true;
        assert.deepEqual(errors, []);
        report.browserErrors = errors;
        report.status = 'PASS';
        await fs.writeFile(path.join(root, 'var/deployment/release-20261028/PRODUCTION-VERIFIED.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report));
    } finally { await browser.close(); }
})().catch(error => {
    let message = error.message;
    for (const value of secrets) if (value) message = message.split(value).join('[private]');
    console.error(message);
    process.exitCode = 1;
});
