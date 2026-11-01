// Local SEO/rendering checks only. No GuestLucky reads, bookings or external writes.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    try {
        const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.route('**/api/**', route => route.fulfill({status: 503, contentType: 'application/json', body: '{"error":"local_seo_check"}'}));
        await page.goto(base + '/', {waitUntil: 'domcontentloaded'});
        const propertyPaths = await page.locator('.property-nav-menu a').evaluateAll(links => links.map(link => new URL(link.href).pathname));
        assert.equal(propertyPaths.length, 5);
        const paths = ['/', '/disponibilites', ...propertyPaths], report = [];
        for (const locale of ['fr', 'en']) for (const path of paths) {
            const response = await page.goto(base + path + '?_locale=' + locale + '&guests=2&arrivalDate=2026-11-01&utm_source=seo-test', {waitUntil: 'domcontentloaded'});
            assert.equal(response.status(), 200);
            const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
            assert.equal(canonical, base + path + '?_locale=' + locale);
            assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonical);
            assert.equal(await page.locator('html').getAttribute('lang'), locale);
            assert.equal(await page.locator('h1').count(), 1);
            const description = await page.locator('meta[name="description"]').getAttribute('content');
            assert(description.trim().length > 40 && description.trim().length <= 170, `${path} ${locale}: ${description.length} ${description}`);
            for (const language of ['fr', 'en']) assert.equal(await page.locator('link[hreflang="' + language + '"]').getAttribute('href'), base + path + '?_locale=' + language);
            const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
            schemas.forEach(text => assert(JSON.parse(text)['@type']));
            assert(await page.locator('picture img').evaluateAll(images => images.every(img => Number(img.getAttribute('width')) > 0 && Number(img.getAttribute('height')) > 0 && img.hasAttribute('alt'))), path + ' image dimensions or missing alt attribute');
            const priority = page.locator(path === '/' ? '.home-hero-image' : '.property-gallery-main img').first();
            if (await priority.count()) { assert.equal(await priority.getAttribute('fetchpriority'), 'high'); assert.notEqual(await priority.getAttribute('loading'), 'lazy'); }
            report.push({path, locale, title: await page.title(), description});
        }
        for (const width of [320, 390]) for (const path of ['/', propertyPaths[0]]) {
            await page.setViewportSize({width, height: 844});
            await page.goto(base + path, {waitUntil: 'domcontentloaded'});
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(600);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({path: `var/seo-${path === '/' ? 'home' : 'property'}-${width}.png`});
        }
        const sitemapResponse = await page.request.get(base + '/sitemap.xml');
        assert.equal(sitemapResponse.status(), 200);
        assert.equal(((await sitemapResponse.text()).match(/<loc>/g) || []).length, 18);
        const robots = await (await page.request.get(base + '/robots.txt')).text();
        assert(robots.includes('Sitemap: https://roaminglille.com/sitemap.xml'));
        assert(!robots.includes('www.roamingfr.com'));
        assert.deepEqual(errors, []);
        fs.writeFileSync('var/seo-browser-report.json', JSON.stringify(report, null, 2));
        console.log('PASS SEO: 14 FR/EN pages, five properties, canonical/hreflang/OG/JSON-LD, image dimensions and priority, 320/390px layouts, 18 sitemap URLs; no provider calls.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
