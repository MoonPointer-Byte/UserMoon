# 项目源码目录

作品舞台按 `shared/catalog.json` 的 `localPath` 读取真实代码。本机常见位置：

| 项目 | 路径 |
| --- | --- |
| Ideaface | `D:\个人项目\Ideaface\frontend`（本机） |
| MoonReader | `D:\个人项目\MoonReader\XS_frontend\frontend` |
| MoonMusic | `D:\usermoon-src\MoonMusic` |
| MoonKeyboard | `D:\usermoon-src\MoonKeyboard` |
| MoonPointerAI | `D:\usermoon-src\MoonPointerAI\web` |
| AnswerBook | `D:\usermoon-src\AnswerBook` |

服务器上的副本放在 `USERMOON_SRC_ROOT`（默认 `/home/ubuntu/usermoon-src`）。

缺少代码时，可手动执行：

```bat
gh api repos/MoonPointer-Byte/<仓库名>/zipball > D:\usermoon-src\<仓库名>.zip
```

然后解压到 `D:\usermoon-src\<仓库名>`。
