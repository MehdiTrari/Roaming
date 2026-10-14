// Local read-only audit; no third-party requests, no valid form submissions.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const tag = process.env.ROAMING_AUDIT_TAG || 'after';
const strict = process.env.ROAMING_AUDIT_STRICT === '1';
const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/guestlucky/catalogue.json'), 'utf8')).properties;
const pages = ['/', '/about-us', '/contact-us', '/disponibilites', ...catalogue.map(p => '/property/' + p.slug), '/test-disponibilites'];

(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [], issues = [], measurements = [], samples = [];
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== base || url.pathname.startsWith('/reservation/')) return route.abort();
        if (url.pathname.startsWith('/api/')) return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: false, properties: catalogue.map(p => ({slug: p.slug, status: 'unverified', days: []})), availability: []})});
        return route.continue();
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
        window.audit = {lcp: 0, cls: 0, interaction: 0, imageErrors: []};
        document.addEventListener('error', event => {
            if (event.target instanceof HTMLImageElement) window.audit.imageErrors.push(event.target.currentSrc || event.target.src);
        }, true);
        new PerformanceObserver(list => list.getEntries().forEach(entry => window.audit.lcp = entry.startTime)).observe({type: 'largest-contentful-paint', buffered: true});
        new PerformanceObserver(list => list.getEntries().forEach(entry => { if (!entry.hadRecentInput) window.audit.cls += entry.value; })).observe({type: 'layout-shift', buffered: true});
        new PerformanceObserver(list => list.getEntries().forEach(entry => { if (entry.interactionId) window.audit.interaction = Math.max(window.audit.interaction, entry.duration); })).observe({type: 'event', buffered: true, durationThreshold: 16});
    });
    try {
        // Native Chrome lab measurements, three cold-browser-cache samples per page/width.
        await page.goto(base + '/change-locale/fr');
        const cdp = await context.newCDPSession(page);
        for (const width of [1440, 390]) for (const url of ['/', '/property/' + catalogue[0].slug]) for (let run = 0; run < 3; run++) {
            await page.setViewportSize({width, height: 950}); await cdp.send('Network.clearBrowserCache');
            await page.goto(base + url); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(800);
            if (url === '/') { await page.locator('#date-display').click(); await page.keyboard.press('Escape'); }
            else { await page.locator('#propertyGallery .carousel-control-next').click(); }
            await page.waitForTimeout(200);
            const result = await page.evaluate(() => ({...window.audit, bytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + entry.transferSize, 0), images: [...document.images].map(image => ({src: new URL(image.currentSrc || image.src).pathname, width: image.naturalWidth, display: Math.round(image.getBoundingClientRect().width)})), queries: document.querySelector('.sf-toolbar-block-db .sf-toolbar-value')?.textContent.trim() || null}));
            measurements.push({url, width, run, ...result});
        }
        if (process.env.ROAMING_AUDIT_METRICS_ONLY === '1') {
            fs.writeFileSync(path.join(__dirname, `../../var/audit-${tag}.json`), JSON.stringify({tag, measurements}, null, 2));
            console.log('PASS: 12 native Chrome lab measurement samples (local, unthrottled).');
            return;
        }
        for (const locale of ['fr', 'en']) {
            await page.goto(base + '/change-locale/' + locale);
            for (const theme of ['light', 'dark']) for (const width of [320, 390, 768, 1024, 1440]) {
                await page.setViewportSize({width, height: 950});
                await page.evaluate(value => localStorage.setItem('theme', value), theme);
                for (const url of pages) {
                    const response = await page.goto(base + url); await page.evaluate(() => document.fonts.ready);
                    await page.waitForTimeout(80);
                    // A deferred <picture> can be complete before a source is selected.
                    // Wait for images in the viewport; unselected offscreen images are not failures.
                    await page.evaluate(async () => {
                        const inViewport = image => { const rect = image.getBoundingClientRect(); return rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth; };
                        await Promise.all([...document.images].filter(inViewport).map(image => image.decode().catch(() => {})));
                    });
                    const sample = await page.evaluate(() => {
                        const visible = element => !element.closest('[id^="sfToolbar"]') && element.getBoundingClientRect().width && element.getBoundingClientRect().height && getComputedStyle(element).visibility !== 'hidden';
                        return {title: document.title, locale: document.documentElement.lang, theme: document.documentElement.dataset.bsTheme, overflow: document.documentElement.scrollWidth > innerWidth, h1: document.querySelectorAll('h1').length, description: document.querySelector('meta[name="description"]')?.content,
                            canonical: document.querySelector('link[rel="canonical"]')?.href, broken: [...new Set([...window.audit.imageErrors, ...[...document.images].filter(image => visible(image) && image.complete && image.currentSrc && !image.naturalWidth).map(image => image.currentSrc)])],
                            unlabeled: [...document.querySelectorAll('button, input:not([type="hidden"]), select, textarea')].filter(visible).filter(element => !element.textContent.trim() && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby') && !element.labels?.length).map(element => element.id || element.outerHTML.slice(0, 80)),
                            schemaErrors: [...document.querySelectorAll('script[type="application/ld+json"]')].map(element => { try { JSON.parse(element.textContent); return null; } catch (error) { return error.message; } }).filter(Boolean),
                            buttons: [...document.querySelectorAll('.btn-primary')].filter(visible).map(element => getComputedStyle(element).backgroundColor)};
                    });
                    samples.push({url, locale, theme, width, status: response.status(), ...sample});
                    for (const [key, failed] of Object.entries({status: response.status() !== 200, locale: sample.locale !== locale, theme: sample.theme !== theme, overflow: sample.overflow, h1: sample.h1 !== 1, description: !sample.description, broken: sample.broken.length, unlabeled: sample.unlabeled.length, schema: sample.schemaErrors.length, buttons: sample.buttons.some(color => color !== 'rgb(15, 118, 110)')})) {
                        if (failed) issues.push({url, locale, theme, width, key, detail: sample[key === 'schema' ? 'schemaErrors' : key]});
                    }
                }
                await page.goto(base + '/');
                if (width < 1200) {
                    await page.locator('.navbar-toggler').click(); await page.waitForSelector('#navbarContent.show');
                    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) issues.push({url: '/', locale, theme, width, key: 'menuOverflow'});
                    await page.locator('.navbar .dropdown-toggle').click(); await page.waitForSelector('.navbar .dropdown-menu.show');
                    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
                    if (await page.locator('.navbar .dropdown-menu').isVisible()) issues.push({url: '/', locale, theme, width, key: 'dropdownEscape'});
                    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
                    if (await page.locator('#navbarContent').isVisible()) issues.push({url: '/', locale, theme, width, key: 'menuEscape'});
                }
                if (process.env.ROAMING_BROWSER_SCREENSHOTS === '1' && locale === 'fr' && [320, 1440].includes(width)) await page.screenshot({path: path.join(__dirname, `../../var/audit-${tag}-${theme}-${width}.png`), fullPage: true});
            }
        }
        // Locale URLs must work without relying on a previously set session.
        for (const locale of ['fr', 'en']) {
            await page.goto(base + '/?_locale=' + locale + '&guests=2&arrivalDate=2026-11-05&departureDate=2026-11-07');
            const language = await page.locator('html').getAttribute('lang');
            const canonical = new URL(await page.locator('link[rel="canonical"]').getAttribute('href'));
            if (language !== locale) issues.push({key: 'queryLocale', locale, actual: language});
            if (canonical.searchParams.has('guests') || canonical.searchParams.has('arrivalDate')) issues.push({key: 'canonicalCriteria', locale});
        }
        const report = {tag, capturedAt: new Date().toISOString(), measurements, samples, issues, errors};
        fs.writeFileSync(path.join(__dirname, `../../var/audit-${tag}.json`), JSON.stringify(report, null, 2));
        console.log(JSON.stringify({tag, pages: samples.length, findings: [...new Set(issues.map(issue => `${issue.url || ''}:${issue.key}`))], errors, measurements: measurements.map(({url, width, run, lcp, cls, interaction, bytes, queries}) => ({url, width, run, lcp: Math.round(lcp), cls, interaction, bytes, queries}))}, null, 2));
        if (strict) { assert.deepEqual(errors, []); assert.deepEqual(issues, []); }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
