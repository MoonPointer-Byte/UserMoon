# UserMoon

**MoonPointer** 个人网站 — React + Vite，带「单槽位真启动」展示台。

## 能力

- 首页玻璃桌面（蓝灰）
- 项目库 / 关于 / 启动台
- **真启动**：同一时间只运行一个项目进程，并通过 `/live` 嵌入真实页面
- **公共记录栏**：所有访客共享启动 / 切换 / 停止日志

## 本地运行

```bash
npm install
npm run dev
```

打开：http://localhost:5173/UserMoon/

> 真启动依赖本机 Node 进程，不能只靠 GitHub Pages 静态托管。访客要看到可切换的真实项目，需要把这个开发/预览服务跑在服务器上。

## 启动策略

| 项目 | 方式 |
| --- | --- |
| Ideaface / MoonReader / MoonPointerAI | 本地目录或 GitHub 克隆后 `npm run dev` |
| AnswerBook / MoonMusic | 静态服务真实仓库文件 |
| MoonKeyboard | Flutter Web |

优先使用 `shared/catalog.json` 里的 `localPath`；没有本地副本时会用已登录的 `gh` 从 GitHub 拉取到 `runtime/projects/`。
