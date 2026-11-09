# 前端（web）

计算机网络教学智能体的学生端单页应用。实现依据 `docs/chat/11.6/前端Spec.md`。

- React 19 + TypeScript
- Vite 8
- React Router 8
- TanStack Query（服务端状态）
- Zustand（流式运行态、认证、界面状态）
- Ant Design 6 + `@ant-design/x` 2.10 + `@ant-design/x-markdown`
- `@agentscope-ai/agentscope`（消息与事件协议）
- ECharts（对话配图与统计页图表共用，按需加载）

## 开发

```bash
npm install
npm run dev
```

开发服务器 `http://localhost:5173`，`/api` 由 Vite 代理到 `http://127.0.0.1:8000`（见 `vite.config.ts`）。
需要同时启动后端 API 与 Agent 进程。

### 联调前置（本地）

```bash
docker compose up -d postgres redis qdrant
uv run uvicorn app.agent.main:app --port 8001
uv run uvicorn app.api.main:app --port 8000
```

还需要：

- 一个可用账号（仓库暂无 `scripts/create_user.py`，可用 `user_repositories.create` + `hash_password` 建 ACTIVE 用户）。
- COS 桶 CORS：允许前端 origin，方法 `PUT/GET/HEAD`，暴露 `ETag`。
  未配置时浏览器直传会在预检（OPTIONS）阶段拿到 403，前端表现为「网络错误，上传失败」。
  当前桶已配置如下规则（可用 `uv run python -m scripts.setup_cos_cors` 更新，需桶级 PutBucketCORS 权限）：

  | 项             | 值                                                                        |
  | -------------- | ------------------------------------------------------------------------- |
  | Origin         | `http://localhost:5173`、`http://127.0.0.1:5173`、`https://*.chatgqt.top` |
  | Methods        | `PUT`、`GET`、`HEAD`                                                      |
  | Allow-Headers  | `*`                                                                       |
  | Expose-Headers | `ETag`                                                                    |
  | Max-Age        | `600`                                                                     |

  上线前把生产前端域名补进 Origin（若不是 `*.chatgqt.top`）。

- `API_BASE_URL` 必须指向浏览器可访问的地址，否则历史图片无法加载。

## 脚本

| 命令                | 说明                                                          |
| ------------------- | ------------------------------------------------------------- |
| `npm run dev`       | 开发服务器                                                    |
| `npm run build`     | 先 `typecheck` 再打包                                         |
| `npm run preview`   | 预览构建产物                                                  |
| `npm run lint`      | ESLint                                                        |
| `npm run typecheck` | `tsc --noEmit`                                                |
| `npm run test`      | Vitest 单元与组件测试                                         |
| `npm run test:e2e`  | Playwright 端到端（首次需 `npx playwright install chromium`） |

## 前端常量

不读取环境变量，全部集中在 `src/lib/config.ts`：

| 常量               | 值          | 用途                        |
| ------------------ | ----------- | --------------------------- |
| `API_BASE`         | `/api`      | API 前缀                    |
| `UPLOAD_MAX_BYTES` | `104857600` | 单张图片大小上限            |
| `UPLOAD_MAX_COUNT` | `4`         | 单条消息附件上限            |
| `ENABLE_METRICS`   | `false`     | 是否采集 `window.__metrics` |

## 目录

```text
src/
  app/          Provider、路由、错误边界、App 根组件
  pages/        路由页面（登录、对话、记忆、答题记录、统计、404）
  features/     业务组件与业务 hook（auth、shell、chat、hitl、upload、stats）
  components/   通用组件与布局
  api/          HTTP 客户端、类型、各资源接口
  stores/       Zustand：auth-store、chat-store、ui-store
  lib/          SSE、AgentScope 投影与渲染策略、格式化、存储、Query 客户端
  styles/       设计 token 与全局样式
e2e/            Playwright 用例
```

## 关键实现

- **HTTP**：`src/api/client.ts` 统一注入 Bearer、解析错误、401 单飞刷新后重放一次；刷新失败清空令牌跳登录。
- **SSE**：`src/lib/sse/stream-controller.ts` 使用 `fetch` + `eventsource-parser`，支持断线退避（1/2/4/8/15/30s，最多 6 次）、45s 无数据看门狗、重连前重新拉取消息取新 `event_cursor`。
- **消息投影**：`src/lib/agentscope/project.ts` 把 `AgentEvent` 按 `reply_id` 分派给 `appendEvent`，按 `event.id` 去重（保留最近 1000 个），每帧合并一次渲染。
- **检查题 HITL**：`src/features/hitl` 渲染答题卡与确认卡，提交 `POST /sessions/{id}/events`；`metadata.question` 原样回传 `tool_call.input`，答案字段不进 DOM。
- **图片上传**：`src/features/upload` 先申请直传地址，再用 XHR PUT 到 COS（原样使用返回 headers），最后 `complete` 确认；仅图片、单条最多 4 张。
- **对话配图**：`mermaid` / `html` / `echarts` 三种围栏分别渲染成 Mermaid、沙箱 iframe、ECharts；流式未结束时先显示源码，解析失败也回退到源码。规则见 `app/agent/skills/diagrams/SKILL.md`：
  - Mermaid 固定 `securityLevel: strict`、`htmlLabels: false`、`theme: default`，写错语法时显示源码而不是空白；
  - HTML 放进 `sandbox="allow-scripts"` 的 `srcDoc` iframe（不开放同源，分步模板写 `sessionStorage` 会被浏览器拒绝，模板自带 try/catch），基础字体、颜色、行高由前端注入，高度由 iframe 内的 `postMessage` 回传，最高 700px；分步模板的脚本因此在 iframe 内运行；
  - ECharts 只接受合法 JSON option，`title`、`color`、`backgroundColor` 由前端主题接管，使用项目配色和 300px 高度。
- **统计图表**：`src/features/stats/charts.tsx` 复用 `src/lib/echarts.ts` 的 ECharts core 与主题，`src/lib/use-echart.ts` 统一处理初始化、resize、销毁；原先的 Recharts 已移除，两处图表共用同一份按需加载的 ECharts chunk。
- **滚动**：`Bubble.List` 关闭内置 `autoScroll`，由 `MessageList` 自行管理贴底、回到底部、向上翻页位置补偿。

## 部署

生产构建产物在 `dist/`，与 API 同源部署。Nginx 需对 `/api/` 关闭缓冲以保证 SSE：

```nginx
location / {
    root /var/www/web;
    try_files $uri $uri/ /index.html;
}

location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    gzip off;
}
```

其他前置：

- COS 桶配置 CORS：放行前端 origin，方法 `PUT/GET/HEAD`，允许 `Content-Type` 与签名头，暴露 `ETag`。
- 后端 `API_BASE_URL` 必须是浏览器可达的公网 origin，否则历史图片无法加载。

CSP 建议（包含配图 iframe 所需的放行）：

- HTML 配图使用 `srcDoc` iframe，其文档继承页面 CSP；分步模板的 inline script 需要 `script-src` 放行 inline，iframe 本身需要 `frame-src` 放行 `about:`/`srcdoc`。
- 若必须保持 `script-src 'self'`，可关闭 HTML 配图的脚本能力（改为 `sandbox=""`），此时分步模板不可用，静态 HTML 版面不受影响。

```text
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.myqcloud.com;
font-src 'self' data:;
connect-src 'self' https://*.myqcloud.com;
frame-src 'self' about:;
frame-ancestors 'none';
base-uri 'self';
```

## 首屏体积（实测）

`npm run build` 后统计登录页实际请求的资源：

| 项                          | 原始大小                   | 说明                                 |
| --------------------------- | -------------------------- | ------------------------------------ |
| 登录页首屏 JS               | ≈ 1.38 MB（gzip ≈ 430 KB） | 主要是 React 19 + antd 6             |
| 统计路由增量                | 60 KB（gzip 18 KB）        | 不含共享的 ECharts core              |
| 代码高亮 / KaTeX / Mermaid  | 按需加载                   | 出现代码块、公式、mermaid 时才拉取   |
| ECharts core（配图 + 统计） | 535 KB（gzip 181 KB）      | 首次出现配图或进入统计页时加载并共享 |
| 配图独有图表类型            | 53 KB（gzip 19 KB）        | bar / pie / scatter / gauge          |
| HTML 配图                   | 按需加载                   | 出现 html 围栏时才拉取               |

对话页按 Spec 要求同步加载，因此首屏包含 `@ant-design/x` 与 Markdown 渲染器。若后续需要压到 320 KB gzip 以内，可把 `/chat` 改为路由懒加载，代价是首屏多一次 chunk 往返。

## 已知限制

- 会话标题在首轮回复后由 AgentScope 自动生成，不支持手动重命名。
- 答题记录每完成一次检查题就新增一条，不是错题本。
- 检查题答案随 `tool_call.input` 下发，DevTools 可见，属于形成性练习。
- 没有服务端登出接口，退出只清客户端状态。
- 生产环境若 `API_BASE_URL` 配置错误，历史图片会 404。
