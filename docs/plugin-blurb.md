# 插件简介与关键词标签

用于插件市场 / 目录索引 / 仓库 About 栏的文案素材。**每一段都可直接复制**，按字数上限选用。

> 事实依据：`plugin/package.json`（name `dsh-plugin-session-purge`、version `1.0.0`、MIT、无 dependencies）
> 与 `plugin/lib/index.js`、`plugin/lib/client.js`（删除范围见 README 的关联数据表）。

---

## 一、仓库 About 栏（GitHub description，限 350 字符）

**中文（推荐，89 字）**

```
DSH 会话管理插件：永久删除会话，连同它的日志、投影缓存、工作区记账与子会话（子代理）一起清掉。设置页 + 对话头部两个入口，删除不可恢复。
```

**English（备选，推荐用于国际曝光）**

```
DSH session manager: permanently delete a session along with its log, projection cache, workspace bookkeeping and child (subagent) sessions. Settings page + conversation-header entry points. Deletion is irreversible.
```

---

## 二、一句话简介（限 60 字 / 120 字符）

**中文**

```
真正把 DSH 会话删掉：日志、投影缓存、工作区记账与子会话一起清。
```

**English**

```
Actually delete DSH sessions — log, projection cache, workspace claims and child sessions, all at once.
```

---

## 三、标准简介（限 120 字 / 240 字符）

**中文**

```
DSH 的「归档」只是隐藏，不删文件。本插件补上「真删」：设置页与对话头部两个入口，永久删除会话，并级联清理它的日志目录、投影缓存、工作区记账与子会话（子代理）。按工作区分组、可筛选、可批量删除、可一键清理归档。删除不可恢复，请先备份。
```

**English**

```
DSH's "archive" only hides a session — the files stay. This plugin adds the missing step: real deletion from the settings page and the conversation header, cascading over the session's log directory, projection cache, workspace claims and child (subagent) sessions. Grouped by workspace, filterable, with batch delete and one-click archive cleanup. Irreversible — back up first.
```

---

## 四、长简介（用于插件市场详情页 / awesome list 条目说明）

**中文**

```
dsh-plugin-session-purge —— DSH 会话管理插件。DSH 自带的归档只把会话从列表里隐藏，磁盘上的日志与投影缓存一个字节都不动；本插件补上缺失的「真删」这一步。

提供两个入口：设置页的「会话管理」分区，以及对话头部的删除按钮。删除一个会话时，它的四类关联数据会一并清理：~/.dsh/sessions/<工作区文件夹>/<会话ID>/ 下的日志目录、~/.dsh/storages/session_projcache/sessions/<会话ID>.json 投影缓存、workspace.json 里的工作区记账，以及该会话在同一工作区文件夹下派生的子会话（子代理）。

子会话的判定条件保守：与父会话同文件夹、且不在任何 workspace 的 sessionIds 里 —— 保证绝不误删别的正常会话。面板按工作区分组，每行显示标题、会话 ID、体积、目录最后修改时间与状态标记（打开中 / 已归档 / 子会话 N / 无工作区），支持筛选、多选批量删除与「删除全部已归档会话」。

本插件无配置项、无运行时依赖、无构建步骤（浏览器半边是手写的 DSH 客户端模块）。整个面板包在 React error boundary 内，渲染出错不会影响设置面板其他分区。删除不可恢复、不进回收站，请先备份。
```

---

## 五、一句话卖点（用于 awesome list 的一行条目）

> 收录格式参考 awesome-dsh-plugin：「`- [名称](链接) — 一句话描述`」

```
- [dsh-plugin-session-purge](https://github.com/<owner>/dsh-plugin-session-purge) — 永久删除 DSH 会话（非归档），级联清理日志、投影缓存、工作区记账与子会话。
```

> **TODO**：`<owner>` 替换为实际 GitHub 用户名 / 组织名。

---

## 六、关键词标签

### package.json `keywords`（建议直接粘贴）

```json
"keywords": [
  "deepseek",
  "deepseek-harness",
  "dsh",
  "dsh-plugin",
  "session",
  "session-management",
  "session-purge",
  "delete-session",
  "cleanup",
  "storage",
  "settings-page"
]
```

> **TODO**：`plugin/package.json` 当前**没有** `keywords` 字段，提交前需补上。

### GitHub Topics（仓库 About → Topics，逐条添加）

```
dsh-plugin
deepseek-harness
dsh
deepseek
cordis
session-management
cleanup
```

> 说明：`dsh-plugin` 与 `deepseek-harness` 是社区发现机制的必需项——官方 `deepseek-ai/deepseek-harness`
> 仓库即使用 `dsh-plugin` topic 做插件检索，`dsh-find-plugin`、`dshmarket` 也都依赖它。其余为分类补充项。

---

## 七、徽章（README 顶部，已用于本仓库 README）

```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](./CHANGELOG.md)
[![Topic](https://img.shields.io/badge/topic-dsh--plugin-1f6feb.svg)](https://github.com/topics/dsh-plugin)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
```

> awesome-dsh-plugin 官方提供的收录徽章地址为
> `[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)`，
> 收录成功后即可挂上。
