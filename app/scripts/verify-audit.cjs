// Additional original-checklist coverage. All API writes are intercepted fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setup, checkBounds, dashboard } = require('./verify-ui.cjs');
const origin = process.env.UI_ORIGIN || 'http://localhost:8081';
const output = path.resolve(process.env.UI_OUTPUT_DIR || path.join(__dirname, '../../.ui-checks/audit'));
fs.mkdirSync(output, { recursive: true });
const json = body => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const longSubject = 'Advanced Data Communications, Distributed Computing and Information Systems Research with Community Applications';
const longTeacher = 'Prof. Maria Alexandra Villanueva Dela Cruz Santos';
const dark = process.env.UI_DARK === '1';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER || 'msedge' });
  const results = [];
  try {
    const { page, context, state } = await setup(browser, { width: 320, height: 568 }, 'normal', dark);
    await context.addInitScript(() => localStorage.removeItem('teachwise_query_cache_v1'));
    const longDashboard = structuredClone(dashboard);
    longDashboard.teachers[0].subject.name = longSubject;
    longDashboard.teachers[0].teacher.name = longTeacher;
    longDashboard.period.closes_at = new Date(Date.now() + 86400000).toISOString();
    await page.route('**/api/student/dashboard', r => r.fulfill(json(longDashboard)));
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(/Closing soon · closes/).waitFor();
    await page.getByText(longSubject, { exact: true }).waitFor();
    await checkBounds(page, 'long class content');
    await page.screenshot({ path: path.join(output, 'long-class-320.png') });
    await page.route('**/api/notifications', r => r.fulfill(json({ unread: 1, data: [{ id: 77, title: 'Evaluation deadline and important school announcements', message: 'Please review your remaining classes before the deadline. '.repeat(8), created_at: new Date().toISOString(), read_at: null }] })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: /^Alert/ }).click();
    await page.getByText('Unread', { exact: true }).waitFor();
    await checkBounds(page, 'long notification');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    assert.deepEqual(state.errors, []);
    results.push({ longClass: 'pass', closingSoon: 'pass', longNotification: 'pass' });
    await context.close();

    // Long report labels must wrap, including on the print route.
    const reportContext = await browser.newContext({ viewport: { width: 320, height: 740 }, reducedMotion: 'reduce' });
    const school = { id: 901, name: 'Demo State University', short_name: 'DSU', code: 'DEMO', settings: { peer_evaluation: true, min_responses: 5 } };
    const teacher = { ...dashboard.student, role: 'teacher', name: longTeacher };
    const report = {
      teacher, period: null, generated_at: new Date().toISOString(), department_average: 3.8,
      student_ratings: { overall: { average: 4, responses: 6 }, criteria: [{ question_id: 1, category: 'Clarity of instruction and thoughtful communication of complex subject material', average: 4, responses: 6 }], distribution: { 1: 0, 2: 0, 3: 1, 4: 4, 5: 1 } },
      peer_ratings: { overall: { average: null, responses: 0 }, criteria: [] },
      classes: [{ subject_code: 'IT 301', subject_name: longSubject, section: 'BSIT 3-B', responses: 6, average: 4 }], trend: [],
      comments: [{ comment: 'The examples and explanations helped me understand complex ideas. '.repeat(6), rating: 4, subject_code: 'IT 301', submitted_at: new Date().toISOString() }],
    };
    await reportContext.addInitScript(dark => { localStorage.setItem('teachwise_token', 'audit-fixture'); localStorage.setItem('tw.onboarded', '1'); localStorage.setItem('tw.tourDone', '1'); localStorage.setItem('teachwise_theme', dark ? 'dark' : 'light'); window.print = () => {}; }, dark);
    const rp = await reportContext.newPage();
    await rp.route('**/api/**', r => {
      const endpoint = new URL(r.request().url()).pathname;
      return r.fulfill(json(endpoint.endsWith('/auth/me') ? { user: teacher, school, settings: {}, token_expires_at: null } : endpoint.endsWith('/teacher/report') ? report : endpoint.endsWith('/notifications') ? { unread: 0, data: [] } : {}));
    });
    await rp.goto(`${origin}/teacher/report`, { waitUntil: 'networkidle' });
    const subject = rp.getByText(`IT 301 · ${longSubject} · BSIT 3-B`, { exact: true });
    await subject.scrollIntoViewIfNeeded();
    assert.equal(await subject.evaluate(e => getComputedStyle(e).webkitLineClamp), 'none');
    const rect = await subject.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= 321);
    await checkBounds(rp, 'long report');
    await rp.screenshot({ path: path.join(output, 'long-report-320.png') });
    await rp.setViewportSize({ width: 1366, height: 768 });
    await rp.goto(`${origin}/print/report`, { waitUntil: 'networkidle' });
    await rp.getByText('Faculty Evaluation Report', { exact: true }).waitFor();
    assert.equal(await rp.getByText(`IT 301 · ${longSubject} · BSIT 3-B`, { exact: true }).evaluate(e => getComputedStyle(e).webkitLineClamp), 'none');
    results.push({ longReportLabels: 'pass', printableLongLabels: 'pass' });
    await reportContext.close();

    // Exercise validation and the three registration steps without creating an account.
    const auth = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    await auth.addInitScript(({ school, dark }) => { localStorage.setItem('tw.school', JSON.stringify(school)); localStorage.setItem('tw.onboarded', '1'); localStorage.setItem('teachwise_theme', dark ? 'dark' : 'light'); }, { school, dark });
    const ap = await auth.newPage();
    const authErrors = [];
    let registerRequests = 0;
    ap.on('pageerror', e => authErrors.push(e.message));
    await ap.route('**/api/**', r => {
      const endpoint = new URL(r.request().url()).pathname;
      if (endpoint.endsWith('/auth/register')) { registerRequests++; return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Test registration service unavailable' }) }); }
      return r.fulfill(json(endpoint.endsWith('/sections') ? { data: [{ id: 1, course: 'BSIT', year_level: 3, name: 'B' }] } : endpoint.endsWith('/auth/check-id') ? { ok: true, message: 'ID accepted', name: 'Aisha Tan', section: { id: 1, label: 'BSIT 3-B' } } : endpoint.endsWith('/auth/check-username') ? { ok: true, message: 'Username available', suggestions: [] } : endpoint.endsWith('/app/info') ? { school_name: school.name, latest_version: '1.0.0', min_version: '1.0.0' } : {}));
    });
    await ap.goto(`${origin}/login`, { waitUntil: 'networkidle' });
    await ap.getByRole('button', { name: 'Sign in', exact: true }).click();
    await ap.getByText('Enter your username or ID number and your password.', { exact: true }).waitFor();
    assert.equal(await ap.getByRole('textbox', { name: 'Username or ID number', exact: true }).getAttribute('aria-invalid'), 'true');
    await ap.getByRole('button', { name: 'Show password', exact: true }).click();
    await ap.getByRole('button', { name: 'Hide password', exact: true }).waitFor();
    await ap.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    await ap.getByRole('button', { name: 'Send request', exact: true }).scrollIntoViewIfNeeded();
    await checkBounds(ap, 'password recovery sheet');
    await ap.getByRole('button', { name: 'Close', exact: true }).click();
    await ap.goto(`${origin}/login?mode=signup`, { waitUntil: 'networkidle' });
    await ap.getByRole('button', { name: 'Continue', exact: true }).click();
    await ap.getByText('Enter your student ID.', { exact: true }).waitFor();
    await ap.getByRole('textbox', { name: 'Student ID', exact: true }).fill('2023-0901');
    await ap.getByText('ID accepted', { exact: true }).waitFor();
    await ap.getByRole('button', { name: 'Continue', exact: true }).click();
    await ap.getByRole('textbox', { name: 'Username', exact: true }).fill('aisha_audit');
    await ap.getByText('Username available', { exact: true }).waitFor();
    await ap.getByRole('button', { name: 'Continue', exact: true }).click();
    await ap.getByLabel('Password', { exact: true }).fill('StrongPass123');
    await ap.getByLabel('Confirm password', { exact: true }).fill('StrongPass123');
    await ap.getByRole('checkbox', { name: 'I agree to the Data Privacy Notice', exact: true }).click();
    await ap.getByRole('button', { name: 'Create account', exact: true }).click();
    await ap.getByText('Test registration service unavailable', { exact: true }).waitFor();
    assert.equal(registerRequests, 1);
    assert.equal(await ap.getByLabel('Password', { exact: true }).inputValue(), 'StrongPass123');
    await checkBounds(ap, 'registration error preserves input');
    assert.deepEqual(authErrors, []);
    results.push({ signInValidation: 'pass', passwordVisibility: 'pass', shortRecoverySheet: 'pass', registrationSteps: 'pass', registrationPreservesInputOnFailure: 'pass' });
    await auth.close();
    fs.writeFileSync(path.join(output, 'audit-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
