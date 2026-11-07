---
name: computer-networks-textbook
description: 计算机网络教材原文与页码，位于只读资料库 /computer-networks-8e/，是课程事实的唯一来源。讲概念、定位小节、引用页码、核对知识点编号时使用。
metadata:
  course: 计算机网络
  scope: teaching
  source: 计算机网络（第8版） · 谢希仁
---

# 计算机网络教材

> 教材：计算机网络（第8版），谢希仁。

这里只有教材事实：正文、页码、图注。出题和题库操作走 `quiz_student` / `get_question` 工具，进度和误解记在 `/memory`。

## 1. 资料位置

```text
/computer-networks-8e/
├── textbook/
│   ├── 00-toc.md          # 书本目录（章节结构、页码）
│   ├── 01-概述/ ... 09-无线网络和移动网络/
│   └── appendices/
└── figures/
    └── index.md           # 图注索引
```

教材正文只读。用 `materials_ls` 浏览目录，`materials_read` 读单节，`materials_grep` 搜索。不要把整章或整本书一次性加载。

## 2. 检索流程

1. 定位：`materials_ls("/computer-networks-8e/textbook")` 看章节；不确定文件名时用 `materials_grep("拥塞控制", path="/computer-networks-8e/textbook")`；
2. 读正文：`materials_read("/computer-networks-8e/textbook/05-运输层/5.8.2-TCP的拥塞控制方法.md")`；
3. 引用：只取回答需要的一两段，按工具返回的 `【…】` 头部作答。

章节地图用 `textbook/00-toc.md` 或 `materials_ls`，不要为此读完整章正文。

第一轮没命中就换同义词、英文缩写或相邻小节，不要猜。

## 3. 页码与引用

- 页码来自 `materials_read` 返回的 `【… | 第A-B页】`，不要引用目录或推测页码；
- 只有头部明确给出单页时才写单页；
- 区间引用：`见第 5 章 5.8.2，第238-244页。`
- 教材没有覆盖时，直接说明这一点，不要编造原文或页码。
