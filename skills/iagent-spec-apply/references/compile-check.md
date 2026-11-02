# 编译检查细则（spec-apply Step 8）

> 本文件是 Step 8 的细则展开。主 SKILL 的 8.1–8.10 是**唯一执行顺序**；此处只补充如何判定、如何构造命令、证据长什么样。二者冲突时以主文件为准。

## 1. 配置读取与默认值

- 权威载体：项目 `.iagent/config.yaml` 的顶层 `compileCheck` 段；`openspec/config.yaml` 的同名字段与 `apply.incrementalCheck` **不再生效**（只读一次并 WARN，指向迁移目标）。
- 段或字段缺失时：运行 `iagent config show` 读取生效值（**单一默认值真源**在 `src/core/project-config.ts` 的 `DEFAULT_COMPILE_CHECK`）；CLI 不可用时按下表兜底并记 WARN —— MUST NOT 定义第二套默认值。

| 字段 | 类型 | 默认 | 语义 |
| :--- | :--- | :--- | :--- |
| `enabled` | 布尔 | `true` | 是否执行；`false` = 项目级显式禁用（唯一合法的 `disabled` 来源） |
| `command` | 字符串 | 空 | 显式命令（优先级最高）；空 = 自动探测 |
| `timeoutMs` | 整数 | `600000` | 单条命令超时（毫秒），超时计为失败 |
| `incremental` | 布尔 | `true` | 每批结束后是否执行批后编译检查（复用同一命令） |
| `autoFix` | 布尔 | `true` | 失败后是否进入自动修复循环 |
| `maxRetries` | 整数 | `3` | 自动修复重试上限（仅 `autoFix=true` 生效） |

作用域：`command` / `timeoutMs` / `maxRetries` / `autoFix` / `incremental` **仅约束本技能**；`iagent-debug` 只共享 `enabled` 与「缺省启用」语义。

## 2. 构建描述符探测矩阵

以**变更文件最近的祖先目录**为起点向上查找（同一目录命中多个描述符时按表中顺序取第一个，命中即停止继续上升）：

| 描述符 | 构造的命令 | 说明 |
| :--- | :--- | :--- |
| `package.json` 且含 `scripts.build` | `<pkg> run build` | 包管理器由同目录 lockfile 决定（见 3.1）；无 lockfile 时按 `npm run build` |
| `package.json` 无 `build` 而存在 `tsconfig.json` | `tsc --noEmit` | 纯类型检查（不产出构建产物） |
| `pom.xml` | `mvn compile -DskipTests` | Maven；保持「不跑测试」语义 |
| `build.gradle` / `build.gradle.kts` | `gradle compileJava` | Gradle |
| `build.xml` | `ant compile` | Ant |
| `go.mod` | `go build ./...` | Go |
| `Cargo.toml` | `cargo build` | Rust |
| `build.js` | `node build.js` | 仓库自带的 Node 构建脚本（**仅当目标项目确有该文件时**命中） |

**禁止**：把本仓库（iagent 自身）的命令写成唯一命令；把 `npm run build` 当万能回退（无描述符即 `not-applicable`）。

## 3. 命令构造细则

### 3.1 包管理器判定（按 lockfile）

| 同目录 lockfile | 命令 |
| :--- | :--- |
| `pnpm-lock.yaml` | `pnpm run build` |
| `package-lock.json` | `npm run build` |
| `yarn.lock` | `yarn build` |
| 无 lockfile | `npm run build`（记录 WARN：未发现 lockfile） |

### 3.2 显式命令优先

`compileCheck.command` 非空 → **只**执行该命令：不追加探测命令、不因描述符命中而多跑一条。

### 3.3 monorepo 归组与去重

1. 取本批 / 本次变更涉及的文件列表（见 4）；
2. 对每个文件求**最近的祖先目录**（含自身目录）中的构建描述符；
3. 按「描述符绝对路径 + 构造出的命令字符串」归组；
4. **去重**：同一命令字符串只执行一次，`scope` 记该组覆盖的模块目录（多个用逗号分隔）；
5. **逐条执行**，每条命令独立记录 `command` / `exitCode` / `scope`；
6. 任一命令非零退出 → 文件级汇总 `status=fail`（其余命令仍执行完毕，便于一次看全错误）。

## 4. 变更范围降级链

1. `tasks.md` 中声明的 `文件：` / 产出路径与 `Spec Ref`；
2. `git diff --name-only` + `git ls-files --others --exclude-standard`（**含未跟踪文件**）；
3. 状态 JSON 的 `contextFiles` / `changeRoot`（`iagent spec status --change <name> --json`）；
4. 三源皆不可得 → 以**项目根**为范围执行，证据 `scope` 记 `project-root`，并记 WARN。

每次降级 MUST 记录 WARN（「范围来源降级为 X」）；MUST NOT 依赖 `allowedEditRoots`（该字段不存在）。

## 5. 证据文件模板

路径：`.openspec-tmp/pipeline-<change-name>/compile-report.md`（`path.join()` 构造）。

```markdown
| change | command | exitCode | errorCount | fixedCount | status | scope | timestamp | reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| add-x | pnpm run build | 0 | 0 | 2 | pass | packages/a | 2026-11-01T10:00:00Z | - |
| add-x | mvn compile -DskipTests | 1 | 3 | 0 | fail | services/b | 2026-11-01T10:00:05Z | 3 个编译错误，重试耗尽 |

**summary**: status=fail, commands=2, totalErrors=3, totalFixed=2
```

列名固定（九个字段，顺序不变）。非执行终态（`not-applicable` / `disabled`）使用固定占位：

```markdown
| change | command | exitCode | errorCount | fixedCount | status | scope | timestamp | reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| add-x | - | - | 0 | 0 | not-applicable | - | 2026-11-01T10:00:00Z | 未探测到可编译产物 |

**summary**: status=not-applicable, commands=0, totalErrors=0, totalFixed=0
```

`reason` 的两种非执行文案固定为「未探测到可编译产物」/「项目级显式禁用」；MUST NOT 留空、MUST NOT 使用 `N/A` 等变体（父流程按固定列解析）。

handoff 包 `## 阶段结论` 追加行（四列，status 用**编译四值**）：

```markdown
| compile | pass | .openspec-tmp/pipeline-add-x/compile-report.md | archive |
```

## 6. 终态判定表

| 情形 | 终态 | 后续 |
| :--- | :--- | :--- |
| 全部命令 exitCode 0 | `pass` | 进入测试执行门 |
| `enabled: false`（项目级显式禁用） | `disabled` | 写证据后进入测试执行门（WARN，不表述为通过） |
| 无任何可编译产物 / 无描述符且未配置命令 | `not-applicable` | 写证据后进入测试执行门（WARN，不表述为通过） |
| 任一命令非零退出 / 超时 / 依赖未安装 | `fail` | 修复循环 `maxRetries` 次；仍失败 → 写证据并暂停 |
| `autoFix=false` 且首次失败 | `fail` | 直接写证据并暂停（不进入修复循环） |
| 批后检查修复耗尽 | `fail` | 立即写证据并暂停（不继续后续批次、不进入测试门） |

**汇总优先级**：任一命令行 `fail` → `fail`；否则全部 `pass` → `pass`；零命令时只能是 `not-applicable` 或 `disabled`（二者互斥）。

## 7. 失败分类

- **可自动修复**：类型标注缺失 / 未使用变量 / import 顺序 / 明显的拼写与引用路径错误 —— 只修改变更范围内文件后重跑同一命令。
- **需人工介入**：接口签名冲突、缺失依赖包、业务逻辑错误、环境缺失（`command not found`、缺 `node_modules`）—— 记录 `file:line` 后暂停。
- 超时与依赖未安装一律计为 `fail`（MUST NOT 记为 `not-applicable`）。

## 8. 辅助检查边界

lint（`eslint` / `mvn checkstyle:check`）与前端校验（JSP 标签闭合与 EL 表达式、Vue/React 组件引用）是 **Step 8 的辅助项**：

- 项目适用时照常执行；
- 失败只记 WARN 与摘要，**不参与四值终态**、**不计入证据 `errorCount`**；
- MUST NOT 因重写 Step 8 而移除这两步（属既有能力，静默移除即为能力收缩）。
