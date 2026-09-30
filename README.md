# 记录人类完蛋全过程

一个**无构建步骤**的静态档案馆：记录从 ENIAC（1946）到当下值得记下的 AI 里程碑，并用「人类剩余血条」估算各领域还剩多少人类的事。

打开方式：直接双击 `index.html`，或把本目录部署为 GitHub Pages **仓库根目录**。无需 npm。

## 重要声明

**血条是编辑估算（估算），不是测量。** 基准日写在 `data.json` 的 `updated` 字段（当前为 2026-09-30）。界面会标注「估算」，请勿当作科研结论引用。

时间线条目的日期与模型名均应可核验；不确定的条目不要写进数据。

## 如何改数据

唯一内容源是 **`data.json`**：

- `events`：追加时间线。字段：`date`（ISO）、`title`、`blurb`（中文一句）、`era`、`tags`。
- `domains`：领域树。父节点可有 `note`；子节点（叶）需有 `remaining`（0–100）、`note`、`movedBy`。
- 父级血条**不要手写**：页面用子节点算术平均并取整。
- 全站总剩余 = 全部叶节点平均。

改完保存即可；刷新页面生效。日后可用脚本每天追加一条 `events`、微调若干 `remaining`。

本地用浏览器直接打开 `index.html`（`file://`）时，请同步维护 `data.js`（`window.__HUMANITY_DATA__ = …`，内容与 `data.json` 一致）。GitHub Pages / 任意 HTTP 静态托管优先读取 `data.json`。可用：

```bash
python3 -c "import json;from pathlib import Path;d=json.loads(Path('data.json').read_text(encoding='utf-8'));Path('data.js').write_text('window.__HUMANITY_DATA__ = '+json.dumps(d,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')"
```

## 文件

| 文件 | 作用 |
|------|------|
| `index.html` | 结构 |
| `styles.css` | 暗色档案风样式 |
| `app.js` | 读取 JSON、渲染血条与时间线 |
| `data.json` | 全部文案与分数（HTTP 源） |
| `data.js` | `file://` 回退包装，与 JSON 同内容 |
| `preview.png` | 可选预览截图 |

## 设计备忘

背景 `#0e0d0c`，骨色字 `#f3efe6`，耗尽强调 `#d85a3a`，尚存人类优势用暗绿 `#8aa57a`。标题用碑铭感衬线，中文 UI 贯穿全站。
