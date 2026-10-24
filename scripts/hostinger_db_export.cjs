// Read-only phpMyAdmin inspection/export. Sign-on URL arrives through the parent
// process environment, never command arguments, files or logs.
const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
    const signin = process.env.HOSTINGER_PMA_LINK;
    delete process.env.HOSTINGER_PMA_LINK;
    if (!signin) throw new Error('Missing private phpMyAdmin sign-on link');
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    try {
        const page = await browser.newPage({acceptDownloads: true});
        await page.goto(signin, {waitUntil: 'domcontentloaded', timeout: 60000});
        await page.waitForTimeout(2000);
        const exportLink = page.locator('a[href*="database/export"], a[href*="database%2Fexport"]').first();
        if (!await exportLink.count()) {
            console.log(JSON.stringify({title: await page.title(),
                headings: await page.locator('h1,h2').allTextContents(),
                exportLinks: await page.locator('a[href*="export"]').allTextContents()}));
            throw new Error('Database export tab not found; no database operation performed');
        }
        await exportLink.click();
        await page.waitForLoadState('domcontentloaded');
        if (process.argv[2] === 'inspect') {
            console.log(JSON.stringify({title: await page.title(),
                forms: await page.locator('form').evaluateAll(forms => forms.map(form => ({
                    id: form.id,
                    controls: [...form.querySelectorAll('input,select,button')].map(e => ({tag:e.tagName,name:e.name,id:e.id,type:e.type, text:e.tagName==='BUTTON'?e.textContent.trim():undefined}))
                })))}));
            return;
        }
        const output = process.argv[2];
        if (!output) throw new Error('Output SQL path required');
        try { await fs.access(output); throw new Error('Refusing to overwrite an existing database backup'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        const form = page.locator('form').filter({has: page.locator('#buttonGo')}).first();
        const quick = page.locator('input[name="quick_or_custom"][value="quick"]');
        if (await quick.count()) await quick.check();
        const format = page.locator('select[name="what"]');
        if (await format.count()) await format.selectOption('sql');
        const submit = form.locator('input[type="submit"], button[type="submit"]').last();
        const downloadPromise = page.waitForEvent('download', {timeout: 120000});
        await submit.click();
        const download = await downloadPromise;
        await fs.mkdir(path.dirname(output), {recursive: true});
        await download.saveAs(output);
        const sql = await fs.readFile(output, 'utf8');
        if (!sql.includes('CREATE TABLE') || !sql.includes('property') || !sql.includes('INSERT INTO'))
            throw new Error('Export does not contain expected structure and data; inspect locally before use');
        console.log(JSON.stringify({exported: true, bytes: Buffer.byteLength(sql),
            createTables: (sql.match(/CREATE TABLE/g)||[]).length,
            insertStatements: (sql.match(/INSERT INTO/g)||[]).length,
            sha256: require('node:crypto').createHash('sha256').update(sql).digest('hex')}));
    } finally { await browser.close(); }
})().catch(error => { console.error(error.message.replace(/https?:\/\/\S+/g, '[private URL]')); process.exitCode=1; });
