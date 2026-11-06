// Real browser -> API -> database checks. Never point this at school accounts.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
assert.equal(process.env.ASSIGNMENT_ISOLATED_DB, '1', 'Requires a freshly seeded isolated demo database.');
const api = process.env.ASSIGNMENT_TEST_API;
assert.ok(api, 'Set ASSIGNMENT_TEST_API to the isolated API URL.');
const origin = process.env.UI_ORIGIN || 'http://localhost:8081';
const output = path.resolve(__dirname, '../../.ui-checks/assignment-flow');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const errors = [];
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
    const schoolResponse = await context.request.get(`${api}/schools/DEMO`);
    assert.equal(schoolResponse.status(), 200);
    const school = (await schoolResponse.json()).school;
    await context.addInitScript((school) => {
      localStorage.setItem('tw.school', JSON.stringify(school));
      localStorage.setItem('tw.onboarded', '1');
      localStorage.setItem('tw.tourDone', '1');
      localStorage.setItem('teachwise_theme', 'light');
    }, school);
    await context.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: `${api}${url.pathname.replace(/^\/api/, '')}${url.search}` });
      await route.fulfill({ response });
    });
    page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const adminLogin = await context.request.post(`${api}/auth/login`, { data: { login: 'ccsdean', password: 'password' } });
    assert.equal(adminLogin.status(), 200);
    const admin = await adminLogin.json();
    const adminHeaders = { Authorization: `Bearer ${admin.token}` };
    const assignments = [];
    for (const [index, name] of ['Programming Fundamentals', 'Database Fundamentals'].entries()) {
      const subject = await context.request.post(`${api}/admin/subjects`, { headers: adminHeaders, data: { code: `BROWSER-${index}`, name, year_level: 2 } });
      assert.equal(subject.status(), 201);
    }
    await page.goto(`${origin}/login`, { waitUntil: 'networkidle' });
    await page.evaluate((token) => localStorage.setItem('teachwise_token', token), admin.token);
    await page.goto(`${origin}/admin/academics`, { waitUntil: 'networkidle' });
    for (const [index, name] of ['Programming Fundamentals', 'Database Fundamentals'].entries()) {
      await page.getByRole('button', { name: 'Add class', exact: true }).first().click();
      await page.getByRole('button', { name: /^Subject:/ }).click();
      await page.getByRole('radio', { name: `BROWSER-${index} · ${name}`, exact: true }).click();
      await page.getByRole('button', { name: /^Teacher:/ }).click();
      await page.getByRole('radio', { name: /Prof\. Liza Santos/ }).click();
      await page.getByRole('button', { name: /^Section:/ }).click();
      await page.getByRole('dialog').getByRole('textbox', { name: 'Search', exact: true }).fill('BSIT 2-A');
      await page.getByRole('radio', { name: 'BSIT 2-A', exact: true }).click();
      const created = page.waitForResponse((r) => r.url().includes('/admin/offerings') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const response = await created;
      assert.equal(response.status(), 201);
      assignments.push((await response.json()).offering.id);
      await page.getByRole('button', { name: 'Save', exact: true }).waitFor({ state: 'hidden' });
    }
    await page.screenshot({ path: path.join(output, 'dean-assigned-classes.png') });
    await page.goto(`${origin}/admin/ids`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Add IDs', exact: true }).click();
    await page.getByRole('textbox', { name: 'IDs to add', exact: true }).fill('2026-2211, Student Browser, BSIT 2A');
    const roster = page.waitForResponse((r) => r.url().includes('/admin/whitelist') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Add 1 ID', exact: true }).click();
    assert.equal((await roster).status(), 201);
    await page.getByRole('textbox', { name: 'IDs to add', exact: true }).waitFor({ state: 'hidden' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${origin}/login?mode=signup`, { waitUntil: 'networkidle' });
    await page.getByRole('textbox', { name: 'Student ID', exact: true }).fill('2026-0101');
    await page.getByText(/Your school must complete your approved name and section/).first().waitFor();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('progressbar', { name: 'Step 1 of 3: Student ID', exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Student ID', exact: true }).fill('2026-2211');
    await page.getByText('Student Browser', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Full name', exact: true }).inputValue(), 'Student Browser');
    assert.equal(await page.getByRole('textbox', { name: 'Full name', exact: true }).isEditable(), false);
    await page.getByRole('textbox', { name: 'Username', exact: true }).fill('browserstudent');
    await page.getByText(/that username is free/i).waitFor();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Password', { exact: true }).fill('secret123');
    await page.getByLabel('Confirm password', { exact: true }).fill('secret123');
    await page.getByRole('checkbox').check();
    const registration = page.waitForResponse((r) => r.url().includes('/auth/register') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    const registered = await registration;
    assert.equal(registered.status(), 201);
    const session = await registered.json();
    assert.equal(session.user.section.label, 'BSIT 2-A');
    await page.waitForURL('**/student');
    const headers = { Authorization: `Bearer ${session.token}` };
    const dashboard = await (await context.request.get(`${api}/student/dashboard`, { headers })).json();
    assert.equal(dashboard.teachers.length, 2);
    assert.deepEqual(dashboard.teachers.map((t) => t.offering_id).sort(), assignments.sort());
    assert.ok(dashboard.semester.name.startsWith('1st Semester'));
    await page.getByText('BSIT 2-A · '+dashboard.semester.name, { exact: true }).waitFor();
    for (const name of ['Programming Fundamentals', 'Database Fundamentals']) await page.getByText(name, { exact: true }).first().waitFor();
    await page.screenshot({ path: path.join(output, 'new-student-home.png') });

    async function evaluate(href, formUrl, submitPath) {
      const form = await (await context.request.get(`${api}${formUrl}`, { headers: currentHeaders })).json();
      assert.equal(form.period.is_open, true);
      await page.goto(`${origin}${href}`, { waitUntil: 'networkidle' });
      for (const question of form.questions.filter((q) => q.type === 'rating')) {
        await page.getByRole('radio', { name: /^4,/ }).click();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Review answers', exact: true }).click();
      const sent = page.waitForResponse((r) => r.url().includes(submitPath) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Submit anonymously', exact: true }).click();
      assert.equal((await sent).status(), 201);
      await page.getByRole('heading', { name: 'Evaluation sent', exact: true }).waitFor();
    }
    let currentHeaders = headers;
    const offering = dashboard.teachers[0].offering_id;
    await evaluate(`/student/evaluate/${offering}`, `/student/offerings/${offering}/form`, '/student/evaluations');
    const history = await context.request.get(`${api}/student/history`, { headers });
    assert.equal((await history.json()).data.length, 1);
    await page.screenshot({ path: path.join(output, 'student-evaluation-sent.png') });

    const invitation = await context.request.post(`${api}/admin/invites`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { role: 'teacher', people: [{ name: 'Professor Browser', id_number: 'T-BROWSER', email: 'browser@dsu.test' }] },
    });
    assert.equal(invitation.status(), 201);
    const code = (await invitation.json()).data[0].code;
    await context.clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${origin}/invite?code=${code}`, { waitUntil: 'networkidle' });
    const name = page.getByRole('textbox', { name: 'Full name', exact: true });
    await name.waitFor();
    assert.equal(await name.inputValue(), 'Professor Browser');
    assert.equal(await name.isEditable(), false);
    assert.equal(await page.getByRole('textbox', { name: 'Employee / ID number', exact: true }).isEditable(), false);
    await page.getByRole('textbox', { name: 'Username', exact: true }).fill('browserteacher');
    await page.getByText(/that username is free/i).waitFor();
    await page.getByLabel('Password', { exact: true }).fill('secret123');
    await page.getByLabel('Confirm password', { exact: true }).fill('secret123');
    await page.getByRole('checkbox').check();
    const accepted = page.waitForResponse((r) => r.url().includes('/auth/accept-invite') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    const acceptedResponse = await accepted;
    assert.equal(acceptedResponse.status(), 201);
    const teacher = await acceptedResponse.json();
    assert.equal(teacher.user.department_id, admin.user.department_id);
    await page.waitForURL('**/teacher');
    currentHeaders = { Authorization: `Bearer ${teacher.token}` };
    const teacherDash = await (await context.request.get(`${api}/teacher/dashboard`, { headers: currentHeaders })).json();
    assert.ok(teacherDash.peers.length > 0, 'Invited teacher can evaluate department colleagues without teaching assignments.');
    const peer = teacherDash.peers[0].teacher.id;
    await page.screenshot({ path: path.join(output, 'new-teacher-home.png') });
    await evaluate(`/teacher/peers/${peer}`, `/teacher/peers/${peer}/form`, '/teacher/peer-evaluations');
    const after = await (await context.request.get(`${api}/teacher/dashboard`, { headers: currentHeaders })).json();
    assert.equal(after.peers.find((p) => p.teacher.id === peer).status, 'completed');
    await page.screenshot({ path: path.join(output, 'peer-evaluation-sent.png') });
    assert.deepEqual(errors, []);
    console.log('Assignment browser checks passed: roster signup, assigned classes, student submission/history, staff invite, department peers, peer submission.');
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(output, 'failure.png') });
      fs.writeFileSync(path.join(output, 'failure.txt'), await page.locator('body').innerText());
    }
    throw error;
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
