// Isolated student navigation checks: no real account writes.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { setup, checkBounds } = require('./verify-ui.cjs');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER || 'msedge' });
  try {
    const { page, context, state } = await setup(browser, { width: 320, height: 568 });
    const noDrawer = async () => {
      assert.equal(await page.getByRole('button', { name: 'Open navigation', exact: true }).count(), 0);
      assert.equal(await page.getByTestId('mobile-navigation-drawer').count(), 0);
    };
    await noDrawer();
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await page.waitForURL('**/student/history');
    await page.setViewportSize({ width: 768, height: 900 });
    await page.getByTestId('app-navigation').waitFor({ state: 'visible' });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.getByRole('tab', { name: 'Account', exact: true }).click();
    await page.waitForURL('**/student/account');
    await page.getByRole('button', { name: /^Settings/ }).click();
    await page.waitForURL('**/student/settings');
    await checkBounds(page, 'short-phone settings through account');
    await noDrawer();
    await page.getByRole('tab', { name: 'Ask Wise', exact: true }).click();
    const composer = page.getByRole('textbox', { name: 'Message Professor Wise', exact: true });
    await composer.waitFor();
    await checkBounds(page, 'short-phone chat');
    const input = await composer.boundingBox();
    assert.ok(input.y >= 0 && input.y + input.height <= 568);
    await noDrawer();
    assert.deepEqual(state.errors, []);
    await context.close();
    console.log('Student navigation passed: no hamburger/drawer, bottom tabs, account settings, resizing and chat composer.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
