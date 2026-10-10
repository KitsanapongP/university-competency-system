import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), 'ucs-assessment-draft-'));
const server = await createServer({
    configFile: false, root: path.join(frontend, 'tests/assessment-draft'),
    esbuild: { jsx: 'automatic' },
    server: { host: '127.0.0.1', port: 3101, strictPort: true, fs: { allow: [frontend] } },
});
let browser;
try {
    await server.listen();
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const language of ['th', 'en']) {
        for (const theme of ['light', 'dark']) {
            for (const width of [1440, 390]) {
                const context = await browser.newContext({ viewport: { width, height: 1000 } });
                try {
                    const page = await context.newPage();
                    const errors = [];
                    page.on('pageerror', error => errors.push(error.message));
                    const title = language === 'th' ? 'ผลร่างที่ไม่ผ่านการตรวจสอบ' : 'Draft that did not pass validation';
                    for (const scenario of ['normal', 'malformed', 'stale', 'previous']) {
                        await page.goto(`http://127.0.0.1:3101/?language=${language}&theme=${theme}&scenario=${scenario}`);
                        const panel = page.getByRole('region', { name: title });
                        await panel.waitFor();
                        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
                        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark');
                        assert.equal(await panel.locator('h4').count(), 1);
                        const colors = await panel.evaluate(element => {
                            const style = getComputedStyle(element);
                            return { background: style.backgroundColor, color: style.color };
                        });
                        assert.notEqual(colors.background, 'rgba(0, 0, 0, 0)');
                        assert.equal(colors.background, theme === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
                        assert.notEqual(colors.color, colors.background);
                        if (scenario === 'malformed') {
                            assert.equal(await panel.locator('script,img').count(), 0);
                            assert.equal(await page.evaluate(() => window.draftExecuted), undefined);
                            await panel.locator('pre').waitFor();
                        }
                        if (scenario === 'stale') assert.equal(await panel.locator('pre').count(), 0);
                        if (scenario === 'previous') assert.equal(await panel.locator('details[open]').count(), 0);
                        if (scenario === 'normal') await panel.screenshot({ path: path.join(artifacts, `${language}-${theme}-${width}.png`) });
                    }
                    assert.deepEqual(errors, []);
                    console.log(`PASS draft language=${language} theme=${theme} width=${width} cases=4`);
                } finally { await context.close(); }
            }
        }
    }
    console.log(`SCREENSHOTS ${artifacts}`);
} finally {
    await browser?.close();
    await server.close();
}
