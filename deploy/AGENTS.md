# deploy

服务器 `101.35.223.219`（Ubuntu 24.04），域名 `network-agent2.test.chatgqt.top`，
部署根 `/srv/network-teaching-agent-v3`，只放 `.env`、`docker-compose.yml`。
nginx 由 `bootstrap.sh` 一次性安装，CD 不改 nginx。不要动同机 docx-check 和 network-agent。

## 文件

| 路径 | 作用 |
|---|---|
| `docker-compose.yml` | web/api/agent + postgres/redis/qdrant |
| `nginx.conf` | 系统 nginx 站点配置 |
| `bootstrap.sh` | 一次性初始化，sudo 幂等 |
| `docker/{api,agent,web}.Dockerfile` | CI 构建，服务器不构建 |

端口：web `8084`、api `8085`、agent `8086`，全部只绑 `127.0.0.1`。
路由：`/api/`、`/health` → 8085；其余 → 8084。agent 只在容器网络内被 api 访问，不经过 nginx。

## 配置

- 唯一配置源项目根 `.env`（样板 `.env.example`），服务器 `.env` 按生产环境修改后 `chmod 600`。
- compose 硬编码容器内地址：`DB_URL` 指向 `postgres`、`REDIS_HOST` 指向 `redis`、
  `QDRANT_URL` 指向 `qdrant`、`AGENT_BASE_URL` 指向 `agent`、`API_BASE_URL` 指向 `api`。
- `JWT_SECRET_KEY` 生产使用随机高熵值（`openssl rand -hex 32`）。
- `DATA_ROOT=/data`，agent 的 `agent-data` 卷保存工作区与记忆；其余状态在 postgres/redis/qdrant 卷。
- 镜像仓库写死，tag 由 CD 动态传入，只允许 `sha-<40 位 commit>`。
- 缺少 `.env` 或 tag 格式不对，直接失败；不设默认值、不回退、不兜底。

## 部署 / 回滚

```bash
gh workflow run cd.yml -f tag=sha-<40位commit>
```

回滚传旧 commit。首次部署：同步 `deploy/` 后 `sudo bash bootstrap.sh`。
CD 分 `validate` → `deploy` → `verify`；只同步 `docker-compose.yml`。

## 首次初始化

库表由 api 启动时自动创建，管理员和教材需要手动初始化一次：

```bash
docker exec -it network-teaching-agent-v3-api-1 \
  python -m scripts.manage_user create --username admin --password <password> --role admin
docker exec -it network-teaching-agent-v3-api-1 \
  python -m scripts.import_materials
```

`scripts/` 已打进 api 镜像；导入脚本默认读取镜像内的 `app/agent/resource/materials`。
