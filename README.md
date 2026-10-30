# UserMoon

MoonPointer 的个人站点。React + Vite，默认是舞台首页；经典桌面可以在页内切回去。

## 页面

- 舞台首页：流体背景、PRESS START、名片入口
- Blog `/articles`、Thoughts `/shares`、About `/about`
- Album `/honors`：蝴蝶散开后按 Honors、Life、Interest 看照片
- Projects `/projects`：作品 3D 展台
- Works `/works`：同一时间只启动一个真实项目，并用 `/live` 嵌入
- Thinking `/agent`：站内对话。模型密钥只有主人能设置

相册照片放在：

- `src/assets/album/honors`
- `src/assets/album/life`
- `src/assets/album/interest`

## 本地运行

```bash
npm install
npm run dev
```

打开 http://localhost:5173/UserMoon/

访问计数、留言和文章索引会连 MySQL / MongoDB。数据库暂时连不上时，接口返回 503，页面本身不会被拖垮。连接信息见 `.env.example`。

真启动依赖本机进程，不能只靠 GitHub Pages。访客要切换真实项目，需要把预览服务跑在服务器上。

## 部署

服务器上：

```bash
sh ~/UserMoon/docker/deploy-site.sh
```

## 启动策略

| 项目 | 方式 |
| --- | --- |
| Ideaface / MoonReader / MoonPointerAI | 本地目录或 GitHub 克隆后启动 |
| AnswerBook / MoonMusic | 静态服务真实仓库文件 |
| MoonKeyboard | Flutter Web |

优先使用 `shared/catalog.json` 里的 `localPath`；没有本地副本时，用已登录的 `gh` 拉到 `runtime/projects/`。
