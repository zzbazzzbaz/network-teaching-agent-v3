- 没有用户明确同意，不要读`./docs/chat/`目录下的文件
- 代码需要有良好的可读性
- 代码中禁止加注释，除非用户明确要求

## 项目架构

api端 `app/main.py`
agent端 `app/agent/main.py`

双进程启动，只有api端面向公网，agent端在内网环境，api端代理agent端的流量。
agent端的tool可能依赖于api端，agent端通过http网络请求端方式从api端获取数据。
    例如：`app/api/endpoints/internal_question.py`、`app/agent/tools/client.py`

## 项目背景

最大并发是100用户同时使用流式对话