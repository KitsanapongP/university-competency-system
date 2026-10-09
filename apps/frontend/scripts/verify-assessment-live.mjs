import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ASSESSMENT_PLAYWRIGHT_PATH || 'playwright');
const privatePath = process.env.ASSESSMENT_TEST_PRIVATE_CONFIG;
const relative = privatePath ? path.relative(os.tmpdir(), privatePath) : '..';
assert.ok(privatePath && path.isAbsolute(privatePath) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
const config = JSON.parse(await fs.readFile(privatePath, 'utf8'));
assert.ok(config.DB_NAME.endsWith('_test'));
const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), 'ucs-assessment-ui-'));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let failures = 0;
try {
  for (const language of ['th', 'en']) {
    for (const theme of ['light', 'dark']) {
      for (const width of [1440, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 } });
        context.setDefaultTimeout(5000);
        try {
          const login = await context.request.post('http://127.0.0.1:8081/api/v1/auth/login', {
            data: { email: config.ASSESSMENT_TEST_EMAIL, password: config.ASSESSMENT_TEST_PASSWORD },
          });
          assert.equal(login.status(), 200);
          await context.addInitScript(({ language, theme }) => {
            localStorage.setItem('language', language);
            localStorage.setItem('theme', theme);
          }, { language, theme });
          const page = await context.newPage();
          const errors = [];
          const generated = [];
          page.on('pageerror', () => errors.push('pageerror'));
          page.on('request', request => {
            if (request.method() === 'POST' && request.url().includes('/assessment-report/generate')) generated.push('generate');
          });
          await page.goto('http://127.0.0.1:3101', { waitUntil: 'networkidle', timeout: 60000 });
          if (width < 700) {
            const menu = page.getByRole('button', { name: language === 'en' ? 'Open menu' : 'เปิดเมนู', exact: true });
            if (await menu.count()) await menu.click();
            else await page.locator('.mobile-menu-btn').click();
          }
          await page.getByText(language === 'en' ? 'Profile' : 'ประวัติส่วนตัว', { exact: true }).filter({ visible: true }).first().click();
          const term = page.locator('section[aria-labelledby="learner-coop-title"] select');
          const panel = page.locator('section[aria-labelledby="learner-assessment-title"]');
          for (const semester of ['1', '2']) {
            const responseWait = page.waitForResponse(response => response.url().includes(`/assessment-report?semester=${semester}`));
            await term.selectOption(semester);
            const response = await responseWait;
            assert.equal(response.status(), 200);
            const state = (await response.json()).data;
            assert.equal(state.generation_state, 'failed');
            await panel.waitFor({ state: 'visible' });
            await panel.getByRole('button', { name: language === 'en' ? 'Create report' : 'สร้างรายงาน', exact: true }).waitFor();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
            assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark');
		    await panel.evaluate(element => element.scrollIntoView({ block: 'center' }));
            await panel.screenshot({ path: path.join(artifacts, `${language}-${theme}-${width}-semester-${semester}.png`) });
          }
          assert.deepEqual(errors, []);
          assert.deepEqual(generated, []);
          console.log(`PASS failed-report language=${language} theme=${theme} width=${width} semesters=1,2 automatic-generations=0`);
        } catch {
          failures += 1;
          console.error(`FAIL failed-report language=${language} theme=${theme} width=${width}; inspect local selectors/state without printing learner data`);
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}
console.log(`PRIVATE_UI_ARTIFACTS ${artifacts}`);
assert.equal(failures, 0, 'live failed-report UI verification did not pass');
