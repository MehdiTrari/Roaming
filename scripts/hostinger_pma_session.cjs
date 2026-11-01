// A temporary SSO link is read from stdin (no echo), passed only in memory to
// the existing phpMyAdmin helper. Never persist it or place it in command args.
const readline = require('node:readline');
const {spawn} = require('node:child_process');
const path = require('node:path');
const mode = process.argv[2];
if (!['export', 'location-fix'].includes(mode)) throw new Error('Unknown mode');
if (!process.stdin.isTTY) throw new Error('A protected interactive pipe is required');
process.stdin.setRawMode(true);
const input = readline.createInterface({input: process.stdin, terminal: false});
input.once('line', link => {
    input.close();
    const url = new URL(link);
    if (url.protocol !== 'https:' || !/(^|\.)hostinger\.com$|(^|\.)hstgr\.io$/.test(url.hostname)) throw new Error('Unexpected sign-on host');
    const script = mode === 'export' ? 'hostinger_db_export.cjs' : 'hostinger_location_fix.cjs';
    const child = spawn(process.execPath, [path.join(__dirname, script), ...process.argv.slice(3)], {
        env: {...process.env, HOSTINGER_PMA_LINK: link}, stdio: ['ignore', 'pipe', 'pipe']
    });
    for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) stream.on('data', data => output.write(data.toString().split(link).join('[private sign-on]')));
    child.on('exit', code => process.exit(code ?? 1));
});
console.log('Waiting for private sign-on through stdin.');
