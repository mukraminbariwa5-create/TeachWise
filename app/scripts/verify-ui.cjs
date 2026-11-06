// Run against Expo web: PLAYWRIGHT_MODULE can point to an existing Playwright install.
// All API responses are isolated fixtures; this never writes to the school database.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.UI_ORIGIN || 'http://localhost:8081';
const output = process.env.UI_OUTPUT_DIR ? path.resolve(process.env.UI_OUTPUT_DIR) : path.resolve(__dirname, '../../.ui-checks/fixtures');
fs.mkdirSync(output, { recursive: true });

const student = { id: 901, name: 'Aisha Tan', initials: 'AT', username: 'aisha', id_number: 'DEMO-901', role: 'student', email: null, department: 'Computing Studies', section: { id: 1, label: 'BSIT 3-B' } };
const school = { id: 901, name: 'Demo State University', short_name: 'DSU', code: 'DEMO', location: null, logo_url: null, status: 'active', settings: { peer_evaluation: true, min_responses: 5, setup_completed: true, term_label: 'semester', scale: ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'], scale_fil: [], support_email: null, dpo_email: null } };
const period = { id: 901, name: 'Midterm', type: 'student', opens_at: '2026-10-01T00:00:00Z', closes_at: '2026-11-15T23:59:59Z', is_open: true };
const teachers = [
  ['Ramon Dela Cruz', 'RD', 'IT 301', 'Data Communications', 'pending'],
  ['Liza Santos', 'LS', 'IT 302', 'Web Systems', 'pending'],
  ['Abdul Hassan', 'AH', 'IT 303', 'Information Assurance', 'completed'],
  ['Grace Lim', 'GL', 'IT 304', 'Database Management', 'completed'],
].map(([name, initials, code, subject, status], i) => ({ offering_id: i + 1, teacher: { id: i + 1, name: `Prof. ${name}`, initials, department: 'Computing Studies' }, subject: { code, name: subject }, schedule: 'Mon / Wed', status }));
const questions = [
  ['Mastery of subject', 'The teacher explains lessons clearly and with confidence.'],
  ['Teaching clarity', 'The teacher makes difficult topics easy to understand.'],
  ['Use of examples', 'The teacher provides helpful examples.'],
  ['Class management', 'The teacher manages class time well.'],
  ['Overall teaching', 'The teacher supports my learning.'],
].map(([category, text], i) => ({ id: i + 1, category, text, type: 'rating' }));
const scale = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' };
const dashboard = { student, period, teachers, subjects: teachers.map(t => ({ ...t.subject, units: 3 })), progress: { completed: 2, total: 4, percent: 50 } };
const settings = { tips: false, seen_tips: [], notify: { periods: true, reminders: true, account: true } };

async function setup(browser, viewport, scenario = 'normal', dark = false) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: dark ? 'dark' : 'light' });
  await context.addInitScript(({ dark }) => {
    localStorage.setItem('teachwise_token', 'isolated-ui-fixture');
    localStorage.setItem('tw.onboarded', '1');
    localStorage.setItem('tw.tourDone', '1');
    localStorage.setItem('teachwise_theme', dark ? 'dark' : 'light');
  }, { dark });
  const state = { submitted: null, errors: [], unknown: [] };
  const page = await context.newPage();
  page.on('pageerror', e => state.errors.push(e.message));
  await page.route('**/api/**', async route => {
    const req = route.request();
    const endpoint = new URL(req.url()).pathname.replace(/^\/api/, '');
    if (endpoint === '/student/dashboard' && scenario === 'error') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporarily unavailable' }) });
    if (endpoint === '/student/dashboard' && scenario === 'offline') return route.abort('failed');
    let body;
    if (endpoint === '/auth/me') body = { user: student, school, settings, token_expires_at: null };
    else if (endpoint === '/app/info') body = { school_name: school.name, school, latest_version: '1.0.0', min_version: '1.0.0' };
    else if (endpoint === '/student/dashboard') body = scenario === 'empty' ? { ...dashboard, period: null, teachers: [], subjects: [], progress: { completed: 0, total: 0, percent: 0 } } : scenario === 'closed' ? { ...dashboard, period: { ...period, is_open: false } } : scenario === 'upcoming' ? { ...dashboard, period: { ...period, opens_at: '2099-12-07T00:00:00Z', closes_at: '2099-12-09T23:59:59Z', is_open: false } } : dashboard;
    else if (/^\/student\/offerings\/\d+\/form$/.test(endpoint)) body = { offering: { id: 1, subject: teachers[0].subject, section: 'BSIT 3-B', schedule: null }, teacher: teachers[0].teacher, period, already_submitted: false, scale, questions };
    else if (endpoint === '/student/evaluations') { state.submitted = req.postDataJSON(); body = { message: 'Evaluation submitted' }; }
    else if (endpoint === '/student/history') body = { data: teachers.slice(2).map((t, i) => ({ id: i + 1, teacher: t.teacher, subject: t.subject, period: 'Midterm', overall_rating: 4, submitted_at: '2026-11-03T09:00:00Z' })) };
    else if (endpoint === '/notifications') body = { unread: 0, data: [] };
    else if (endpoint === '/wise/messages') body = { greeting: 'Hi Aisha! Ask me about evaluations.', tip: '', suggestions: ['How do I evaluate?', 'Are my answers anonymous?'], messages: [] };
    else if (endpoint === '/me/settings') body = { settings };
    else if (endpoint === '/auth/sessions') body = { data: [] };
    else if (endpoint === '/me') body = { user: student, school, settings };
    else { state.unknown.push(endpoint); body = {}; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${origin}/student`, { waitUntil: 'networkidle' });
  if (scenario === 'error') await page.getByText('That didn’t load', { exact: true }).waitFor();
  else if (scenario === 'offline') await page.getByText('You’re offline', { exact: true }).waitFor();
  else await page.getByText('Your classes to evaluate', { exact: true }).waitFor();
  return { context, page, state };
}

async function checkBounds(page, label) {
  // Allow the app's short entrance animation to settle before measuring or capturing.
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => {
    const w = window.innerWidth;
    return [...document.querySelectorAll('[role="button"], [role="tab"], [role="radio"], input, textarea')]
      .map(e => ({ text: e.getAttribute('aria-label') || e.textContent?.slice(0, 60), r: e.getBoundingClientRect(), hidden: !e.getClientRects().length, horizontalScroll: (() => { let p = e.parentElement; while (p) { const style = getComputedStyle(p); if (['auto', 'scroll'].includes(style.overflowX) && p.scrollWidth > p.clientWidth + 1) return true; p = p.parentElement; } return false; })() }))
      .filter(({ r, hidden, horizontalScroll }) => !hidden && !horizontalScroll && r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && (r.left < -1 || r.right > w + 1))
      .map(({ text, r }) => ({ text, left: r.left, right: r.right, w }));
  });
  assert.deepEqual(overflow, [], `${label}: controls must fit viewport`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${label}: no horizontal page overflow`);
}

module.exports = { setup, checkBounds, dashboard };

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER || 'msedge' });
  const results = [];
  try {
    for (const width of (process.env.UI_WIDTHS ? process.env.UI_WIDTHS.split(',').map(Number) : [320, 390, 768, 1024, 1100, 1366, 1920])) {
      const { page, context, state } = await setup(browser, { width, height: width < 768 ? 844 : width === 1920 ? 1080 : 768 });
      if (width < 768) {
        for (const name of ['Home', 'History', 'Ask Wise', 'Alert', 'Account']) await page.getByRole('tab', { name, exact: true }).waitFor();
        const head = await page.getByRole('tab', { name: 'Ask Wise', exact: true }).boundingBox();
        assert.ok(head.width >= 44 && head.height >= 44, 'Wise is a usable touch target');
      } else {
        assert.equal(await page.getByRole('tab', { name: 'Home', exact: true }).count(), 0, 'desktop uses sidebar');
        await page.getByRole('menuitem', { name: 'Home', exact: true }).waitFor();
      }
      await checkBounds(page, `home ${width}`);
      await page.screenshot({ path: path.join(output, `home-${width}.png`) });
      await page.getByRole('button', { name: 'Start evaluation', exact: true }).first().click();
      await page.getByRole('radio', { name: '4, Very good', exact: true }).waitFor();
      assert.equal(await page.getByRole('tab', { name: 'Home', exact: true }).count(), 0, 'evaluation hides phone navbar');
      assert.equal(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled(), true, 'unanswered question cannot advance');
      await checkBounds(page, `rating ${width}`);
      await page.screenshot({ path: path.join(output, `rating-${width}.png`) });
      for (let i = 0; i < questions.length; i++) {
        await page.getByRole('radio', { name: '4, Very good', exact: true }).click();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
      }
      await page.getByRole('textbox', { name: 'Comments (optional, anonymous)', exact: true }).fill('The examples helped me understand the lessons.');
      await page.getByRole('button', { name: 'Review answers', exact: true }).click();
      await page.getByText('Review your answers', { exact: true }).waitFor();
      await checkBounds(page, `review ${width}`);
      await page.screenshot({ path: path.join(output, `review-${width}.png`) });
      await page.getByRole('button', { name: /The teacher explains lessons clearly.*Change/ }).click();
      await page.getByRole('radio', { name: '3, Good', exact: true }).click();
      await page.getByRole('button', { name: 'Back to review', exact: true }).click();
      await page.getByRole('button', { name: 'Submit anonymously', exact: true }).click();
      await page.getByText('Evaluation sent', { exact: true }).first().waitFor();
      assert.equal(state.submitted.answers.length, 5);
      assert.equal(state.submitted.answers[0].rating, 3);
      assert.equal(state.submitted.comment, 'The examples helped me understand the lessons.');
      assert.deepEqual(state.errors, []);
      results.push({ width, home: 'pass', rating: 'pass', review: 'pass', isolatedSubmit: 'pass', unknownEndpoints: [...new Set(state.unknown)] });
      await context.close();
    }
    // Empty and closed periods, dark mode, and draft restoration have separate contexts.
    for (const [scenario, dark] of [['empty', false], ['closed', false], ['upcoming', false], ['normal', true]]) {
      const { page, context, state } = await setup(browser, { width: 390, height: 844 }, scenario, dark);
      await checkBounds(page, `${scenario} ${dark ? 'dark' : 'light'}`);
      if (scenario === 'empty') await page.getByText('No classes to evaluate yet', { exact: true }).waitFor();
      if (scenario === 'closed') assert.equal(await page.getByRole('button', { name: 'Evaluation closed', exact: true }).first().isDisabled(), true);
      if (scenario === 'upcoming') {
        assert.equal(await page.getByRole('button', { name: 'Not open yet', exact: true }).first().isDisabled(), true);
        await page.getByText(/Midterm · Opens Dec 07, 2099/).waitFor();
      }
      await page.screenshot({ path: path.join(output, `${scenario}-${dark ? 'dark' : 'light'}.png`) });
      assert.deepEqual(state.errors, []);
      results.push({ scenario, dark, result: 'pass' });
      await context.close();
    }
    const { page, context, state } = await setup(browser, { width: 390, height: 844 });
    await page.getByRole('button', { name: 'Start evaluation', exact: true }).first().click();
    await page.getByRole('radio', { name: '4, Very good', exact: true }).click();
    await page.getByText('Draft saved on this device', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('radio', { name: '4, Very good', exact: true }).waitFor();
    await page.waitForTimeout(350);
    assert.equal(await page.getByRole('radio', { name: '4, Very good', exact: true }).getAttribute('aria-checked'), 'true');
    await page.goto(`${origin}/student`, { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Ask Wise', exact: true }).click();
    await page.getByRole('textbox', { name: 'Message Professor Wise', exact: true }).waitFor();
    await checkBounds(page, 'Wise');
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await page.getByText('Your submitted evaluations', { exact: true }).waitFor();
    await checkBounds(page, 'History');
    await page.getByRole('tab', { name: 'Alert', exact: true }).click();
    await page.getByText('Notifications', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('tab', { name: 'Account', exact: true }).click();
    await page.waitForURL('**/student/account');
    await checkBounds(page, 'Account');
    assert.deepEqual(state.errors, []);
    results.push({ draftRestore: 'pass', wiseNavigation: 'pass', historyNavigation: 'pass', alertNavigation: 'pass', accountNavigation: 'pass' });
    await context.close();
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
