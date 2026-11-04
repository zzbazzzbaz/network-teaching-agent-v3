# 技能目录

这里的每个子目录是一个 AgentScope Skill，必须包含 `SKILL.md`：

```
app/agent/skills/
└── <skill-name>/
    ├── SKILL.md        # 必需，frontmatter 要有 name 和 description
    └── ...             # 可选的参考资料/脚本
```

`SKILL.md` 示例：

```markdown
---
name: subnet-drill
description: 出子网划分练习题并按步骤批改
---

# 子网划分练习

1. 先向学生要目标网段和掩码长度...
```

工作机制：

- 服务启动时 `build_workspace_manager()` 扫描 `skills/*/SKILL.md`，把目录路径作为
  `skill_paths` 传给 `LocalWorkspaceManager`；
- 工作区初始化时这些技能复制进 `skills/.seed`，每个 agent 首次使用时装备一份副本；
- `Toolkit` 把技能摘要注入系统提示的 `<agent-skills>` 段，模型通过 `SkillViewer`
  工具读取正文，再按正文执行。

注意：技能只在工作区**首次装备**时复制。改了 `SKILL.md` 后，已存在的 agent
分区不会自动更新；本地开发时删掉对应工作区目录即可重新装备。
