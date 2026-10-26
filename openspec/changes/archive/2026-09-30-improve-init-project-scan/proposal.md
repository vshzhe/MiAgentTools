## Why

`venus_tr_init_project` 当前的初始化能力只到「建骨架」——四步全是目录与配置的创建，探查仅一条 `ls -la`（[tr-init.ts:12-56](../../src/core/templates/workflows/tr-init.ts#L12-L56)）。`venus init` 同样只做确定性的产物安装，不读取任何项目源码、构建或配置内容。

结果是：一个新项目（或从未沉淀过文档的存量项目）接入 venus 后，AI 代理**没有任何项目知识可供复用**，每轮对话都要重新推断技术栈、分层约定、数据库形态、API 风格与安全机制。

这不是理论缺口 —— 跨项目实测显示文档覆盖率极不均衡：

| 项目 | AGENTS.md | CLAUDE.md | README | docs/ | openspec/ | .claude/ |
|---|---|---|---|---|---|---|
| Venus4A | ✅ 514 行 | ✅ 703 行 | ✅ 833 行 | ✅ 5 份 | ✅ | ✅ |
| AuthServer | ❌ | ✅ 10.7KB | ❌ | ❌ | ✅ | ✅ |
| AccountManager | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

`AccountManager` 是典型的零文档项目（且 CodeGraph 未初始化），而它正是 `venus init` 的常见目标形态。同时，扫描这件事本身有**实测的安全风险**：Venus4A 根目录 `org.xml` 含真实用户 PII，AuthServer 的 `database.xml` 明文存放口令 —— 任何扫描能力都必须把「只输出键名、绝不输出取值」做成硬约束，而不是事后补救。

为什么是现在：`venus init` 已具备接入预扫描所需的全部结构条件 —— `dependencies.ts` 已确立「init 中的非阻断自检 + 报告渲染」范式，复用它可使改动最小、错误语义一致（见 design.md）。

## What Changes

**一、新增确定性预扫描（`venus init` 侧，Node）**

- 新增 `src/core/project-scan.ts`：`scanProject()` 提取**机器可判定事实**（标志文件 / 构建设施 / 目录骨架 / 依赖清单 / 配置键名 / 路由声明位置），`renderScanReport()` 渲染非阻断报告
- 与 `ensureDependencies()` 同构接入 `runInit()`，**每次 init 覆盖刷新**基线；失败一律 WARN 继续，不阻断主流程
- 基线落 `.venus/scan-baseline.json`（本机产物，不入库，与 `.gitignore` 既有约定一致）
- 新增 `--no-scan` 逃生阀，与既有 `--no-deps` 同构
- **输出分层为「信号」与「候选」**：只报告观察到的事实（发现 `build.xml`）与可能线索（发现 `spring-2.0.5.jar`），**MUST NOT 输出框架结论**
- **敏感值防护**：只输出键名与路径、MUST NOT 输出取值；内置文件排除清单（PII 文件、编译产物、日志、多环境凭据变体）
- **遍历设深度与文件数上限**，超限记 WARN 并返回部分结果（不静默截断）

**二、新增项目知识文档生成（`venus_tr_init_project` 技能侧，LLM）**

- 正文扩写为「读基线 → 语义扫描五类 → 逐文档确认 → 落盘 → 回写配置」
- 五类文档产出至 `docs/project/`：`architecture/技术框架.md`、`modules/模块与功能点.md`、`database/数据库.md`、`api/API规范.md`、`security/安全规范.md`；索引 `docs/project/README.md`
- 「模块与功能点 / DB 调用链 / API 契约」**委派 `venus_tr_docs_feature_doc` 复用其框架档案**，不可得时降级自行扫描并记 WARN（不注入 DEPS，默认安装集维持 9 项不变）
- **已存在文档（含 `AGENTS.md`）逐文档向用户确认**（确认重新生成 / 修改 / 跳过）；确认后走**增量对齐**——人工域逐字保留，其余重派生
- **人工域用显式标记界定**：`<!-- 人工域:开始 -->` … `<!-- 人工域:结束 -->`
- 某类无对应内容时**不生成该类文档**，索引标「不适用 + 探测依据」
- 回写 `.venus/config.yaml` 的 `context` 段（当前为"待补充"占位），沿用**逐行保留 + 段替换**策略
- 技能白名单按正文实际使用扩展（CodeGraph 共享常量 + 委派条目），MUST NOT 无差别扩大授权面

**三、模板机制改造（`spec-workflow-skills` 既有能力，作用域扩张）**

- `tr-init.ts` 的 command content 由 `deriveCommandContent()` 从 skill 单源派生（`<!-- CMD:SKIP -->` 标记），消除手工双写
- 派生规则作用域由 `spec-*.ts` **显式扩为** `spec-*.ts` + `tr-init.ts`（经实测：其余 17 个 `tr-*.ts` 仍为双写，本次不动）

**四、附带**

- 版本号 minor 递增 + `CHANGELOG.md` 归档（仓库硬规约第 8 条，随本次功能提交一并提交）

## Capabilities

### New Capabilities

- `init-project-scan`: 项目扫描与知识文档沉淀能力 —— `venus init` 的确定性预扫描（信号/候选分层、敏感值防护、排除清单、上限控制、非阻断降级、`--no-scan` 逃生阀）+ `venus_tr_init_project` 的语义扫描（五类文档、索引、不适用类、逐文档确认、增量对齐、人工域标记、`context` 回写、`tr-docs-feature-doc` 可选委派）

### Modified Capabilities

- `spec-workflow-skills`: 「模板单一源派生规则」的作用域从 `spec-*.ts` 扩为 `spec-*.ts` + `tr-init.ts`（`tr-init.ts` 的 command content 改为由派生函数生成，源码中 MUST NOT 保留第二份手工正文）

## Impact

### 直接影响的文件

- `src/core/project-scan.ts`（新建）: 确定性预扫描 `scanProject()` + 报告渲染 `renderScanReport()` + 敏感值防护 + 文件排除清单 + 遍历上限
- `src/commands/init.ts`: `runInit()` 接入预扫描步骤；`InitResult` 新增扫描报告字段；支持 `--no-scan`
- `src/cli/index.ts`: init action 渲染扫描报告；注册 `--no-scan` option
- `src/core/project-config.ts`: 新增 `writeContextToConfig()`（逐行保留 + 段替换，MUST NOT 重新序列化 YAML）
- `src/core/templates/workflows/tr-init.ts`: 正文大幅扩写（扫描五类 / 逐文档确认 / 增量对齐 / 索引 / AGENTS.md / context 回写）；command content 改为派生；`allowedTools` 按正文扩展
- `src/core/templates/tool-whitelist.ts`: 复用既有共享常量（`CODEGRAPH_MCP` / `skillDelegation`）；若正文确认需要派发子代理则追加 `SUBAGENT_DISPATCH` 使用（不新增常量本身）
- `skills/venus_tr_init_project/SKILL.md`: 快照重生成（`pnpm build && pnpm generate:skills`）
- `openspec/specs/init-project-scan/spec.md`（新建 delta）: 新能力规格
- `openspec/specs/spec-workflow-skills/spec.md`（delta MODIFIED）: 派生规则作用域扩张
- `openspec/CONTEXT.md`: 新增 5 条术语（项目扫描 / 确定性预扫描 / 扫描基线 / 信号与候选 / 人工域标记 / 不适用类）；更新「人工域」词条的界定方式
- `test/project-scan.test.ts`（新建）: 预扫描单测（Ant 项目无 pom、零文档项目、含敏感键的配置文件、超限目录、失败降级）
- `test/`: 按需调整模板派生一致性测试以覆盖 `tr-init.ts`
- `package.json` / `CHANGELOG.md`: minor 递增 + `[Unreleased]` 归档

### 向后兼容

**无 BREAKING**。逐项说明：

- **默认安装集不变**：仍为 9 项（8 显式 + 1 注入）——委派 `tr-docs-feature-doc` 不注入 DEPS（用户确认）
- **`venus init` 既有选项与输出语义不变**：`--tools` / `--force` / `--no-deps` / `--onboarding` 行为不变；新增 `--no-scan` 为**追加**；新增的扫描报告为**追加输出行**（既有行不改）
- **`InitResult` 新增字段为追加**：现有字段语义与取值不变；init 命令无 `--json` 选项，故不存在机器可读契约破坏
- **`.venus/config.yaml` 既有语义不变**：`workflows` / `rules` / `context` 的读取与合并规则不动；`writeContextToConfig()` 只**新增写入能力**，且沿用逐行保留策略，未知段（如本仓库的 `auto_package.runtime_dir`）与注释 MUST 完整保留
- **技能行为为增强非替换**：既有「建骨架」四步保留；新增的文档生成会**新增交互询问**（是否重新生成已存在文档）——对既有用户是新交互但不破坏既有行为，且用户可逐份选择跳过
- **模板派生的产物面**：`tr-init.ts` 的 command content 由双写改为派生后，生成产物内容会变化（消除既有漂移），属**修正**而非破坏；技能名、指令 id（`tr-init-project`）、frontmatter 契约均不变
