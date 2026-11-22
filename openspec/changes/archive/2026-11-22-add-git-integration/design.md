# 设计：Git 能力集成

## Context

### 现状与架构位置

本变更跨三层：

- **核心层**：`src/core/git-capability.ts`（新建）、`src/core/child-process.ts`（复用）、`src/core/dependencies.ts`（范式参照）
- **命令层**：`src/commands/git.ts`（新建）、`src/cli/index.ts`（注册）、`src/commands/completion.ts`（补全）
- **模板层**：`project-init.ts` / `spec-archive.ts` / `spec-bulk-archive.ts` / `commit.ts` / `tool-whitelist.ts`

### 架构影响

改造前，Git 能力被拆成三个孤立片段，互不连通：

```
dependencies.ts (codegraph only)     init.ts (只读提示 .gitignore)
        ↓ 无 git                            ↓ 只在 .git 存在时生效
       ─────────── 空 白 ───────────
                                        commit.ts (需人工触发)
                                              ↑
                              spec-archive / bulk-archive (无 git 步骤)
```

改造后形成「一套内核 + 三处接入 + 两道门」：

```
                    git-capability.ts（检测 / 执行，runner 注入）
                    ┌──────────┼──────────┬────────────┐
              project-init  spec-archive  bulk-archive  commit.ts（收窄约束）
                    │          │             │
              Step 0     Step 7.5      Step 10.5
                    │          │             │
              ⛔安装门    ⛔推送门      ⛔推送门
```

### 约束来源

- 项目规则：外部进程走 `child-process.ts`、新建 CLI 命令同步补全表、改模板后 build + generate:skills
- 项目技能（`backend-design.md`）：扩展点接口化、fail-safe 默认、失败非阻断、配置写入非破坏
- 探索决策 D1-D10 与硬约束 11 条

## Goals / Non-Goals

**Goals**:
- init 能在无 Git 环境下给出可执行的安装方案（经确认），并在已装环境下幂等初始化仓库
- 归档收尾自动完成本地提交，减少一次人工操作，但不触碰无关改动
- 推送永远需要显式确认，且该确认不可被绕过
- 所有 Git 失败路径都不阻断主流程

**Non-Goals**:
- 不做 Git 配置管理（user.name / user.email 需用户预先配置）
- 不做远程仓库创建（`gh repo create` 等）
- 不改变 `commit.ts` 的交互式语义
- 不引入 Git 之外的 VCS（SVN 由既有 `svn-commit` 负责）

## Decisions

### DD1: 检测与执行分离，统一注入 `CommandRunner`

- **选择**: 检测函数纯只读；执行函数接受与 `dependencies.ts:33` 同签名的 `CommandRunner`。
- **理由**: 单测不得产生真实进程/网络副作用（项目约定）。`dependencies.ts` 已验证该模式有效（`ensureDependencies` 可完整 mock）。
- **备选**: 直接用 `spawnCommand` 硬编码 —— 测试必须起真实子进程，不可接受。

### DD2: 平台安装器按固定顺序探测，不自造安装逻辑

- **选择**: Windows `winget → choco → scoop`；macOS `brew`；Linux `apt → dnf → pacman`。每个探测用 `--version` 或等价只读命令。
- **理由**: 这些是各平台的事实标准；工具只负责「探测 + 展示命令 + 执行」，不自研下载逻辑。
- **备选**: 直接下载官方安装包 —— 引入网络下载与校验，安全与维护成本高，超出范围。

### DD3: `git init` 必须双幂等（存在性 + 上级仓库）

- **选择**: 已有 `.git/` → `skipped`；存在上级仓库 → `skipped` 并报告上级路径。
- **理由**: BS2/BS3。嵌套仓库会造成外层仓库无法追踪内层文件，且用户往往无意。这是 Git 社区的常见陷阱，工具应主动防护。
- **备选**: 只检查 `.git/` 存在性 —— 会创建嵌套仓库，产生难排查的问题。

### DD4: 归档 commit 只碰固定清单，代码改动按变更范围收敛

- **选择**: 制品按 `commit.ts` §2.5 固定清单；代码改动取「本次变更 tasks.md 中声明的文件」与工作区实际改动的交集。
- **理由**: D2 + BS4。`git add -A` 会混入无关改动，这是最危险的失败模式。
- **风险与缓解**: 交集可能漏掉间接改动（如生成的快照）。缓解：报告中列出实际暂存的文件清单，用户可据此判断；同时 `MUST NOT 阻断归档`，漏提交可在后续 `/iagent:commit` 补齐。
- **备选**: `git add -A` —— 明确否决。

### DD5: 「MUST NOT 自动 commit」收窄而非推翻

- **选择**: 保留原约束，新增「窄通道例外」条款并写明三项硬性前提。
- **理由**: D3。原约束的价值在于防止 `commit` 技能在用户不知情时提交；归档自动提交是**用户已知的流程收尾**（归档确认门已确认），两者语境不同。收窄比推翻更保守，也保留了原约束对交互式场景的效力。
- **备选**: 直接删掉该约束 —— 会削弱 `commit.ts` 的安全语义。

### DD6: 推送确认门归 `destructive-change`，不新增门类别

- **选择**: 复用门白名单第 5 类；`GATE_SKIP_IDS` 不新增条目。
- **理由**: 门白名单 5 类是硬约束（防门类别膨胀）；`git push` 是外向且不可轻易撤销的动作，语义上正属 `destructive-change`。
- **备选**: 新增 `push-confirmation` 类别 —— 违反 5 类不变约束。

### DD7: `Bash(git:*)` 经共享常量构造

- **选择**: 在 `tool-whitelist.ts` 新增 `GIT_CLI = 'Bash(git:*)'`，四个技能引用该常量。
- **理由**: AGENTS.md 规则「allowedTools 条目 MUST 走 tool-whitelist.ts 共享常量，MUST NOT 逐模板手写」。
- **备选**: 各模板手写 `Bash(git status:*)` 等细粒度条目 —— 违反单一源；且归档 commit 需要 add/commit/push，粒度太细会漏。

### DD8: 新增步骤编号采用小数（Step 0 / 7.5 / 10.5）

- **选择**: 不重排既有步骤号，用小数插入。
- **理由**: 既有步骤号被多处交叉引用（如 `spec-archive` 的 Step 4.6、`bulk-archive` 的 Step 2.5/11）；重排会产生大面积文本改动与引用失配。
- **备选**: 全部重排 —— 改动面大、风险高、收益低。

## Risks / Trade-offs

| 风险 | 缓解 |
| :--- | :--- |
| 自动执行安装命令有系统级影响 | DD2 只做标准包管理器；⛔ 安装确认门展示确切命令；拒绝即跳过 |
| `git push` 可能推送到错误分支 | 推送确认门展示当前分支与 remote；不在 detached HEAD 推送 |
| 固定清单遗漏间接改动 | 报告列出实际暂存文件；不阻断归档，可用 `/iagent:commit` 补齐 |
| 收窄约束被误用为「一切自动提交」 | 窄通道条款写明三项硬性前提 + 「除上述窄通道外 MUST NOT」 |
| 三个技能正文体积增加触发预算 | `project-init` / `spec-archive` 细则下沉 `references/`；改后跑 `skill-size-budget` |
| `git` CLI 命令与既有 `iagent` 命名空间冲突 | 作为 `git` 顶层子命令组注册，与现有 13 命令并列；同步补全表 |

## 评估记录

| 评估对象 | 结论 | 依据 |
| :--- | :--- | :--- |
| 门白名单 5 类 | **不改** | 安装/推送归既有 `destructive-change`（DD6） |
| `GATE_SKIP_IDS` | **不改** | 推送门不可 skip（D8） |
| `commit.ts` 交互式语义 | **不改** | 仅新增例外条款（DD5） |
| `spawnCommand` / `CommandRunner` | **不改** | 直接复用 |
| `resolveChangeArtifactsHint` | **不改** | Git init 后该提示自然生效 |
| 既有步骤编号 | **不改** | 用小数插入（DD8） |
