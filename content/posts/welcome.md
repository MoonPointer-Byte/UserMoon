---
title: 在这里读文章
date: 2026-10-20
summary: 本站博客台怎么用：本站发布、CSDN、GitHub 三处来源。
tags: [指南]
---

# 在这里读文章

MoonPointer 的文章页按博客软件来组织：左侧找文，中间安静阅读。视觉仍是站点自己的像素 / 终端 / 纸页风格。

## 三种来源

1. **本站**：把 Markdown 放进 `content/posts/`，带上标题、日期和摘要。
2. **CSDN**：在 `content/articles.json` 里登记链接，这里提供目录与阅读入口，正文仍以 CSDN 原文为准。
3. **GitHub**：登记仓库里的 `.md` 路径，站点会拉取并渲染，方便把 README、设计说明也当成文章读。

## 本站文章示例

```md
---
title: 标题
date: 2026-10-20
summary: 一句话说明
tags: [随笔]
---

正文从这里开始。
```

## 登记外部文章

在 `content/articles.json` 的 `entries` 里追加：

```json
{
  "slug": "csdn-demo",
  "title": "标题",
  "date": "2026-01-01",
  "summary": "摘要",
  "source": "csdn",
  "url": "https://blog.csdn.net/你的ID/article/details/……",
  "tags": ["笔记"]
}
```

GitHub 文章可以写成：

```json
{
  "slug": "repo-readme",
  "title": "某个仓库说明",
  "date": "2026-01-01",
  "summary": "从仓库读来的说明",
  "source": "github",
  "repo": "MoonPointer-Byte/UserMoon",
  "path": "README.md",
  "ref": "main",
  "tags": ["文档"]
}
```

读完这篇，可以从左侧或文章列表继续逛。
