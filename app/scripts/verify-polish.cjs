// Interaction and failure-path checks use isolated fixtures, never main-database mutations.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setup, checkBounds, dashboard } = require('./verify-ui.cjs');
const output = process.env.UI_OUTPUT_DIR ? path.resolve(process.env.UI_OUTPUT_DIR) : path.resolve(__dirname, '../../.ui-checks/polish');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER || 'msedge' });
  const results = [];
  try {
    // The footer remains visible while a small-screen question/review scrolls.
    const first = await setup(browser, { width: 320, height: 568 });
    let { page, context } = first;
    await page.getByRole('button', { name: 'Start evaluation', exact: true }).first().click();
    await page.getByRole('radio', { name: '4, Very good', exact: true }).waitFor();
    const footer = page.getByTestId('evaluation-actions');
    let box = await footer.boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= 569, 'footer fits small phone');
    await page.getByRole('radio', { name: '5, Excellent', exact: true }).scrollIntoViewIfNeeded();
    box = await footer.boundingBox();
    assert.ok(box.y + box.height <= 569, 'footer stays visible after scrolling');
    await checkBounds(page, 'short phone');
    await page.screenshot({ path: path.join(output, 'evaluation-short-phone.png') });

    // Quota failures must be visible; retry must restore durable storage.
    await page.evaluate(() => {
      window.__storageSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key.startsWith('tw.draft')) throw new DOMException('Test quota failure', 'QuotaExceededError');
        return window.__storageSetItem.call(this, key, value);
      };
    });
    await page.getByRole('radio', { name: '4, Very good', exact: true }).click();
    await page.getByText('Could not save on this device. Keep this screen open.', { exact: true }).waitFor();
    assert.equal(await page.getByText('Draft saved on this device', { exact: true }).count(), 0);
    await page.evaluate(() => { Storage.prototype.setItem = window.__storageSetItem; });
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await page.getByText('Draft saved on this device', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Save & exit', exact: true }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('radio', { name: '4, Very good', exact: true }).waitFor();
    assert.equal(await page.getByRole('radio', { name: '4, Very good', exact: true }).getAttribute('aria-checked'), 'true');
    results.push({ stickyFooter: 'pass', storageFailure: 'pass', retrySave: 'pass', saveAndExit: 'pass', resume: 'pass' });
    await context.close();

    // A draft belonging to another account cannot appear as the current student's draft.
    ({ page, context } = await setup(browser, { width: 390, height: 844 }));
    await page.evaluate(() => {
      localStorage.setItem('tw.draft.902.901.1', JSON.stringify({ step: 0, ratings: { 1: 5 }, texts: {}, comment: 'Other account', savedAt: new Date().toISOString() }));
      localStorage.setItem('tw.drafts', '902.901.1');
    });
    await page.getByRole('button', { name: 'Start evaluation', exact: true }).first().click();
    await page.getByRole('radio', { name: '4, Very good', exact: true }).waitFor();
    assert.equal(await page.getByText('Continue where you left off?', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled(), true);
    results.push({ draftAccountIsolation: 'pass' });
    await context.close();

    // Failed chat messages remain available, can retry, and clearing requires a decision.
    ({ page, context } = await setup(browser, { width: 320, height: 568 }));
    let attempts = 0;
    let deletes = 0;
    await page.route('**/api/wise/messages', async route => {
      if (route.request().method() === 'DELETE') deletes++;
      if (route.request().method() !== 'POST') return route.fallback();
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Please retry' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ question: { id: 11, role: 'user', content: 'How do I evaluate?' }, reply: { id: 12, role: 'assistant', content: 'Open a class and choose Start evaluation.' } }) });
    });
    await page.getByRole('tab', { name: 'Ask Wise', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Message Professor Wise', exact: true });
    await input.waitFor();
    assert.equal(await page.getByRole('button', { name: 'Send', exact: true }).isDisabled(), true);
    await input.fill('How do I evaluate?');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Retry message', exact: true }).waitFor();
    assert.equal(await input.inputValue(), 'How do I evaluate?');
    await page.getByRole('button', { name: 'Retry message', exact: true }).click();
    await page.getByText('Open a class and choose Start evaluation.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Delete chat history', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(deletes, 0);
    await checkBounds(page, 'small phone chat');
    await page.screenshot({ path: path.join(output, 'wise-short-phone.png') });
    results.push({ chatPreservesFailedMessage: 'pass', chatRetry: 'pass', clearConfirmation: 'pass', smallPhoneChat: 'pass' });
    await context.close();

    // Recovery from an unavailable API, and a distinct offline explanation.
    ({ page, context } = await setup(browser, { width: 390, height: 844 }, 'error'));
    await page.route('**/api/student/dashboard', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboard) }));
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByText('Your classes to evaluate', { exact: true }).waitFor();
    results.push({ errorRetry: 'pass' });
    await context.close();
    ({ page, context } = await setup(browser, { width: 390, height: 844 }, 'offline'));
    await page.getByText('You’re offline', { exact: true }).waitFor();
    results.push({ offlineState: 'pass' });
    await context.close();

    fs.writeFileSync(path.join(output, 'polish-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
