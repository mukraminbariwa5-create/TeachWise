// Explicit real-model browser check, restricted to an isolated demo API.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.UI_ORIGIN || 'http://localhost:8081';
const isolatedApi = process.env.WISE_TEST_API;
const historyOnly = process.env.WISE_HISTORY_ONLY === '1';
const displayed = (text) => text.replace(/\*\*([^*]+)\*\*/g, '$1');
assert.equal(process.env.WISE_ISOLATED_DB, '1', 'Confirm this API uses a newly created isolated demo database.');
assert.ok(isolatedApi, 'Set WISE_TEST_API to the isolated API URL.');
const output = path.resolve(process.env.UI_OUTPUT_DIR || path.join(__dirname, '../../.ui-checks/wise-live'));
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER || 'msedge' });
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
    const login = await context.request.post(`${isolatedApi}/auth/login`, { data: { login: 'aisha', password: 'password', device_name: 'Isolated Wise browser check' } });
    assert.equal(login.status(), 200);
    const session = await login.json();
    const greetingTimings = [];
    if (!historyOnly) {
      const cleared = await context.request.delete(`${isolatedApi}/wise/messages`, { headers: { Authorization: `Bearer ${session.token}` } });
      assert.equal(cleared.status(), 200, 'Clear only the isolated demo account between test runs');
      const created = await context.request.post(`${isolatedApi}/wise/conversations`, { headers: { Authorization: `Bearer ${session.token}` } });
      const benchmarkId = (await created.json()).conversation.id;
      for (const message of ['Hello', 'Hi', 'Hello!', 'Good morning', 'Thanks']) {
        const start = performance.now();
        const response = await context.request.post(`${isolatedApi}/wise/messages`, { headers: { Authorization: `Bearer ${session.token}` }, data: { message, conversation_id: benchmarkId } });
        const body = await response.json();
        greetingTimings.push(Math.round(performance.now() - start));
        assert.equal(response.status(), 201);
        assert.equal(body.source, 'quick');
      }
      await context.request.delete(`${isolatedApi}/wise/conversations/${benchmarkId}`, { headers: { Authorization: `Bearer ${session.token}` } });
    }
    await context.addInitScript(({ token }) => {
      localStorage.setItem('teachwise_token', token);
      localStorage.setItem('tw.onboarded', '1');
      localStorage.setItem('tw.tourDone', '1');
      localStorage.setItem('teachwise_theme', 'light');
    }, { token: session.token });
    page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const url = `${isolatedApi}${new URL(request.url()).pathname.replace(/^\/api/, '')}${new URL(request.url()).search}`;
      const response = await route.fetch({ url, timeout: 180_000 });
      await route.fulfill({ response });
    });
    await page.goto(`${origin}/student/wise`, { waitUntil: 'networkidle' });
    const input = page.getByRole('textbox', { name: 'Message Professor Wise', exact: true });
    const openMenu = async () => {
      const button = page.getByRole('button', { name: 'Conversation menu', exact: true });
      if (await button.count()) await button.click();
    };
    await input.waitFor();
    const replies = [];
    let topic;
    if (historyOnly) {
      const history = await context.request.get(`${isolatedApi}/wise/messages`, { headers: { Authorization: `Bearer ${session.token}` } });
      assert.equal(history.status(), 200);
      const data = await history.json();
      replies.push(...data.messages.filter((message) => message.role === 'assistant').slice(-2).map((message) => message.content));
      assert.equal(replies.length, 2, 'Existing real replies are available for layout checks');
    }
    if (!historyOnly) {
      await input.fill('Hello');
      const start = performance.now();
      const responsePromise = page.waitForResponse((response) => response.url().includes('/api/wise/messages') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      const response = await responsePromise;
      const body = await response.json();
      assert.equal(body.source, 'quick');
      await page.getByText(displayed(body.reply.content), { exact: true }).waitFor();
      process.stdout.write(`Greeting API timings (ms): ${greetingTimings.join(', ')}; browser reply rendered in ${Math.round(performance.now() - start)} ms.\n`);
    }
    for (const message of historyOnly ? [] : ['I keep postponing my math homework and feel stressed. Can you help me take a small first step?', 'Could we make that a 10-minute plan?']) {
      await input.fill(message);
      const responsePromise = page.waitForResponse((response) => response.url().includes('/api/wise/messages') && response.request().method() === 'POST', { timeout: 180_000 });
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      const response = await responsePromise;
      assert.equal(response.status(), 201);
      const body = await response.json();
      assert.equal(body.source, 'ollama', 'A real generated answer reached the browser');
      await page.getByText(displayed(body.reply.content), { exact: true }).waitFor();
      replies.push(body.reply.content);
      topic = body.conversation;
    }
    if (!historyOnly) {
      await openMenu();
      const createdResponse = page.waitForResponse((response) => response.url().includes('/api/wise/conversations') && response.request().method() === 'POST');
      void createdResponse.catch(() => {});
      await page.getByRole('button', { name: 'New conversation', exact: true }).click();
      const created = await (await createdResponse).json();
      await page.getByTestId('wise-chat-content').getByText(created.conversation.title, { exact: true }).waitFor();
      await input.fill('Hello');
      const secondResponse = page.waitForResponse((response) => response.url().includes('/api/wise/messages') && response.request().method() === 'POST');
      void secondResponse.catch(() => {});
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      const second = await (await secondResponse).json();
      assert.notEqual(second.conversation.id, topic.id);
      await page.getByText(displayed(second.reply.content), { exact: true }).waitFor();
      assert.equal(await page.getByTestId('wise-chat-content').getByText(displayed(replies[1]), { exact: true }).count(), 0, 'A new topic hides the previous conversation');
      await openMenu();
      await page.getByTestId(`wise-conversation-${topic.id}`).click();
      await page.getByText(displayed(replies[1]), { exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => (localStorage.getItem('teachwise_query_cache_v1') || '').includes('I keep postponing my math homework')), false, 'Personal conversation is not persisted in the offline cache');
    await page.screenshot({ path: path.join(output, 'wise-live-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    const lastReply = page.getByText(displayed(replies[replies.length - 1]), { exact: true }).last();
    await lastReply.waitFor();
    await lastReply.scrollIntoViewIfNeeded();
    await page.waitForFunction((element) => {
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        if (Number(getComputedStyle(ancestor).opacity) < 0.95) return false;
      }
      return true;
    }, await lastReply.elementHandle());
    await page.screenshot({ path: path.join(output, 'wise-live-phone.png') });
    fs.writeFileSync(path.join(output, historyOnly ? 'history-layout-results.json' : 'results.json'), JSON.stringify({ status: 'pass', replies, greetingTimings, errors, database: 'isolated demo copy', mode: historyOnly ? 'history layout' : 'live generation' }, null, 2));
    process.stdout.write(historyOnly ? 'Live conversation history and responsive layout passed.\n' : `Live browser conversation passed.\n${replies.join('\n\nFOLLOW-UP:\n')}\n`);
  } finally {
    if (page) await page.unrouteAll({ behavior: 'ignoreErrors' });
    await browser.close();
  }
})().catch((error) => { process.stderr.write(`${String(error.stack).replace(/Bearer \S+/g, 'Bearer [redacted]')}\n`); process.exitCode = 1; });
