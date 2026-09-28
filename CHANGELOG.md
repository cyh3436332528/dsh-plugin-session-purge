# Changelog

本文件记录 `dsh-plugin-session-purge` 的所有重要变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### TODO

- 为 `plugin/package.json` 补充 `dsh.compatibility` 字段，声明支持的 DSH 版本区间。
- 为 `plugin/package.json` 补充 `keywords` 字段（词表见 `docs/plugin-blurb.md`）。
- 补充 `docs/assets/` 下的实际效果截图。
- 为删除路径补自动化测试（当前 `plugin/_smoke.mjs` 只覆盖只读的 `/list` 路由）。

---

## [1.0.0] - 2026-09-16

首个正式版本。

> 日期依据：`plugin/` 目录内各文件的文件系统时间戳为 2026-09-16。
> **TODO**：若实际发布日期不同，请以正式发布日为准修改本节标题日期。

### Added

- **设置页入口**：注册 `settings.section`（`id: session-purge`、`order: 90`、`label: 会话管理`），
  并在设置页导航栏为该分区绘制垃圾桶图标（通过 `mask-image` 走 `currentColor`，自动跟随主题）。
- **对话头部入口**：在会话标题栏提供删除按钮。
- **会话列表**：按工作区分组展示磁盘上的全部会话，卡片头显示数量与合计体积，
  卡内按体积降序排列；每行给出标题、会话 ID（超 12 字符截断）、占用体积、目录最后修改时间（相对时间），
  以及 `打开中` / `已归档` / `子会话 N` / `无工作区` 状态标记。
- **筛选**：按标题 / 会话 ID / 工作区名过滤列表。
- **单个会话删除**：行内二次确认，确认块列出会话、ID、体积、时间、子会话数量与「正在打开」警告。
- **子会话级联删除**：可选删除与父会话同工作区文件夹、且未被任何 workspace 认领的会话（子代理）。
- **批量删除**：多选后一次性删除，逐条串行执行并聚合结果；单条失败不会中断整批。
- **「删除全部已归档会话」**：独立危险卡片，带独立确认步骤，仅在存在已归档会话时渲染。
- **宿主侧删除实现**：
  - 递归删除 `~/.dsh/sessions/<工作区文件夹>/<会话ID>/` 日志目录；
  - 删除 `~/.dsh/storages/session_projcache/sessions/<会话ID>.json` 投影缓存；
  - 通过 `workspaceRegistry.enqueueOperation()` 修改域表 `sessionIds` 与全局 `archivedSessionIds`，
    并调用 `rebuildEntities()` 重建内存实体（否则侧栏的行不会消失）；
  - 驱逐宿主内存中的活会话条目（调用 `SessionStore` 条目的 `detach()`，该路径幂等并会发出 `session/disposed`）；
  - registry 不可用时回退为直接改写 `workspace.json`。
- **宿主侧 HTTP 接口**：`GET /x-session-purge/list`、`POST /x-session-purge/delete`
  （请求体 `{ id, children }` 或 `{ allArchived: true }`）。
- **`pending` 语义**：删除时仍处于打开状态的会话会保留工作区归属并在响应中列为 `pending`，
  由界面明确提示「列表项需等 DSH 重启后消失」。

### Changed

- 删除操作不进入任何回收站，不做二次备份——这是设计取舍，详见 README 的「风险提示」。

### Security

- 面板整体包在 React error boundary 内，插件渲染失败不会外溢到设置面板的其他分区。
- 未使用 `window.confirm` / `window.alert`，确认交互完全由插件自身实现。
- 未执行整页 reload。
- 普通按钮使用官方 `@deepseek-ai/dsh-client-ui-primitives` 的 `Button`，配色走官方 `--dsw-alias-*` CSS 变量。

### Known Issues

- 处于打开状态的会话，其列表项要等 DSH 重启后才会消失（文件已实时删除）。
- 删除路径无自动化测试覆盖。

---

## 版本对照

| 插件版本 | 日期 | 说明 |
|---|---|---|
| 1.0.0 | 2026-09-16 | 首个正式版本 |
