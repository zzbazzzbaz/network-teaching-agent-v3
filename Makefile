up:
	docker compose up -d --wait

down:
	docker compose down

install:
	uv sync
	cd web && npm ci

run-api:
	uv run uvicorn app.api.main:app --host 127.0.0.1 --port 8000

run-agent:
	uv run uvicorn app.agent.main:app --host 127.0.0.1 --port 8001

run-ui:
	cd web && npm run dev

dev:
	@echo "启动 agent (:8001) / api (:8000) / web (:5173)，Ctrl-C 退出"
	$(MAKE) -j3 run-agent run-api run-ui

test:
	uv run pytest
	cd web && npm test
