# 贡献指南

感谢你愿意为 `dsh-plugin-session-purge` 出力。本文件说明参与方式与代码约定。

> 本项目是一个**会永久删除用户数据**的插件。所有改动都必须把这个事实放在第一位：
> 任何扩大删除范围、降低确认门槛、或让删除变得更「顺手」的改动，都需要在 PR 里单独说明理由。

## 目录

- [行为准则](#行为准则)
- [我可以贡献什么](#我可以贡献什么)
- [开发环境](#开发环境)
- [代码结构](#代码结构)
- [编码约定](#编码约定)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [兼容性声明](#兼容性声明)
- [安全](#安全)

## 行为准则

参与本项目即表示你同意遵守 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)。

## 我可以贡献什么

按优先级从高到低：

| 类型 | 说明 |
|---|---|
| **Bug 报告** | 用 [Bug 报告模板](./.github/ISSUE_TEMPLATE/bug_report.yml) 提交，**务必附上 DSH 版本与操作系统** |
| **兼容性反馈** | 在别的 DSH 版本 / 别的操作系统上试过，无论成功失败都欢迎反馈 |
| **文档** | README、FAQ、注释里的错误、过时或不准确之处 |
| **测试** | 删除路径目前**没有**自动化测试覆盖，这是最缺的一块 |
| **功能** | 请先开 Issue 讨论，避免写了不被接受的方向 |

**不予接受的方向：**

- 去掉或弱化二次确认的任何改动。
- 增加「不删文件只隐藏」之类的**语义混淆**改动——那属于 DSH 自带的归档功能。
- 把删除做成**不可回滚且无提示**的静默操作。
- 在插件内引入遥测、上报或任何形式的联网行为。

## 开发环境

### 前置

- Node.js ≥ 20
- 可正常运行的 DSH（Web 或 Desktop 均可）
- Git

### 本地开发（`link:` 安装，改完即时可见）

```bash
# 1. 克隆
git clone https://github.com/cyh3436332528/dsh-plugin-session-purge.git
cd dsh-plugin-session-purge

# 2. 以 link: 方式装进目标 profile（以 desktop 为例）
dsh plugin --profile desktop add "$(pwd)"
```

开发时的热重载行为**两半不一样**，请注意：

| 半边 | 文件 | 热重载 |
|---|---|---|
| 浏览器半边 | `lib/client.js` | ✅ 随文件改动热重载 |
| 宿主半边 | `lib/index.js` | ❌ **不热重载**（ESM 按路径缓存），改完必须重启 DSH |

> 宿主插件的 ESM 模块按路径缓存，重装同一路径**不会**重新加载。
> 改 `lib/index.js` 后请重启 DSH（注意：这会杀掉当前会话的宿主进程）。

### 冒烟脚本

```bash
node plugin/_smoke.mjs
```

`_smoke.mjs` 是一个**只读**脚本，用假的 `ctx` 调用 `apply()`，然后对 `/x-session-purge/list` 路由发一次请求并打印结果。
它**不会**触发任何删除。改动宿主侧 `scan()` / `titleOf()` / `dirSize()` 相关逻辑后请跑一遍。

## 代码结构

```
plugin/
├── package.json          # 插件清单：名称、入口、exports、dsh.* 字段
├── cordis.patch.yml      # bundle 层：往 profile 里插入一条 host 记录
├── lib/
│   ├── index.js          # 宿主半边：HTTP 路由 + 扫描 + 删除实现
│   └── client.js         # 浏览器半边：设置页面板 + 导航图标
└── _smoke.mjs            # 只读冒烟脚本
```

### 两半的接口约定

宿主半边通过**同源 JSON 接口**供浏览器半边调用，前缀固定为 `/x-session-purge`：

| 方法 | 路径 | 请求体 | 响应 |
|---|---|---|---|
| `GET` | `/x-session-purge/list` | — | `{ ok, sessions: Session[] }` |
| `POST` | `/x-session-purge/delete` | `{ id, children }` | `{ ok, deleted, freed, live, pending }` |
| `POST` | `/x-session-purge/delete` | `{ allArchived: true }` | `{ ok, deleted, freed, live, pending }` |

`Session` 结构：`{ id, folder, bytes, title, archived, known, mtimeMs, ws, live }`。

**改动这个接口时必须同步改两半**，并更新本节表格。

### 浏览器半边的硬约束

- 手写的 DSH 客户端模块，格式是 `window.__ModuleLoader__.load({ id, factory })`，**不是**普通 ESM。
- 没有构建步骤：**不要**引入打包器、TypeScript 编译或任何需要 build 的依赖。
- `id` **必须**等于 `package.json` 的 `name`，否则模块加载失败。
- 依赖只能通过 `require()` 取：目前用到 `react` 与 `@deepseek-ai/dsh-client-ui-primitives`。

## 编码约定

### 通用

- 缩进 2 空格；字符串统一单引号；不加分号（与现有代码一致）。
- 注释写**为什么**，不写**是什么**。现有注释里有大量「为什么这样做」的记录，请保持这个风格。
- 一切对外文案用简体中文；标识符、API 名、路径保持英文原文。

### 删除相关（最重要）

- 任何删除调用都必须是**显式路径**的，**禁止**使用通配符、变量拼接出来的宽泛路径或递归删除范围不明确的写法。
- `fs.rm` 必须带 `{ recursive: true, force: true }` 之外，还要确保路径来自 `scan()` 扫描出的真实会话目录，**不要**接受客户端传来的路径。
- 新增删除目标时，必须在 README 的「关联数据」表格、`lib/index.js` 顶部的文件头注释、
  以及 `CHANGELOG.md` 的 `Security` 段**三处同步**说明。

### 界面相关

- 普通按钮一律用官方 `@deepseek-ai/dsh-client-ui-primitives` 的 `Button`，**不要**自造按钮样式。
- 颜色一律走 `--dsw-alias-*` CSS 变量并带 fallback，禁止硬编码颜色值（红色危险态除外，且同样走变量）。
- **禁止**使用 `window.confirm` / `window.alert`。
- **禁止**整页 `location.reload()`——只刷新本面板的列表。
- 面板必须继续包在 error boundary 内。
- 删除的确认块必须与触发按钮**分处不同的区块**，且默认焦点 / 指针位置落在**取消**上。

## 提交规范

采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：

```
<type>(<scope>): <描述>
```

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 只改文档 |
| `refactor` | 重构，不改行为 |
| `test` | 测试 |
| `chore` | 构建、依赖、杂务 |
| `style` | 格式化，不影响逻辑 |

`scope` 建议用 `host`（宿主半边）/ `client`（浏览器半边）/ `docs` / `manifest`。

示例：

```
feat(host): 支持按工作区批量删除
fix(client): 修复筛选框清空后确认块未收起
docs: 补充 pending 会话的重启说明
```

**不要**在提交信息里写 emoji 前缀，也不要提交生成物。

## Pull Request 流程

1. **先开 Issue**（功能类改动必须先讨论），或者认领已有 Issue。
2. Fork → 从 `main` 切出特性分支，命名 `feat/xxx`、`fix/xxx`。
3. 改动，跑一遍 `node plugin/_smoke.mjs`。
4. 在**真实的 DSH** 上手动验证，并把验证步骤写进 PR 描述。
5. 提 PR，按 [PR 模板](./.github/PULL_REQUEST_TEMPLATE.md) 填写。

PR 必须附带：

- **改了什么、为什么**；
- **怎么验证的**（DSH 版本、操作系统、操作步骤、实际结果）；
- 涉及删除逻辑时，**明确说明删除范围有没有变大**；
- 涉及界面时，**附截图**（删除前后的对比更好）。

## 兼容性声明

`plugin/package.json` 的 `dsh` 字段是插件与 DSH 之间的契约。提交前请确认：

```jsonc
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "inject": [], "platform": "web" }
    // TODO: 补上 compatibility 段
  }
}
```

> **TODO（当前版本的缺口）**：本插件**尚未**声明 `dsh.compatibility`。
> 社区通行做法是同时给出「最小 DSH 版本」与一份逐版本实测结论表，形如：
>
> ```jsonc
> "compatibility": {
>   "dsh": ">=0.1.0",
>   "dshReleases": {
>     "0.1.2-alpha.3": "compatible",
>     "0.1.5-alpha.1": "compatible"
>   }
> }
> ```
>
> 字段名与取值请以你所使用的 DSH 版本里 `@deepseek-ai/dsh-*` 包的实际声明为准，
> **不要**照抄本示例里的版本号。

## 安全

- **不要把任何密钥、token、会话原文、`~/.dsh/` 下的用户数据提交进仓库。**
- 报告安全问题时不要开公开 Issue，请走 [SECURITY 说明](./.github/ISSUE_TEMPLATE/config.yml) 里的私下渠道，
  或按仓库 README 里的联系方式私下联系维护者。
- 本项目会删除用户磁盘上的真实数据。任何 PR 若引入新的删除路径，
  审查者会**逐行对照源码核查删除范围**——请在描述里主动说明。
