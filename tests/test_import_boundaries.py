import ast
from collections.abc import Iterator
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"


def _module_name(path: Path) -> str:
    relative = path.relative_to(ROOT).with_suffix("")
    parts = list(relative.parts)
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


def _package_name(path: Path) -> str:
    module = _module_name(path)
    if path.name == "__init__.py":
        return module
    return module.rpartition(".")[0]


def _resolve_from(package: str, level: int, module: str | None) -> str:
    if level == 0:
        return module or ""

    parts = package.split(".")
    if level > 1:
        parts = parts[: -(level - 1)]
    if module:
        parts.extend(module.split("."))
    return ".".join(parts)


def _imports(path: Path) -> Iterator[tuple[str, int]]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    package = _package_name(path)

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield alias.name, node.lineno
        elif isinstance(node, ast.ImportFrom):
            base = _resolve_from(package, node.level, node.module)
            if base:
                yield base, node.lineno
            for alias in node.names:
                if alias.name == "*":
                    continue
                candidate = f"{base}.{alias.name}" if base else alias.name
                yield candidate, node.lineno


def _violations(source: Path, forbidden: str) -> list[str]:
    result: list[str] = []
    for path in source.rglob("*.py"):
        for module, lineno in _imports(path):
            if module == forbidden or module.startswith(f"{forbidden}."):
                result.append(f"{path.relative_to(ROOT)}:{lineno}: {module}")
    return result


def test_agent_does_not_import_api() -> None:
    assert _violations(APP / "agent", "app.api") == []


def test_api_does_not_import_agent() -> None:
    assert _violations(APP / "api", "app.agent") == []


def test_shared_does_not_import_process_packages() -> None:
    assert _violations(APP / "shared", "app.api") == []
    assert _violations(APP / "shared", "app.agent") == []
