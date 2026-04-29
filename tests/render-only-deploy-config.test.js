const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

test('deployment scripts keep Render and do not expose Cloudflare commands', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const scriptText = Object.entries(packageJson.scripts || {})
        .map(([name, command]) => `${name} ${command}`)
        .join('\n');

    assert.equal(scriptText.includes('cloudflare'), false);
    assert.equal(scriptText.includes('cloudflared'), false);
    assert.equal(scriptText.includes('trycloudflare'), false);
    assert.equal(fs.existsSync(path.join(repoRoot, 'render.yaml')), true);
});

test('Cloudflare helper files are not part of the main repo anymore', () => {
    const removedPaths = [
        'docs/LOCAL_PUBLIC_HOSTING_WITH_CLOUDFLARE.md',
        'scripts/Get-Cloudflared.ps1',
        'scripts/Start-CloudflareTunnel.ps1',
        'scripts/Start-LocalPublicSite.ps1',
        'scripts/Get-LocalPublicStatus.ps1',
        'scripts/Stop-LocalPublicStack.ps1'
    ];

    for (const relativePath of removedPaths) {
        assert.equal(fs.existsSync(path.join(repoRoot, relativePath)), false, relativePath);
    }
});
