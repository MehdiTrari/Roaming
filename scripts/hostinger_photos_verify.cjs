// Production read-only visual/gallery checks. Only authentication POSTs are allowed.
const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const secrets = [];
(async () => {
    const root = path.resolve(__dirname, '..'), base = 'https://roaminglille.com';
    const credentials = JSON.parse(await fs.readFile(path.join(root, 'var/private/hostinger-team-activation-20261024/team-credentials.json'), 'utf8'));
    secrets.push(credentials.password);
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const context = await browser.newContext({viewport: {width: 1440, height: 900}});
    const errors = [];
    await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method()) && !(url.origin === base && ['/equipe/connexion', '/equipe/deconnexion'].includes(url.pathname))) return route.abort();
        if (url.origin !== base && !(url.origin === 'https://s3.eu-west-3.amazonaws.com' && url.pathname.startsWith('/guestluckybucket/listings/'))) return route.abort();
        if (url.pathname.startsWith('/reservation/')) return route.abort();
        return route.continue();
    });
    try {
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(base + '/equipe/connexion');
        await page.locator('#username').fill(credentials.email);
        await page.locator('#password').fill(credentials.password);
        await Promise.all([page.waitForURL(base + '/'), page.locator('form[action="/equipe/connexion"] button').click()]);
        await page.waitForSelector('#booking-search-form');
        assert.equal(await page.locator('#booking-property option:not([value=""])').count(), 4);
        const report = {galleries: [], maintenanceActive: false, externalImagesDisplayedDirectly: true};
        for (const [slug, id, count] of [['roubaix', 2474, 34], ['ecrin-noir-croix', 2467, 55], ['l-elegante-douaisienne-4-chambres-2630', 2630, 41], ['lambersart', 2475, 21]]) {
            const response = await page.goto(base + '/property/' + slug);
            assert.equal(response.status(), 200);
            const images = page.locator('#propertyGallery .carousel-inner img');
            assert.equal(await images.count(), count, slug);
            const urls = await images.evaluateAll(nodes => nodes.map(node => node.getAttribute('src')));
            if (id === 2475) assert.ok(urls.every(url => url.startsWith('/uploads/')));
            else {
                const gallery = JSON.parse(await fs.readFile(path.join(root, 'var/guestlucky/photo-discovery/gallery-' + id + '.json'), 'utf8'));
                assert.deepEqual(urls, gallery.photos, 'GuestLucky gallery order must be reproduced');
            }
            assert.equal(await page.locator('#propertyGallery .property-gallery-thumbs button').count(), count);
            await page.waitForFunction(() => {const img = document.querySelector('#propertyGallery .carousel-item.active img'); return img && img.complete && img.naturalWidth > 0;});
            await page.locator('#propertyGallery .carousel-control-next').click();
            await page.waitForFunction(() => document.querySelectorAll('#propertyGallery .carousel-item')[1].classList.contains('active'));
            await page.waitForFunction(() => {const img = document.querySelector('#propertyGallery .carousel-item.active img'); return img.complete && img.naturalWidth > 0;});
            for (const width of [390, 1440]) {
                await page.setViewportSize({width, height: 900});
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, slug + ' overflow at ' + width);
            }
            if (id === 2467) await page.screenshot({path: path.join(root, 'var/backups/hostinger-photos-20261024/croix-desktop.png'), fullPage: false});
            report.galleries.push({slug, count, coverAndCarouselLoaded: true, mobileAndDesktop: true, lambersartPreserved: id === 2475});
        }
        const anonymous = await browser.newContext();
        try {
            const publicPage = await anonymous.newPage();
            for (const locale of ['fr', 'en']) {
                const response = await publicPage.goto(base + '/?_locale=' + locale);
                assert.equal(response.status(), 200);
                assert.equal(await publicPage.locator('.team-maintenance').count(), 1);
                assert.equal(await publicPage.locator('#booking-search-form').count(), 0);
            }
            const api = await anonymous.request.get(base + '/api/calendar');
            assert.equal(api.status(), 503);
            assert.equal((await api.json()).error, 'site_maintenance');
        } finally {await anonymous.close();}
        report.maintenanceActive = true;
        assert.deepEqual(errors, []);
        report.browserErrors = errors;
        await fs.writeFile(path.join(root, 'var/backups/hostinger-photos-20261024/GALLERIES-VERIFIED.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report));
    } finally {await browser.close();}
})().catch(error => {let message = error.message; for (const secret of secrets) message = message.split(secret).join('[private]'); console.error(message.replace(/https?:\/\/\S+/g, '[URL]')); process.exitCode = 1;});
