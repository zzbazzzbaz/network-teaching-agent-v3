- 没有用户明确同意，不要读`./docs/chat/`目录下的文件
- 代码需要有良好的可读性
- 代码中禁止加注释，除非用户明确要求

## 项目架构

api端 `app/api/main.py`
agent端 `app/agent/main.py`

双进程启动，只有api端面向公网，agent端在内网环境，api端代理agent端的流量。
agent端的tool可能依赖于api端，agent端通过http网络请求端方式从api端获取数据。
    例如：`app/api/endpoints/internal_question.py`、`app/agent/tools/client.py`

## 项目背景

最大并发是100用户同时使用流式对话

## 时间与日期约定

时刻统一使用 UTC，日期统一使用 `YYYY-MM-DD`，两者不能混用。

### 存储与传输

- 时刻：数据库使用 `timestamp with time zone`，代码中使用 aware UTC 时间（`datetime.now(UTC)`），禁止 naive datetime。
- 数据库连接显式固定会话时区为 UTC，存储层不依赖服务器默认时区。
- 禁止在 API、数据库、跨进程传输中出现 `2026-11-06T00:00:00` 这类不带时区的时间字符串。
- API 出参：RFC 3339 UTC，以 `Z` 结尾，例如 `2026-11-06T10:01:32.997759Z`。
- API 入参：精确时刻使用 `pydantic.AwareDatetime`，拒绝不带时区的值。
- 日期：统一使用 `YYYY-MM-DD`，对应 Python `date`，例如 `2026-11-06`。
- 数据库纯日期字段使用 `date` 类型，不要用 timestamp 保存日期。

### 业务时区

- 业务时区固定为 `Asia/Shanghai`，代码中统一使用 `ZoneInfo("Asia/Shanghai")`，不要手写 `+8` 或固定 offset。
- 存储始终是 UTC；`Asia/Shanghai` 只用于把“某一天”换算成 UTC 查询区间，以及前端展示。
- 日期筛选参数保持 `YYYY-MM-DD`，后端按 `Asia/Shanghai` 解释为当天 `[00:00, 次日 00:00)`。

### 精度

- 数据库和 API 保留亚秒精度，不要为了展示统一截断到秒。
- 只在展示层按需格式化为秒或分钟。

### 展示与命名

- 前端展示时刻时显式指定 `timeZone: 'Asia/Shanghai'`，不要依赖浏览器本地时区。
- 前端提交时刻使用 `new Date().toISOString()`，提交日期使用 `YYYY-MM-DD`。
- 字段名以 `_at` 结尾表示时刻，以 `_date` 结尾表示日期，禁止 `created_date` 这类歧义命名。

### 例外

- JWT 的 `iat` / `exp`、对象存储签名过期时间等协议字段按协议使用 epoch 秒。
