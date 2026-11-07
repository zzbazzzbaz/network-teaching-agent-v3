# 教学资料库

`library/` 是 agent 只读虚拟文件系统的根目录，虚拟路径 `/` 对应本机 `library/`。

## 目录约定

```text
library/
└── computer-networks-8e/
    ├── 00-toc.md
    ├── 01-概述/
    ├── ...
    ├── 09-无线网络和移动网络/
    ├── appendices/
    ├── figures/
    ├── exercises/          # 可选：习题
    └── answers/            # 可选：答案
```

- 书目录使用 ASCII slug，例如 `computer-networks-8e`，它同时是虚拟路径里的书标识。
- 教材正文直接放在书目录下，不再额外套一层 `textbook/`。
- `figures/` 放图片和图注索引；章节文件里的图片用 `../figures/...` 引用。
- 习题、答案等可选目录与章节并列，用英文目录名区分。
- 子目录和文件名可以用中文，保持原书结构即可。
- 以 `.` 开头的目录和文件不会出现在虚拟文件系统里。

`book.json` 可选，只用于给 `materials_ls` 和引用头部提供显示名；没有时使用目录 slug：

```json
{
  "title": "计算机网络（第8版）",
  "author": "谢希仁",
  "edition": "第8版"
}
```

## 文件元数据

Markdown 文件可以在 frontmatter 里写引用信息，`materials_read` 会把它们渲染成一行头部：

```yaml
---
section: "5.5"
title: "TCP报文段的首部格式"
book_pages: [225, 229]
---
```

字段：

- `section`：小节号，数字开头会推导出 `第X章`，字母开头推导出 `附录X`。
- `title`：小节标题。
- `book_pages` 或 `pages`：页码范围，支持 `[起始, 结束]` 或单个页码。
- `citation`：完整引用文本；存在时原样输出，不再合成。

没有这些字段时，`materials_read` 只输出文件路径，不编造页码。

## 新增一本书

1. 在 `library/` 下建 ASCII slug 目录；
2. 把 Markdown 直接放进书目录，按上面的 frontmatter 约定补元数据；
3. 需要中文显示名时再放 `book.json`，不需要就不用；
4. 不需要改代码，agent 通过 `materials_ls`、`materials_read`、`materials_grep` 访问。

## 部署

资料库根目录必须通过 `MATERIALS_DIR` 显式配置，没有默认值：

```text
MATERIALS_DIR=/srv/teaching-materials
```

本地开发可以指向 `app/agent/resource/library` 的绝对路径。容器内建议只读挂载。这个目录会被完整暴露给 agent，不要放密钥或运行时数据。
