const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setup, checkBounds } = require('./verify-ui.cjs');
const origin = process.env.UI_ORIGIN || 'http://localhost:8081';
const output = path.resolve(process.env.UI_OUTPUT_DIR || path.join(__dirname, '../../.ui-checks/appearance-focus'));
fs.mkdirSync(output, { recursive: true });

async function assertPointerField(input) {
  const styles = await input.evaluate(e => ({ outline: getComputedStyle(e).outlineStyle, innerShadow: getComputedStyle(e).boxShadow, outerShadow: getComputedStyle(e.closest('[data-input-frame]')).boxShadow }));
  assert.equal(styles.outline, 'none', 'no inner input rectangle');
  assert.equal(styles.innerShadow, 'none', 'no second focus shadow');
  assert.notEqual(styles.outerShadow, 'none', 'one subtle halo around the complete field');
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER || 'msedge' });
  try {
    const { page, context, state } = await setup(browser, { width: 390, height: 844 });
    await page.goto(`${origin}/student/settings`, { waitUntil: 'networkidle' });
    const follow = page.getByRole('switch', { name: /^Follow device appearance/ });
    await follow.waitFor();
    await follow.click();
    await page.getByText('Currently using Light from your device.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('radio', { name: 'Light', exact: true }).count(), 0);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.getByText('Currently using Dark from your device.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('teachwise_theme')), 'system');
    await follow.click();
    await page.getByRole('radio', { name: 'Dark', exact: true }).waitFor();
    assert.equal(await page.getByRole('radio', { name: 'Dark', exact: true }).getAttribute('aria-checked'), 'true');
    await page.emulateMedia({ colorScheme: 'light' });
    assert.equal(await page.getByRole('radio', { name: 'Dark', exact: true }).getAttribute('aria-checked'), 'true');
    await page.getByRole('radio', { name: 'Light', exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('teachwise_theme')), 'light');
    await checkBounds(page, 'appearance phone');
    await page.screenshot({ path: path.join(output, 'appearance-manual-phone.png') });
    await follow.click();
    await page.setViewportSize({ width: 320, height: 740 });
    await page.getByRole('radio', { name: 'Filipino', exact: true }).click();
    await page.getByRole('switch', { name: /^Sundin ang itsura ng device/ }).waitFor();
    await checkBounds(page, 'appearance Filipino 320');
    assert.deepEqual(state.errors, []);
    await context.close();

    const desktop = await setup(browser, { width: 1366, height: 768 });
    const search = desktop.page.getByRole('textbox', { name: 'Search classes or teachers', exact: true });
    await search.click();
    await search.fill('Data');
    await assertPointerField(search);
    assert.equal(await desktop.page.evaluate(() => document.documentElement.dataset.twInputModality), 'pointer');
    await desktop.page.screenshot({ path: path.join(output, 'search-pointer.png') });
    await desktop.page.keyboard.press('Tab');
    await desktop.page.keyboard.press('Shift+Tab');
    assert.equal(await search.evaluate(e => document.activeElement === e), true);
    const keyboardFocus = await search.evaluate(e => { const frame = getComputedStyle(e.closest('[data-input-frame]')); return { width: frame.outlineWidth, style: frame.outlineStyle }; });
    assert.equal(keyboardFocus.style, 'solid');
    assert.ok(Number.parseFloat(keyboardFocus.width) >= 2, 'visible keyboard focus around the field');
    await desktop.page.screenshot({ path: path.join(output, 'search-keyboard.png') });
    await desktop.context.close();

    const auth = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
    await auth.addInitScript(() => localStorage.setItem('tw.onboarded', '1'));
    const login = await auth.newPage();
    await login.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await login.goto(`${origin}/login`, { waitUntil: 'networkidle' });
    const username = login.getByRole('textbox', { name: 'Username or ID number', exact: true });
    await username.click();
    await username.fill('ui-focus-check');
    await assertPointerField(username);
    assert.equal(await username.evaluate(e => getComputedStyle(e.closest('[data-input-frame]')).borderColor), 'rgb(165, 167, 218)');
    await login.getByLabel('Password', { exact: true }).click();
    await login.getByLabel('Password', { exact: true }).fill('sample-only');
    await assertPointerField(login.getByLabel('Password', { exact: true }));
    await login.screenshot({ path: path.join(output, 'login-pointer.png') });
    await checkBounds(login, 'login focus');
    await auth.close();
    console.log('PASS: automatic device theme, manual override, saved preference, Filipino wrapping, pointer focus, keyboard focus, login fields');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
