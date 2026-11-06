// Isolated web chat checks. All API calls use fixtures; no school records are written.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.UI_ORIGIN || 'http://localhost:8081';
const output = path.resolve(process.env.UI_OUTPUT_DIR || path.join(__dirname, '../../.ui-checks/wise'));
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER || 'msedge' });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      localStorage.setItem('teachwise_token', 'isolated-wise-fixture');
      localStorage.setItem('tw.onboarded', '1');
      localStorage.setItem('tw.tourDone', '1');
      localStorage.setItem('teachwise_theme', 'light');
      localStorage.setItem('teachwise_query_cache_v1', JSON.stringify({ savedAt: Date.now(), state: { mutations: [], queries: [{ queryKey: ['wise'], queryHash: '["wise"]', state: { status: 'success', data: { messages: [{ role: 'assistant', content: 'Private history from another session' }] } } }] } }));
    });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    const saved = new Map();
    const conversations = new Map([[1, { id: 1, title: 'Earlier conversation', messages: [] }]]);
    let selected = 1;
    let nextConversation = 2;
    const summary = (conversation) => ({ id: conversation.id, title: conversation.title, messages_count: conversation.messages.length, created_at: '2026-11-06T00:00:00Z', updated_at: '2026-11-06T00:00:00Z' });
    let nextId = 1;
    const layoutReply = "Let's keep this manageable. 🙂\n\n**Choose one task:** Pick the assignment with the nearest deadline and spend ten minutes on its first step. You do not need to solve everything at once.\n\n**Build a small routine:** After a short break, decide whether another focused session would help. If a lesson is unclear, note one question you can ask your teacher.\n\nWhat would you like to start with?";
    page.on('pageerror', (error) => errors.push(error.message));
    const school = { id: 901, name: 'Wise Test School', code: 'WISE', status: 'active', settings: { setup_completed: true, scale: ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'], min_responses: 3 } };
    const user = { id: 901, name: 'Test Student', initials: 'TS', username: 'wise-test', role: 'student', section: null };
    const settings = { tips: false, seen_tips: [], notify: { periods: true, reminders: true, account: true } };
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const endpoint = new URL(request.url()).pathname.replace(/^\/api/, '');
      let body = {};
      if (endpoint === '/auth/me') body = { user, school, settings, token_expires_at: null };
      else if (endpoint === '/app/info') body = { school_name: school.name, school, latest_version: '1.0.0', min_version: '1.0.0' };
      else if (endpoint === '/notifications') body = { unread: 0, data: [] };
      else if (endpoint === '/me/settings') body = { settings };
      else if (endpoint === '/student/dashboard') body = { student: user, period: null, teachers: [], subjects: [], progress: { completed: 0, total: 0, percent: 0 } };
      else if (endpoint === '/student/history' || endpoint === '/me/sessions') body = { data: [] };
      else if (endpoint === '/wise/conversations') {
        if (request.method() === 'POST') {
          const conversation = { id: nextConversation++, title: 'New conversation', messages: [] };
          conversations.set(conversation.id, conversation);
          selected = conversation.id;
          body = { conversation: summary(conversation) };
        } else body = { data: [...conversations.values()].reverse().map(summary), current_page: 1, last_page: 1, total: conversations.size, per_page: 20 };
      } else if (/^\/wise\/conversations\/\d+$/.test(endpoint) && request.method() === 'DELETE') {
        conversations.delete(Number(endpoint.split('/').pop()));
        selected = [...conversations.keys()].pop();
        body = { message: 'Conversation deleted.' };
      }
      else if (endpoint === '/wise/messages') {
        const conversationId = Number(new URL(request.url()).searchParams.get('conversation_id')) || selected;
        const conversation = conversations.get(conversationId);
        if (request.method() === 'POST') {
          const input = request.postDataJSON();
          requests.push(input);
          if (!saved.has(input.request_id)) {
            const target = conversations.get(input.conversation_id || selected);
            const question = { id: nextId++, role: 'user', content: input.message };
            const reply = { id: nextId++, role: 'assistant', content: input.message === 'Show me a study plan.' ? layoutReply : input.message.includes('history essay') ? 'Let us outline the essay.' : 'Let us choose one manageable step together.' };
            if (target.messages.length === 0) target.title = input.message;
            target.messages.push(question, reply);
            selected = target.id;
            body = { question, reply, source: 'ollama', conversation: summary(target) };
            saved.set(input.request_id, body);
            if (requests.length === 1) {
              await new Promise((resolve) => setTimeout(resolve, 900));
              return route.abort('failed'); // A reply was saved, but the connection dropped.
            }
            if (input.message === 'Malformed response test') body = {};
          } else body = saved.get(input.request_id);
        } else if (request.method() === 'DELETE') {
          conversation.messages = [];
          body = { message: 'Chat history deleted.' };
        } else body = { greeting: 'Hello! What is on your mind?', tip: '', suggestions: [], conversation: conversation ? summary(conversation) : null, messages: conversation?.messages ?? [], has_more_messages: false };
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(`${origin}/student/wise`, { waitUntil: 'networkidle' });
    const input = page.getByRole('textbox', { name: 'Message Professor Wise', exact: true });
    const chat = page.getByTestId('wise-chat-content');
    await input.waitFor();
    const openMenu = async () => {
      const button = page.getByRole('button', { name: 'Conversation menu', exact: true });
      if (await button.count()) await button.click();
    };
    await page.getByTestId('wise-history-sidebar').waitFor();
    assert.equal(Math.round((await page.getByTestId('app-navigation').boundingBox()).width), 72, 'Wise opens with a narrow app rail');
    assert.equal(await page.getByRole('menuitem', { name: 'Home', exact: true }).getAttribute('title'), 'Home', 'Rail icons retain hover labels');
    assert.equal(await page.getByRole('button', { name: /Expand sidebar|Collapse sidebar/ }).count(), 0, 'Navigation is permanently narrow');
    assert.equal(await page.getByRole('button', { name: 'Conversation menu', exact: true }).count(), 0, 'Desktop history appears without a hamburger');
    const workspace = await page.getByTestId('wise-workspace').boundingBox();
    const content = await page.getByTestId('wise-chat-content').boundingBox();
    assert.ok(workspace.width > 1000 && content.x - workspace.x >= 230 && content.width > 800, 'Desktop uses its available width with a compact history sidebar');
    assert.equal(await page.getByRole('button', { name: 'Refresh conversation', exact: true }).count(), 0, 'Refresh control is removed');
    assert.equal(await page.getByText('Private history from another session').count(), 0);
    assert.equal(await page.evaluate(() => (localStorage.getItem('teachwise_query_cache_v1') || '').includes('Private history from another session')), false, 'Old device chat copies are removed');
    await input.fill('I feel overwhelmed.');
    await input.press('Shift+Enter');
    assert.equal(requests.length, 0, 'Shift+Enter inserts a newline without sending');
    assert.match(await input.inputValue(), /\n/);
    await input.press('Enter');
    await input.press('Enter');
    await page.getByRole('button', { name: 'Retry message', exact: true }).waitFor();
    assert.equal(requests.length, 1, 'Rapid repeated Enter does not create a second request');
    assert.match(await input.inputValue(), /overwhelmed/);
    await page.getByRole('button', { name: 'Retry message', exact: true }).click();
    await page.getByText('Let us choose one manageable step together.', { exact: true }).waitFor();
    assert.equal(requests[0].request_id, requests[1].request_id, 'Retry reuses the original request ID');
    assert.equal(await page.getByText('Let us choose one manageable step together.', { exact: true }).count(), 1, 'Saved replies render once');
    await input.fill('Malformed response test');
    await input.press('Enter');
    await page.getByText('Wise returned an incomplete response. Please retry your message.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Retry message', exact: true }).click();
    await page.waitForFunction(() => !document.body.textContent.includes('Wise returned an incomplete response.'));
    assert.equal(requests[2].request_id, requests[3].request_id);
    const firstTitle = conversations.get(1).title;
    await input.fill('A draft for topic one.');
    await openMenu();
    await page.getByRole('button', { name: 'New conversation', exact: true }).click();
    await page.getByText('Hello! What is on your mind?', { exact: true }).waitFor();
    assert.equal(await input.inputValue(), '', 'New topic has a separate draft');
    assert.equal(await chat.getByText('I feel overwhelmed.', { exact: true }).count(), 0, 'A new topic does not show the earlier topic');
    await input.fill('Help with my history essay.');
    await input.press('Enter');
    await page.getByText('Let us outline the essay.', { exact: true }).waitFor();
    const secondId = requests[requests.length - 1].conversation_id;
    assert.notEqual(secondId, 1);
    await openMenu();
    await page.getByRole('button', { name: `Continue conversation: ${firstTitle}`, exact: true }).click();
    await page.getByText('I feel overwhelmed.', { exact: true }).last().waitFor();
    assert.equal(await input.inputValue(), 'A draft for topic one.', 'Switching back restores that topic draft');
    assert.equal(await chat.getByText('Help with my history essay.', { exact: true }).count(), 0);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('I feel overwhelmed.', { exact: true }).last().waitFor();
    assert.equal(await chat.getByText('Help with my history essay.', { exact: true }).count(), 0, 'Browser refresh keeps the selected topic');
    await input.fill('Can we continue the first topic?');
    await input.press('Enter');
    await page.getByText('Can we continue the first topic?', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.body.textContent.includes('Thinking…'));
    assert.equal(requests[requests.length - 1].conversation_id, 1, 'Continued chat targets the selected topic');
    await openMenu();
    await page.getByRole('button', { name: 'Delete this conversation', exact: true }).click();
    await page.getByRole('button', { name: 'Delete conversation', exact: true }).click();
    await page.getByText('Let us outline the essay.', { exact: true }).waitFor();
    assert.equal(conversations.size, 1, 'Delete removes only the selected topic');
    assert.ok(conversations.has(secondId));
    assert.equal(await page.getByRole('button', { name: 'Retry message', exact: true }).count(), 0);
    await input.fill('Show me a study plan.');
    await input.press('Enter');
    const formattedReply = chat.getByText(layoutReply.replace(/\*\*([^*]+)\*\*/g, '$1'), { exact: true });
    await formattedReply.waitFor();
    assert.equal(await formattedReply.evaluate((element) => getComputedStyle(element).fontSize), '14px', 'Message text is compact without the desktop scale multiplier');
    assert.equal(await chat.getByText('**Choose one task:**', { exact: true }).count(), 0, 'Bold markers render as formatting');
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 900 }, { width: 1100, height: 800 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(viewport);
      await page.getByTestId('wise-history-sidebar').waitFor();
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
      assert.equal(await page.getByRole('button', { name: 'Conversation menu', exact: true }).count(), 0);
      const sidebar = await page.getByTestId('wise-history-sidebar').boundingBox();
      const workspace = await page.getByTestId('wise-workspace').boundingBox();
      const chatRect = await page.getByTestId('wise-chat-content').boundingBox();
      assert.equal(Math.round(sidebar.width), 256);
      assert.equal(Math.round((await page.getByTestId('app-navigation').boundingBox()).width), 72);
      assert.ok(Math.abs(workspace.x + workspace.width - viewport.width) < 2, 'Workspace reaches the right edge');
      assert.ok(Math.abs(chatRect.x + chatRect.width - viewport.width) < 2, 'Chat fills the space beside history');
      await page.screenshot({ path: path.join(output, `wise-desktop-${viewport.width}.png`) });
    }
    await page.setViewportSize({ width: 820, height: 900 });
    await page.getByRole('button', { name: 'Conversation menu', exact: true }).waitFor();
    assert.equal(await page.getByTestId('wise-history-sidebar').count(), 0, 'Tablet retains the compact menu');
    await page.setViewportSize({ width: 390, height: 844 });
    await input.fill('A longer concern\nwith several lines\nthat should stay readable.');
    const rect = await input.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= 391, 'Phone input fits the viewport');
    assert.deepEqual(errors, [], 'No browser runtime errors');
    await page.screenshot({ path: path.join(output, 'wise-phone.png') });
    await page.getByRole('button', { name: 'Conversation menu', exact: true }).click();
    const drawer = await page.getByTestId('wise-history-drawer').boundingBox();
    assert.ok(drawer.width <= 296, 'Mobile conversation menu is narrower');
    await page.screenshot({ path: path.join(output, 'wise-menu-phone.png') });
    await page.getByRole('button', { name: 'Settings', exact: true }).last().click();
    await page.waitForURL('**/student/settings');
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.waitForFunction(() => Math.round(document.querySelector('[data-testid="app-navigation"]')?.getBoundingClientRect().width || 0) === 72);
    assert.equal(Math.round((await page.getByTestId('app-navigation').boundingBox()).width), 72, 'Navigation stays narrow on Settings too');
    const navigationSamples = [];
    const checkNavigation = async (path, action, motion) => {
      await page.evaluate(() => {
        window.__navSamples = [];
        window.__navDone = false;
        const until = performance.now() + 650;
        const sample = () => {
          const element = document.querySelector('[data-testid="page-transition"]');
          const rail = document.querySelector('[data-testid="app-navigation"]');
          if (element) {
            const style = getComputedStyle(element);
            window.__navSamples.push({ path: location.pathname, opacity: Number(style.opacity), y: style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m42, railWidth: rail?.getBoundingClientRect().width });
          }
          if (performance.now() < until) requestAnimationFrame(sample);
          else window.__navDone = true;
        };
        requestAnimationFrame(sample);
      });
      await action();
      await page.waitForURL(`**${path}`);
      await page.waitForFunction(() => window.__navDone);
      const samples = (await page.evaluate(() => window.__navSamples)).filter((sample) => sample.path === path);
      assert.ok(samples.length > 0);
      assert.ok(samples.every((sample) => Math.round(sample.railWidth) === 72), 'Rail stays fixed throughout navigation');
      if (motion) assert.ok(samples.some((sample) => sample.opacity < 0.99 && sample.y > 0), 'Page visibly fades and moves into place');
      else assert.ok(samples.every((sample) => sample.opacity === 1 && sample.y === 0), 'Reduced motion skips page animation');
      assert.equal(samples[samples.length - 1].opacity, 1);
      assert.equal(await page.getByRole('button', { name: /Expand sidebar|Collapse sidebar/ }).count(), 0);
      navigationSamples.push({ path, motion, frames: samples.length, minimumOpacity: Math.min(...samples.map((sample) => sample.opacity)) });
    };
    await checkNavigation('/student/history', () => page.getByRole('menuitem', { name: 'History', exact: true }).click(), false);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await checkNavigation('/student', () => page.getByRole('menuitem', { name: 'Home', exact: true }).click(), true);
    await checkNavigation('/student/wise', () => page.getByRole('menuitem', { name: 'Ask Wise', exact: true }).click(), true);
    await checkNavigation('/student/history', () => page.getByRole('menuitem', { name: 'History', exact: true }).click(), true);
    await checkNavigation('/student/profile', async () => {
      await page.getByRole('button', { name: 'Account menu for Test Student', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Profile', exact: true }).click();
    }, true);
    await checkNavigation('/student/settings', () => page.getByRole('menuitem', { name: 'Settings', exact: true }).click(), true);
    assert.deepEqual(errors, [], 'Navigation has no runtime errors');
    fs.writeFileSync(path.join(output, 'navigation-motion.json'), JSON.stringify(navigationSamples, null, 2));
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ status: 'pass', checks: ['multiline input', 'rapid-send guard', 'connection-loss retry', 'request ID reuse', 'malformed response recovery', 'new topics', 'topic drafts', 'history continuation', 'selected topic survives refresh', 'isolated deletion', 'settings link', 'phone layout', 'no runtime errors'] }, null, 2));
    process.stdout.write('Wise browser checks passed.\n');
  } finally {
    await browser.close();
  }
})().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
