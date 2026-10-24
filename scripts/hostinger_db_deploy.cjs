// Import ONLY the two reviewed SQL files through phpMyAdmin after user approval.
// No direct database credentials, ad-hoc SQL commands, or public admin endpoint.
const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
(async () => {
    const signin = process.env.HOSTINGER_PMA_LINK;
    delete process.env.HOSTINGER_PMA_LINK;
    if (!signin) throw new Error('Missing temporary phpMyAdmin link');
    const root = path.resolve(__dirname, '..');
    const release = path.join(root, 'var/deployment/roaminglille-20261023');
    const audit = path.join(root, 'var/backups/hostinger-predeploy-20261024');
    const journalFile = path.join(audit, 'DATABASE-DEPLOYMENT.json');
    const action = process.argv[2] || 'inspect';
    if (!['inspect','apply','provision-team'].includes(action)) throw new Error('Unknown action');
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    try {
        const page = await browser.newPage();
        await page.goto(signin, {waitUntil: 'domcontentloaded', timeout: 60000});
        await page.waitForTimeout(1500);
        if (!(await page.title()).includes('u587053106_roaming')) throw new Error('Incorrect database selected');
        async function importTab() {
            const link = page.locator('a[href*="database/import"],a[href*="database%2Fimport"]').first();
            if (!await link.count()) throw new Error('Database Import tab missing');
            await link.click();
            await page.waitForTimeout(700);
            return page.locator('form').filter({has: page.locator('input[type="file"][name="import_file"]')}).first();
        }
        let form = await importTab();
        if (action === 'inspect') {
            console.log(JSON.stringify({title: await page.title(),
                controls: await form.locator('input,select,button').evaluateAll(controls => controls.map(e => ({
                    tag:e.tagName,name:e.name,id:e.id,type:e.type,text:e.tagName==='BUTTON'?e.textContent.trim():undefined
                })))}));
            return;
        }
        if (action === 'provision-team') {
            const teamAudit=path.join(root,'var/backups/hostinger-team-activation-20261024');
            const teamPrivate=path.join(root,'var/private/hostinger-team-activation-20261024');
            const backup=await fs.readFile(path.join(teamAudit,'database/before-team-account.sql'),'utf8');
            if(!backup.includes('CREATE TABLE `team_user`') || /^INSERT INTO `team_user`/m.test(backup))
                throw new Error('Unexpected team-account baseline; inspect before any account change');
            const receipt=path.join(teamAudit,'TEAM-PROVISIONED.json');
            try { await fs.access(receipt); throw new Error('Provisioning already attempted; inspect receipt before repeating'); }
            catch(error) { if(error.code!=='ENOENT') throw error; }
            const file=path.join(teamPrivate,'03-team-admin.sql');
            const bytes=await fs.readFile(file);
            if(!bytes.includes('equipe@roaming.prod') || !bytes.includes('INSERT INTO team_user') || /^\s*(UPDATE|DELETE|DROP|TRUNCATE)\b/im.test(bytes.toString()))
                throw new Error('Unexpected account provisioning SQL');
            const result={email:'equipe@roaming.prod',role:'ROLE_ADMIN',sqlSHA256:hash(bytes),pending:true};
            await fs.writeFile(receipt,JSON.stringify(result,null,2));
            await form.locator('input[type="file"][name="import_file"]').setInputFiles(file);
            await form.locator('#buttonGo,button[type="submit"],input[type="submit"]').last().click();
            await page.waitForTimeout(1000);
            await page.waitForLoadState('networkidle',{timeout:120000});
            if((await page.locator('.alert-danger,.error').allTextContents()).some(t=>t.trim()))
                throw new Error('phpMyAdmin account import error; inspect before repeating');
            if(!(await page.locator('.alert-success,.success').allTextContents()).some(t=>/import|requ[eê]tes? ex[eé]cut[eé]|queries? executed/i.test(t)))
                throw new Error('Account import success not confirmed; inspect before repeating');
            result.pending=false;result.complete=true;
            await fs.writeFile(receipt,JSON.stringify(result,null,2));
            console.log(JSON.stringify({email:result.email,adminCreated:true,passwordNotLogged:true}));
            return;
        }
        const before = await fs.readFile(path.join(audit,'database/u587053106_roaming.sql'),'utf8');
        const prior = await fs.readFile(path.join(root,'var/backups/hostinger-predeploy-20261023/database/u587053106_roaming.sql'),'utf8');
        const canonical = sql => sql.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('--')).join('\n');
        if (canonical(before) !== canonical(prior)) throw new Error('Production baseline changed since rehearsal');
        const preflight = JSON.parse(await fs.readFile(path.join(audit,'FTPS-PREFLIGHT.json'),'utf8'));
        if (!preflight.fullBackupStillCurrent || Date.now()/1000-preflight.time > 3600) throw new Error('FTPS backup verification missing or expired');
        let journal;
        try { journal=JSON.parse(await fs.readFile(journalFile,'utf8')); }
        catch(error) { if(error.code!=='ENOENT') throw error; journal={database:'u587053106_roaming', imported:[],complete:false}; }
        for (const name of ['01-database-upgrade-reviewed.sql','02-reviewed-catalogue.sql']) {
            const file = path.join(release,name);
            const bytes = await fs.readFile(file);
            if (/^\s*(DROP|TRUNCATE|DELETE)\b/im.test(bytes.toString())) throw new Error('Unexpected destructive SQL');
            if (journal.imported.some(entry=>entry.file===name && entry.sha256===hash(bytes))) continue;
            // Never auto-repeat a timed-out import: a human/model must inspect its result first.
            if (journal.pending) throw new Error('An earlier import has an uncertain result; inspect before continuing');
            journal.pending={file:name,sha256:hash(bytes),startedAt:new Date().toISOString()};
            await fs.writeFile(journalFile,JSON.stringify(journal,null,2));
            form=await importTab();
            await form.locator('input[type="file"][name="import_file"]').setInputFiles(file);
            const button=form.locator('#buttonGo,button[type="submit"],input[type="submit"]').last();
            await button.click();
            await page.waitForTimeout(1000);
            await page.waitForLoadState('networkidle',{timeout:120000});
            const errors=await page.locator('.alert-danger, .error').allTextContents();
            if(errors.some(text=>text.trim())) throw new Error('phpMyAdmin reported an import error; details retained on local session only');
            const notices=await page.locator('.alert-success, .success').allTextContents();
            if(!notices.some(text=>/import|requ[eê]tes? ex[eé]cut[eé]|queries? executed/i.test(text))) {
                console.log(JSON.stringify({noticeTexts:notices.map(s=>s.trim().slice(0,250))}));
                throw new Error('Import success was not confirmed; do not repeat blindly');
            }
            journal.imported.push({file:name,sha256:hash(bytes),finishedAt:new Date().toISOString(),success:true});
            delete journal.pending;
            await fs.writeFile(journalFile,JSON.stringify(journal,null,2));
            console.log(JSON.stringify({file:name,imported:true}));
        }
        journal.complete=true;
        await fs.writeFile(journalFile,JSON.stringify(journal,null,2));
        console.log('Reviewed database deployment completed; export verification still required.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error.message.replace(/https?:\/\/\S+/g,'[private URL]')); process.exitCode=1; });
