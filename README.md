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

整站是一块 1920×1080 的 16:9 舞台，按视口等比缩放，四个章节（总览 / 时间轴 / 领域血条 / 出局名单）以斜切快门转场切换，明暗交替。

配色：右上角可切换三套（按 `T` 也可循环），选择存于 localStorage。每套只定义 `styles.css` 顶部的十来个基础色，其余半透明色均由 `color-mix` 派生：

- `endfield` 终末地黄黑（默认）：深底 `#0c0d0f`、纸底 `#e8e6e0`、工业黄 `#ffe600`、临界红 `#e8452c`
- `cobalt` 蓝白：钴蓝底 `#0f3b8c`、白纸 `#eef2f8`、藏青 `#0a2252`、天蓝强调 `#41c8ff`
- `tundra` 苔原信号绿：苔黑底 `#0f1310`、砂纸 `#e2e4d6`、酸性绿 `#c6f135`、信号橙 `#ff5b37`

字体：Barlow Condensed（数字与拉丁标题）、Noto Sans SC（中文）、JetBrains Mono（编号与日期）。

时间轴保持真正的时间轴形态：底部时间轨随拖动平移，事件按时间排列，阶段以色带标出。唯一状态是浮点位置 `pos`（单位为事件序号），由拖拽、滚轮、键盘或自动回放驱动，经临界阻尼弹簧平滑；任何中间位置都对应一个确定的画面。

围绕时间轴的是由 `pos` 驱动的图形分镜（`app.js` 中 `scenes()`）：每个关键事件有一组平面元素——ENIAC 的真空管阵列、图灵的竖排诘问、深蓝倒下的王、AlphaGo 的第 37 手、GPT 参数量的线性比例尺、ChatGPT 的辞职信对话……它们在拖向该事件时逐个展开、随拖动漂移，离开时收起或倒下。没有专属分镜的事件使用统一的排版卡。阶段切换时左上角章节牌与英文大字随之更替。

叙事主线是「人类剩余」：时间轨上方的推演曲线与右侧逐渐扩张的机器领地（斜线区）都由叶节点的 `movedBy` 与事件标题的匹配推算——命中事件处该项降到当前剩余值，未命中的项自 ChatGPT 起线性下降，终点等于总览页的总剩余。曲线只画到当前位置，未来部分为虚线。这是示意推演，不是逐日记录。每个事件被让渡的工作以标签形式从左侧滑入、向机器一侧离开。
