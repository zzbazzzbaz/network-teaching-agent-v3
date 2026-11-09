---
name: computer-networks-textbook
description: 计算机网络教材原文，是课程事实的唯一来源。讲概念、定位小节、引用页码、核对知识点编号时使用。
---

# 计算机网络教材

> 教材：计算机网络（第8版），谢希仁。

这里只有教材事实：正文、页码、图注。出题只走 `quiz_student` 工具，进度和误解记在 `/memory`。

## 1. 资料位置

```text
/computer-networks-8e/
├── 00-toc.md              # 书本目录（章节、小节、教材页码）
├── 01-概述/ ... 09-无线网络和移动网络/
├── appendices/
└── figures/
    └── index.md           # 图注索引
```

教材正文只读。用 `materials_ls` 浏览目录，`materials_read` 读文件，`materials_grep` 搜索。不要把整章或整本书一次性加载。

## 2. 检索流程

1. 先读 `materials_read("/computer-networks-8e/00-toc.md")`，确认章节、小节和教材页码；
2. 用 `materials_ls("/computer-networks-8e")` 看章节目录，再 `materials_ls("/computer-networks-8e/05-运输层")` 找小节文件；
3. 用 `materials_read("/computer-networks-8e/05-运输层/5.8.2-TCP的拥塞控制方法.md")` 读单节；
4. 文件名不确定时用 `materials_grep("拥塞控制", path="/computer-networks-8e/05-运输层")`，一次搜一个关键词。

`materials_read` 默认返回 300 行。如果正好返回 300 行，可能还有后续，用 `offset=301` 继续。

## 3. 页码与引用

- 页码从 `00-toc.md` 对应条目的括号里推断，例如 `5.5 TCP报文段的首部格式（教材 225）`；
- 引用时使用这个页码，例如 `见第 5 章 5.5，教材第 225 页起`；
- 需要页码范围时，用相邻小节的起始页作边界，并说明是推断；
- 目录里没有给出的页码不要编造；
- 教材没有覆盖时，直接说明，不要编造原文或页码。
