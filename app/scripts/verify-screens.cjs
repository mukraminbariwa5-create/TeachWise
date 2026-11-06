// Read-only route/layout audit against the normal local API. No form saves or message sends.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkBounds } = require('./verify-ui.cjs');
const origin = process.env.UI_ORIGIN || 'http://localhost:8081';
const output = process.env.UI_OUTPUT_DIR ? path.resolve(process.env.UI_OUTPUT_DIR) : path.resolve(__dirname, '../../.ui-checks/screens');
fs.mkdirSync(output, { recursive: true });
const roles = [
  { role: 'student', login: 'aisha', routes: ['', 'history', 'wise', 'account', 'settings', 'profile', 'help'] },
  { role: 'teacher', login: 'lsantos', routes: ['', 'feedback', 'report', 'wise', 'account', 'settings', 'profile'] },
  { role: 'admin', login: 'admin', routes: ['', 'users', 'academics', 'evaluation', 'reports', 'requests', 'school', 'settings', 'activity', 'transfers', 'wise', 'profile', 'account', 'help'] },
  { role: 'dean', base: 'admin', login: 'ccsdean', routes: ['', 'users', 'academics', 'evaluation', 'ids', 'reports', 'requests', 'wise', 'profile', 'account', 'settings', 'help'] },
  { role: 'platform', login: 'owner', routes: ['', 'schools', 'messages', 'errors', 'settings', 'profile'] },
];
const requestedRoles = process.env.UI_ROLES?.split(',');
const requestedRoutes = process.env.UI_ROUTES?.split(',');
const configs = process.env.UI_CONFIGS ? JSON.parse(process.env.UI_CONFIGS) : process.env.UI_WIDTHS ? process.env.UI_WIDTHS.split(',').map(Number).map(width => ({ width, height: width < 768 ? 844 : 900, dark: false, lang: 'en' })) : process.env.UI_EXTENDED === '1'
  ? [{ width: 768, height: 1024, dark: false, lang: 'en' }, { width: 1920, height: 1080, dark: false, lang: 'en' }, { width: 390, height: 844, dark: true, lang: 'fil' }]
  : [{ width: 320, height: 740, dark: false, lang: 'en' }, { width: 1366, height: 768, dark: false, lang: 'en' }, { width: 390, height: 844, dark: true, lang: 'fil' }];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER || 'msedge' });
  const results = [];
  try {
    for (const item of roles.filter(item => !requestedRoles || requestedRoles.includes(item.role))) {
      const auth = await browser.newContext();
      const loginResponse = await auth.request.post(`${origin}/api/auth/login`, { data: { login: item.login, password: 'password' } });
      assert.equal(loginResponse.status(), 200, `${item.role} login`);
      const { token } = await loginResponse.json();
      await auth.close();
      console.log(`Checking ${item.role} routes`);
      for (const config of configs) {
        const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, reducedMotion: 'reduce' });
        await context.addInitScript(({ token, config }) => {
          localStorage.setItem('teachwise_token', token);
          localStorage.setItem('tw.onboarded', '1');
          localStorage.setItem('tw.tourDone', '1');
          localStorage.setItem('tw.lang', config.lang);
          localStorage.setItem('teachwise_theme', config.dark ? 'dark' : 'light');
          window.print = () => {};
        }, { token, config });
        const page = await context.newPage();
        const base = item.base || item.role;
        const errors = [];
        const failedApi = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) failedApi.push({ path: new URL(r.url()).pathname, status: r.status() }); });
        const routes = requestedRoutes ? item.routes.filter(route => requestedRoutes.includes(route || 'home')) : config.lang === 'fil' && process.env.UI_EXTENDED !== '1' ? ['', 'settings'] : item.routes;
        for (const route of routes) {
          errors.length = 0;
          failedApi.length = 0;
          const label = `${item.role}-${route || 'home'}-${config.width}-${config.lang}`;
          try {
            await page.goto(`${origin}/${base}${route ? `/${route}` : ''}`, { waitUntil: 'networkidle', timeout: 45000 });
            await checkBounds(page, label);
            assert.deepEqual(errors, [], 'no runtime errors');
            assert.deepEqual(failedApi, [], 'no API failures');
            assert.equal(await page.getByText('That didn’t load', { exact: true }).count(), 0, 'page loaded');
            if (route === 'profile') {
              const mascot = page.getByTestId('profile-mascot');
              await mascot.waitFor({ state: 'visible' });
              const card = await page.getByTestId('profile-identity').boundingBox();
              const face = await mascot.boundingBox();
              assert.ok(face.x >= card.x && face.x + face.width <= card.x + card.width + 1, 'Profile mascot fits its card');
              const images = mascot.locator('img');
              assert.ok(await images.count(), 'Profile mascot image exists');
              assert.ok(await images.evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0)), 'Profile mascot assets loaded');
            }
            if (config.width < 768 && base !== 'admin') {
              assert.equal(await page.getByRole('button', { name: config.lang === 'fil' ? 'Buksan ang navigation' : 'Open navigation', exact: true }).count(), 0, 'Only school administrators and deans have the mobile drawer');
            }
            if (config.width < 768 && route === '' && base === 'admin') {
              const openNavigation = config.lang === 'fil' ? 'Buksan ang navigation' : 'Open navigation';
              await page.getByRole('button', { name: openNavigation, exact: true }).click();
              const dialog = page.getByRole('dialog');
              await dialog.getByRole('heading', { name: 'Navigation', exact: true }).waitFor();
              await checkBounds(page, `${label} navigation`);
              assert.ok(await dialog.getByRole('menuitem').count() >= 3, 'Phone exposes page navigation');
              const drawer = await page.getByTestId('mobile-navigation-drawer').boundingBox();
              assert.equal(drawer.x, 0, 'Phone drawer starts at the left edge');
              assert.equal(drawer.y, 0, 'Phone drawer starts at the top edge');
              assert.equal(drawer.height, config.height, 'Phone drawer is full height');
              if (config.lang === 'en') for (const name of ['Account', 'Profile', 'Help & feedback', 'Ask Wise']) assert.equal(await dialog.getByRole('menuitem', { name, exact: true }).count(), 0, 'Existing screen and bottom-tab links are not duplicated');
              if (base === 'admin' && config.lang === 'en') {
                await dialog.getByRole('menuitem', { name: 'Reports', exact: true }).click();
                await page.waitForURL('**/admin/reports');
                await dialog.waitFor({ state: 'hidden' });
                await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
                assert.equal(await page.getByRole('menuitem', { name: 'Approved IDs', exact: true }).count(), item.role === 'dean' ? 1 : 0, 'Phone navigation respects admin scope');
              }
              await page.screenshot({ path: path.join(output, `${label}-navigation.png`) });
              await page.getByRole('dialog').getByRole('menuitem', { name: 'Settings', exact: true }).click();
              await page.waitForURL(`**/${base}/settings`);
              await page.getByRole('dialog').waitFor({ state: 'hidden' });
              assert.deepEqual(errors, [], 'navigation has no runtime errors');
              await page.goto(`${origin}/${base}`, { waitUntil: 'networkidle' });
            }
            await page.screenshot({ path: path.join(output, `${label}.png`) });
            results.push({ screen: label, result: 'pass' });
          } catch (e) {
            await page.screenshot({ path: path.join(output, `${label}-failure.png`) }).catch(() => {});
            results.push({ screen: label, result: 'fail', error: e.message });
          }
        }
        // Export a full real teacher report using the browser's print rendering.
        if (item.role === 'teacher' && config.width === 1366) {
          await page.goto(`${origin}/print/report`, { waitUntil: 'networkidle' });
          await page.getByText('Faculty Evaluation Report', { exact: true }).waitFor();
          await page.waitForTimeout(600);
          await page.pdf({ path: path.join(output, 'teacher-report.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
          results.push({ screen: 'teacher-report-print-export', result: 'pass' });
        }
        await context.close();
        fs.writeFileSync(path.join(output, 'screen-results.json'), JSON.stringify(results, null, 2));
        console.log(`${item.role}: ${config.width}px ${config.lang} checked`);
      }
    }
    fs.writeFileSync(path.join(output, 'screen-results.json'), JSON.stringify(results, null, 2));
    const failures = results.filter(r => r.result === 'fail');
    console.log(JSON.stringify({ passed: results.length - failures.length, failures }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
