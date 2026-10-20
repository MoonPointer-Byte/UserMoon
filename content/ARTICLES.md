# 文章与数据

## 自动同步

打开「文章」页就会自动拉取，**不需要点同步**。

- 有缓存：先展示，再后台刷新  
- 无缓存：等这一次拉取完成  

CSDN 用的是站点 `home-api`：

`https://blog.csdn.net/community/home-api/v1/get-business-list?username=你的ID&businessType=blog&page=1&size=20`

正文再按文章页 HTML 抽取；失败时仍保留标题/摘要，并可打开原文。

GitHub 默认同步作品目录各仓库 `README.md`。

## 配置入口

导航「数据」→ `/UserMoon/manage`：

1. 填 CSDN 用户名  
2. 保存（会写入 SQLite，并触发拉取）  

也可改 `content/articles.json`（会镜像进数据库 `settings.articles_config`）。

## SQLite

库文件：`server/usermoon.db`

| 表 | 内容 |
|----|------|
| visits | 访问计数 |
| notes | 留言 |
| articles | CSDN / GitHub 缓存正文 |
| settings | 源配置等 |
| agent_runs | Agent 会话 |

本地 Markdown 仍在 `content/posts/`，打开时与库内远程文章合并展示。
