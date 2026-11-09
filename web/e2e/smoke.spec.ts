import { expect, test, type Page } from '@playwright/test';

const SESSION_ID = '11111111-2222-4333-8444-555555555555';
const REPLY_TEXT = '两次握手只能确认一个方向的可达性。';

function sseBody(): string {
  const base = { created_at: new Date().toISOString(), metadata: {} };
  const events = [
    {
      ...base,
      id: 'e1',
      type: 'REPLY_START',
      session_id: SESSION_ID,
      reply_id: 'r1',
      name: 'teacher',
    },
    { ...base, id: 'e2', type: 'TEXT_BLOCK_START', reply_id: 'r1', block_id: 'b1' },
    {
      ...base,
      id: 'e3',
      type: 'TEXT_BLOCK_DELTA',
      reply_id: 'r1',
      block_id: 'b1',
      delta: '两次握手',
    },
    {
      ...base,
      id: 'e4',
      type: 'TEXT_BLOCK_DELTA',
      reply_id: 'r1',
      block_id: 'b1',
      delta: '只能确认一个方向的可达性。',
    },
    { ...base, id: 'e5', type: 'TEXT_BLOCK_END', reply_id: 'r1', block_id: 'b1' },
    {
      ...base,
      id: 'e6',
      type: 'REPLY_END',
      session_id: SESSION_ID,
      reply_id: 'r1',
      finished_reason: 'completed',
    },
  ];
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
}

const userMessage = {
  id: 'u1',
  name: 'student',
  role: 'user',
  content: [
    { type: 'text', text: '为什么不能两次握手', id: 'ub1', created_at: '2026-11-06T10:00:00.000Z' },
  ],
  metadata: {},
  created_at: '2026-11-06T10:00:00.000Z',
  finished_at: '2026-11-06T10:00:00.000Z',
};

const assistantMessage = {
  id: 'r1',
  name: 'teacher',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: REPLY_TEXT,
      id: 'b1',
      created_at: '2026-11-06T10:00:01.000Z',
      finished_at: null,
    },
  ],
  metadata: {},
  created_at: '2026-11-06T10:00:01.000Z',
  finished_at: null,
};

async function mockApi(page: Page) {
  let replied = false;
  let streamCalls = 0;

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;

      const fulfill = (status: number, body: unknown) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/auth/login') {
        return fulfill(200, {
          access_token: 'e2e-access',
          refresh_token: 'e2e-refresh',
          token_type: 'bearer',
          expires_in: 1800,
        });
      }
      if (path === '/api/auth/me') {
        return fulfill(200, {
          id: 'user-1',
          username: 'student',
          status: 'active',
          created_at: '2026-09-01T00:00:00.000Z',
        });
      }
      if (path === '/api/sessions' && request.method() === 'GET') {
        return fulfill(200, {
          items: [
            {
              id: SESSION_ID,
              agent_kind: 'teach_agent',
              title: '两次握手',
              knowledge_base_ids: [],
              last_message_at: '2026-11-06T10:00:00.000Z',
              created_at: '2026-11-06T09:00:00.000Z',
            },
          ],
          total: 1,
        });
      }
      if (path === `/api/sessions/${SESSION_ID}`) {
        return fulfill(200, {
          id: SESSION_ID,
          agent_kind: 'teach_agent',
          title: '两次握手',
          knowledge_base_ids: [],
          last_message_at: '2026-11-06T10:00:00.000Z',
          created_at: '2026-11-06T09:00:00.000Z',
        });
      }
      if (path === `/api/sessions/${SESSION_ID}/messages` && request.method() === 'GET') {
        return fulfill(200, {
          messages: replied ? [userMessage, assistantMessage] : [],
          event_cursor: '1-0',
          is_running: false,
          has_more: false,
        });
      }
      if (path === `/api/sessions/${SESSION_ID}/messages` && request.method() === 'POST') {
        replied = true;
        return fulfill(202, { status: 'started', session_id: SESSION_ID });
      }
      if (path === `/api/sessions/${SESSION_ID}/status`) {
        return fulfill(200, { session_id: SESSION_ID, status: 'idle' });
      }
      if (path === `/api/sessions/${SESSION_ID}/stream`) {
        streamCalls += 1;
        if (streamCalls === 1) {
          return route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
            body: sseBody(),
          });
        }
        return new Promise(() => undefined);
      }

      return fulfill(404, { detail: 'not found' });
    },
  );
}

test('登录后发送消息并收到流式回答，刷新后仍然可见', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');

  await page.getByPlaceholder('学号或用户名').fill('student');
  await page.getByPlaceholder('密码').fill('password123');
  await page.getByRole('button', { name: /登\s*录/ }).click();

  await expect(page).toHaveURL(/\/chat/);
  await page.getByText('两次握手', { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/chat/${SESSION_ID}`));
  await expect(page.getByText('未启用')).toBeVisible();

  await page.getByRole('textbox', { name: '输入问题' }).fill('为什么不能两次握手');
  await page.getByRole('textbox', { name: '输入问题' }).press('Enter');

  await expect(page.getByText(REPLY_TEXT)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: '输入问题' })).toBeVisible();
  await expect(page.getByText(REPLY_TEXT)).toBeVisible();
});

test('课程学习模式点击教材目录节点填入输入框', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');

  await page.getByPlaceholder('学号或用户名').fill('student');
  await page.getByPlaceholder('密码').fill('password123');
  await page.getByRole('button', { name: /登\s*录/ }).click();

  await expect(page.getByRole('textbox', { name: '输入问题' })).toBeVisible();
  await page.getByText('第1章 概述', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: '输入问题' })).toHaveValue(
    '我想学习《计算机网络》「第1章 概述」。请先帮我梳理这一章的整体框架。',
  );

  await page.getByText('考研备考', { exact: true }).click();
  await expect(page.getByText('上传题目开始对话')).toBeVisible();
});

test('通过链接参数预选模式和预填充提示词', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');

  await page.getByPlaceholder('学号或用户名').fill('student');
  await page.getByPlaceholder('密码').fill('password123');
  await page.getByRole('button', { name: /登\s*录/ }).click();

  await page.goto('/chat?mode=exam&prompt=请讲解 TCP 拥塞控制');
  await expect(page.getByText('上传题目开始对话')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '输入问题' })).toHaveValue(
    '请讲解 TCP 拥塞控制',
  );

  await page.goto('/chat?mode=course&prompt=课程问题');
  await expect(page.getByText('从教材目录开始')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '输入问题' })).toHaveValue('课程问题');
});

test('未登录访问业务路由会跳转到登录页并带上 next', async ({ page }) => {
  await mockApi(page);
  await page.goto('/stats');
  await expect(page).toHaveURL(/\/login\?next=%2Fstats/);
});
