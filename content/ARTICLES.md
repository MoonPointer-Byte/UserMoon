# 文章与数据

## 自动同步

打开「文章」页就会自动拉取，不需要再点一次同步。

- 有缓存：先展示，再在后台刷新
- 无缓存：等这一次拉取完成

CSDN 用的是站点 `home-api`：

`https://blog.csdn.net/community/home-api/v1/get-business-list?username=你的ID&businessType=blog&page=1&size=20`

正文再按文章页 HTML 抽取。抽取失败时仍保留标题和摘要，并可以打开原文。

GitHub 默认同步作品目录里各仓库的 `README.md`。

## 配置入口

主人台 `/owner?tab=sources`：

1. 填 CSDN 用户名和 GitHub 所有者
2. 保存并拉取

配置写入 MySQL 的 `settings.articles_config`。仓库里的 `content/articles.json` 只在数据库还没有这份配置时当作种子。

## 数据库

元数据在 MySQL，长正文在 MongoDB。连接见 `.env.example`。

| 存储 | 内容 |
| --- | --- |
| MySQL `visits` | 访问计数 |
| MySQL `notes` | 留言 |
| MySQL `articles` | 文章索引 |
| MySQL `settings` | 文章源、个人档案、成就、Agent 配置 |
| MongoDB `articles` | 文章 HTML / 正文 |
| MongoDB `agent_runs` | Agent 会话 |
| `content/posts/` | 本站 Markdown，打开时与远程文章合并 |

数据库暂时连不上时，接口返回 503，页面本身不会被拖垮。
