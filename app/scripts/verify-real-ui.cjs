// Real API sign-in and dashboard verification; submission is disabled by default.
// Enable UI_SUBMIT_TO_COPY=1 only for the private recovered copy described in docs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.UI_ORIGIN || 'http://localhost:8081';
const output = process.env.UI_OUTPUT_DIR ? path.resolve(process.env.UI_OUTPUT_DIR) : path.resolve(__dirname, '../../.ui-checks/real-backend');
const submitToCopy = process.env.UI_SUBMIT_TO_COPY === '1';
assert.ok(!submitToCopy || process.env.UI_ORIGIN, 'Set UI_ORIGIN explicitly to a private database-copy preview before enabling test submission.');
fs.mkdirSync(output, { recursive: true });

async function bounds(page, label) {
  await page.waitForTimeout(600);
  const bad = await page.evaluate(() => [...document.querySelectorAll('[role="button"], [role="tab"], input, textarea')].filter(e => {
    const r = e.getBoundingClientRect();
    return r.width && r.height && r.top < innerHeight && r.bottom > 0 && (r.left < -1 || r.right > innerWidth + 1) && getComputedStyle(e).visibility !== 'hidden';
  }).map(e => e.getAttribute('aria-label') || e.textContent?.slice(0, 50)));
  assert.deepEqual(bad, [], label);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER || 'msedge' });
  const results = [];
  try {
    for (const [role, login] of [['student', 'aisha'], ['teacher', 'lsantos'], ['admin', 'admin'], ['platform', 'owner']]) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        localStorage.setItem('tw.onboarded', '1');
        localStorage.setItem('tw.tourDone', '1');
        localStorage.setItem('teachwise_theme', 'light');
      });
      const page = await context.newPage();
      const errors = [];
      const failed = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) failed.push({ status: r.status(), path: new URL(r.url()).pathname }); });
      await page.goto(`${origin}/login`, { waitUntil: 'networkidle' });
      await page.getByRole('textbox', { name: 'Username or ID number', exact: true }).fill(login);
      await page.getByLabel('Password', { exact: true }).fill('password');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL(`**/${role}`, { timeout: 30000 });
      const dashboardResponse = await page.request.get(`${origin}/api/${role === 'platform' ? 'platform/overview' : `${role}/dashboard`}`, { headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('teachwise_token') || sessionStorage.getItem('teachwise_token'))}` } });
      assert.equal(dashboardResponse.status(), 200, `${role} dashboard reads existing data`);
      const data = await dashboardResponse.json();
      await bounds(page, `${role} laptop`);
      await page.screenshot({ path: path.join(output, `${role}-laptop.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      await bounds(page, `${role} phone`);
      await page.screenshot({ path: path.join(output, `${role}-phone.png`) });
      if (role === 'student' && submitToCopy) {
        assert.equal(data.period?.is_open, true, 'Copied evaluation period is open for the integration test');
        const before = data.progress.completed;
        const pending = data.teachers.find(t => t.status === 'pending');
        assert.ok(pending, 'The copied student has a pending class');
        // Exercise UI navigation and the server-provided form, without intercepting requests.
        if (await page.getByRole('button', { name: 'Dismiss tip', exact: true }).count()) await page.getByRole('button', { name: 'Dismiss tip', exact: true }).click();
        await page.getByRole('button', { name: 'Start evaluation', exact: true }).first().click();
        await page.waitForURL('**/student/evaluate/*');
        let answered = 0;
        while (await page.getByRole('button', { name: 'Next', exact: true }).count()) {
          const choices = page.getByRole('radio');
          await choices.first().waitFor();
          const chosen = choices.filter({ hasText: /^4\s/ });
          if (await chosen.count()) await chosen.first().click();
          else await choices.nth(Math.min(3, await choices.count() - 1)).click();
          await page.getByRole('button', { name: 'Next', exact: true }).click();
          answered++;
          assert.ok(answered < 100, 'The question flow terminates');
        }
        await page.getByRole('textbox', { name: 'Comments (optional, anonymous)', exact: true }).fill('UI integration check on the recovered database copy.');
        await page.getByRole('button', { name: 'Review answers', exact: true }).click();
        await page.getByText('Review your answers', { exact: true }).waitFor();
        await bounds(page, 'real review phone');
        await page.screenshot({ path: path.join(output, 'student-review-phone.png') });
        const sent = page.waitForResponse(r => r.url().endsWith('/api/student/evaluations') && r.request().method() === 'POST');
        await page.getByRole('button', { name: 'Submit anonymously', exact: true }).click();
        assert.equal((await sent).status(), 201, 'The real API persists the evaluation');
        await page.getByText('Evaluation sent', { exact: true }).first().waitFor();
        await page.getByRole('button', { name: 'Back to Home', exact: true }).click();
        await page.getByText(`${before + 1} of ${data.progress.total} completed`, { exact: true }).filter({ visible: true }).first().waitFor();
        const token = await page.evaluate(() => localStorage.getItem('teachwise_token') || sessionStorage.getItem('teachwise_token'));
        const after = await (await page.request.get(`${origin}/api/student/dashboard`, { headers: { Authorization: `Bearer ${token}` } })).json();
        assert.equal(after.progress.completed, before + 1);
        assert.equal(after.teachers.find(t => t.offering_id === pending.offering_id).status, 'completed');
        await page.getByRole('tab', { name: 'History', exact: true }).click();
        await page.getByText(pending.teacher.name, { exact: true }).filter({ visible: true }).first().waitFor();
        results.push({ actualSubmissionToCopy: 'pass', questions: answered, progressUpdated: 'pass', historyUpdated: 'pass' });
      }
      assert.deepEqual(errors, [], `${role} runtime errors`);
      assert.deepEqual(failed, [], `${role} API errors`);
      results.push({ role, realLogin: 'pass', realDashboard: 'pass', laptop: 'pass', phone: 'pass' });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
