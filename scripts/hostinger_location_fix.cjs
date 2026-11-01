// Apply the single reviewed coordinates correction, keeping full before/after exports.
const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
(async () => {
    const signin = process.env.HOSTINGER_PMA_LINK;
    delete process.env.HOSTINGER_PMA_LINK;
    if (!signin) throw new Error('Missing private phpMyAdmin sign-on');
    const root = path.resolve(__dirname, '..');
    const audit = path.join(root, 'var/backups/hostinger-map-lille-20261028');
    const receipt = path.join(audit, 'APPLIED.json');
    try { await fs.access(receipt); throw new Error('Previous attempt exists; inspect before repeating'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    execFileSync('python', [path.join(__dirname, 'verify_map_location_export.py')], {cwd: root});
    const sqlPath = path.join(audit, 'fix-lille-coordinates.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    if ((sql.match(/UPDATE property/g) || []).length !== 1 || !sql.includes('SET latitude = 50.623037, longitude = 3.056473') || !sql.includes('AND latitude IS NULL AND longitude IS NULL') || /\b(DELETE|DROP|ALTER|INSERT|TRUNCATE)\b/i.test(sql)) throw new Error('SQL scope mismatch');
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const journal = {providerId: 2650, columns: ['latitude', 'longitude'], sqlSHA256: crypto.createHash('sha256').update(sql).digest('hex'), startedAt: new Date().toISOString()};
    try {
        const page = await browser.newPage({acceptDownloads: true});
        await page.goto(signin, {waitUntil: 'networkidle', timeout: 60000});
        if (!(await page.title()).includes('u587053106_roaming')) throw new Error('Wrong database selected');
        await page.locator('a[href*="database/import"],a[href*="database%2Fimport"]').first().click();
        const form = page.locator('form').filter({has: page.locator('input[type="file"][name="import_file"]')}).first();
        await form.locator('input[type="file"][name="import_file"]').setInputFiles(sqlPath);
        journal.pending = true;
        await fs.writeFile(receipt, JSON.stringify(journal, null, 2));
        await form.locator('#buttonGo,button[type="submit"],input[type="submit"]').last().click();
        await page.waitForLoadState('networkidle');
        const errors = await page.locator('.alert-danger,.error').allTextContents();
        if (errors.some(text => text.trim())) {
            await fs.writeFile(path.join(audit, 'import-errors.txt'), errors.join('\n'));
            throw new Error('Database import error retained in private audit; do not repeat blindly');
        }
        const notices = await page.locator('.alert-success,.success').allTextContents();
        journal.importNoticeConfirmed = notices.some(text => /import|requ[eê]tes? ex[eé]cut[eé]|queries? executed/i.test(text));
        await fs.writeFile(receipt, JSON.stringify(journal, null, 2));
        await page.locator('a[href*="database/export"],a[href*="database%2Fexport"]').first().click();
        const quick = page.locator('input[name="quick_or_custom"][value="quick"]');
        if (await quick.count()) await quick.check();
        const format = page.locator('select[name="what"]');
        if (await format.count()) await format.selectOption('sql');
        const exportForm = page.locator('form').filter({has: page.locator('#buttonGo')}).first();
        const downloaded = page.waitForEvent('download', {timeout: 60000});
        await exportForm.locator('input[type="submit"],button[type="submit"]').last().click();
        await (await downloaded).saveAs(path.join(audit, 'database-after.sql'));
        const verified = JSON.parse(execFileSync('python', [path.join(__dirname, 'verify_map_location_export.py'), 'after'], {cwd: root, encoding: 'utf8'}));
        journal.pending = false; journal.importConfirmed = true;
        journal.verification = verified; journal.finishedAt = new Date().toISOString();
        await fs.writeFile(receipt, JSON.stringify(journal, null, 2));
        console.log(JSON.stringify({importConfirmed: true, ...verified}));
    } finally { await browser.close(); }
})().catch(error => { console.error(error.message.replace(/https?:\/\/\S+/g, '[private URL]')); process.exitCode = 1; });
