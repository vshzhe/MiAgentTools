# 变更提案：integrate-init-rules

## Why

`openspec/rules/ai-coding.md` 与 `artifact-generation.md` 的护栏要点**没有**进入目标项目的 `.iagent/rules/`：现状 `.iagent/rules/` 由 `ensureProjectConfig`（src/core/project-config.ts:239-261）生成，默认内容是两行「（待补充）」占位（defaultRuleFileContent，project-config.ts:102-125），且 install 后**永不刷新**（config.yaml 已存在即整体跳过，project-config.ts:244-246）。同时 15 个技能模板正文硬编码 `openspec/rules/*` 源仓路径（25 处，见 design Context），生成到无 `openspec/` 目录的目标项目后全部失效（仅 spec-apply.ts:74 有降级语句）。用户诉求三层：

1. **规则源整合**：openspec/rules 要点蒸馏进模板常量，随 `iagent init` 落到 `.iagent/rules/`，目标项目**无需** openspec 目录即得基线（D-Q1，2026-10-18 已确认）。
2. **project-init 技能与扫描优化 + rules 自动更新**：项目信息生成及更新完成后，自动更新 `.iagent/rules/` 的实现类与测试类规则；测试规则由扫描既有测试代码蒸馏，无证据占位兜底（D-Q2/D-Q5/D-Q7）；`iagent update` 同时提供确定性重建/修复挂点（D-Q5）。
3. **改名**：`impl.md` / `test.md` 改语义英文名且**不再兼容旧名**（D-Q3/D-Q9）——产物契约变更 + 旧名整体删除，BREAKING → major。

## What Changes

- **改名（BREAKING）**：规则文件映射由 `${type}.md` 直拼改为**类型→语义名映射单一源**：`impl`→`coding-rules.md`、`test`→`testing-rules.md`；`spec`→`spec.md` **不变**（D-Q9 方案 a）；其余类型回退 `<type>.md`。读取链（readProjectConfig:222 / ensureProjectConfig:254 / listRuleFiles:271 / legacy-migration.ts:562）全部改走映射。
- **旧名文件清理（BREAKING）**：`init` / `update` 检测到旧名规则文件（`.iagent/rules/impl.md`、`test.md`）即**整体删除并报告**丢失风险 WARN，不做兼容读取（D-Q6，对齐 docs/upgrade-guide.md 告警模式）；init 的 created 分支（无 config.yaml）同样先清理旧名再生成新名文件。
- **迁移产物同轮保真**：legacy 迁移报告新增 `movedRules`，init/update 以 `preservePaths` 传给修复步骤，本轮只登记跳过常量对齐，保证搬运内容同轮不被重写（下一轮起正常对齐）。
- **蒸馏常量化**：`defaultRuleFileContent` 重写——`ai-coding.md`（43 行）蒸馏为 `coding-rules.md` 默认规则行、`artifact-generation.md`（74 行）G1-G7 要点蒸馏为 `spec.md` 默认规则行；三类管理文件默认内容新增**人工域标记骨架**（复用 `<!-- 人工域:开始/结束 -->` 机制，D-Q4）。
- **init 行为变更**：`ensureProjectConfig` 在 config.yaml 已存在时**不再整体跳过**——转入 rules 重建/修复（缺失重建、人工域外与常量对齐、人工域逐字保留、破损取保留侧）；config.yaml 本身仍保持「已存在不覆盖」。
- **新增 update 挂点**：`runUpdate` 在 0.2 legacy 技能 id 迁移之后、读 config（update.ts:162）之前插入确定性 rules 重建/修复步骤（legacy-migration 仍最先执行，D-Q5）；InitResult / UpdateResult 新增修复明细，CLI 输出删除/对齐/告警行。
- **project-init 技能新增蒸馏步骤**（第 10 步，在 context 回写之后）：扫描既有测试代码（框架/命名/目录约定）蒸馏实现/测试规则行，写入对应语义名文件的**人工域段内**；无测试代码时占位兜底；内容跨宿主统一（D-Q2/D-Q4/D-Q8）。
- **扫描轻量扩展**：`ProjectScanReport.signals` 新增 `tests` 维度（测试目录探测 + 测试文件名模式计数，仅机械事实，不含框架结论），供蒸馏步骤取证据（D-Q7）。
- **模板引用改写**：15 个模板文件 25 处 `openspec/rules/ai-coding.md` / `artifact-generation.md` 硬编码路径改写为 `.iagent/rules/coding-rules.md` / `.iagent/rules/spec.md`（Phase 2 待查项 1 结论，含降级语句保留）；`pnpm generate:skills` 快照同步。
- **既有主规格回写（P0）**：新增 5 个 MODIFIED delta——`agent-tool-identity`（规则文件名来源改映射）、`legacy-install-migration`（落点直达语义名 + `movedRules`）、`spec-workflow-skills`（规范要点改项目侧文件 + 修正失真场景）、`migration-skills`（合并来源改项目侧文件）、`artifact-generation-protocol`（真源与项目侧投影关系），避免归档合并后主规格与实现矛盾。
- **版本递增 major（8.0.0）** + CHANGELOG BREAKING 归档 + docs/upgrade-guide.md、README.md、docs/getting-started.md、docs/openspec-comparison.md 同步。

## Capabilities

### 受影响的能力

- `iagent-rules-config`（ADDED）：`.iagent/rules` 语义名映射、init 生成蒸馏规则（含无 config.yaml 分支的旧名清理）、update 重建/修复（含本轮迁移产出跳过对齐）、旧名检测删除与告警、人工域标记的读取契约。
- `project-init-rule-distill`（ADDED）：project-init 技能的规则蒸馏步骤（触发时点、蒸馏主体、占位兜底、人工域写入口径、跨宿主统一）。
- `init-project-scan`（MODIFIED）：预扫描 signals 新增 `tests` 测试探针维度（机械目录/文件名事实，不含框架结论）。
- `agent-tool-identity`（MODIFIED）：规则文件名来源由 `<type>.md` 直拼改为类型→语义名映射派生（impl→`coding-rules.md`、test→`testing-rules.md`、spec→`spec.md`，映射外回退）。
- `legacy-install-migration`（MODIFIED）：搬运落点经映射直达语义名、正文逐字保留、报告新增 `movedRules` 机读字段。
- `spec-workflow-skills`（MODIFIED）：规范要点来源改为项目侧 `.iagent/rules/coding-rules.md`（含 fail-safe 条件）；修正「init 生成 `spec_propose.md`」失真场景为 `spec.md`。
- `migration-skills`（MODIFIED）：migration Phase 3 合并来源改为项目侧 `.iagent/rules/coding-rules.md`。
- `artifact-generation-protocol`（MODIFIED）：声明源仓文件仍为协议真源、目标项目侧投影为 `.iagent/rules/spec.md` 并含缺失降级。

## Impact

### 影响面分析（ADR 风格）

**决策**：本变更按「读链单一源化 + 双入口确定性修复 + 技能侧蒸馏」推进，契约面收敛在 `src/core/project-config.ts` 一处（映射、蒸馏常量、人工域工具、修复函数），init/update 两个入口与技能模板只消费该面。风险定级 **MEDIUM**：read 链下游广（generate 注入 / config 展示 / 技能骨架注入），但返回结构签名不变，契约面实际收敛。

**d1 直接调用方（readProjectConfig——编排器影响面分析记为 14 语义调用点，本次按全量 grep 核对为 30 处调用表达式分布于 9 个调用文件（另定义文件 project-config.ts，共 10 文件涉改），均为符号签名不变类别；逐项处置见调用点表与 tasks「Caller Updates」）：**

| 调用方 | 位置 | 处置 |
|---|---|---|
| `runGenerate` | src/commands/generate.ts:112（规则注入 generate.ts:59-62 按 `rules[type]` 类型键取内容） | **无需改动**（类型键不接触文件名；语义由 readProjectConfig 内部映射承担） |
| `runInit` | src/commands/init.ts:157（读 workflows/tools） | **无需改动**；step 4（init.ts:302）为 ensureProjectConfig 改造点（I4） |
| `runUpdate` | src/commands/update.ts:162 | **无需改动**；0.2 后新增修复步骤（U3） |
| `runConfigInteractive` / `runConfigSet` / `runConfigShow` | src/commands/config.ts:57 / :131 / :88（展示 config.ts:98 按类型键） | **无需改动**（展示仍为类型 id，不展开文件名）；前两者经 `ensureProjectConfig`（config.ts:56/:131）获得幂等的规则修复语义（design D-3 外溢说明） |
| 测试消费 | test/completion-config（5 处）、config-command（3 处）、commands（3 处）、legacy-migration（8 处）、project-config-context（6 处）；另有 claude-host-adapter / host-smoke / opencode-v2 / pi-native / pi-runtime / uninstall-show / validate-update 仅经 ensureProjectConfig setup 间接触达 | 仅 rules 相关断言需迁移，集中列于 tasks「Caller Updates」与 [测试] 任务 |

**其它契约点**：

- `parseProjectConfig`（project-config.ts:141-165）：config.yaml 的 rules 列表为**类型 id**，与文件名正交，仅 isSkillType 过滤（:161）——本变更不动。旧机型迁移读旧值走 `readListSection` 的成熟边界不变。
- `listRuleFiles`（:264-273）：basename 过滤 `isSkillType(name.replace(/\.md$/,''))` 对语义名失效——必须改走**反查函数**（语义名/回退名双形态识别）。
- legacy-migration.ts:104-106 `LEGACY_TYPE_RENAME`：类型 id 不变更，映射表与守卫测试（test/legacy-migration.test.ts）不牵动；仅 ：562 搬运**落点文件名**改走映射（tr_impl.md → coding-rules.md 直达新名，保真搬运既有契约不变）。
- 白名单 / 派生：`rewriteCommandRefs` / `deriveCommandContent` 只识别命令 id 形态，与路径字面量无交叉（无牵动）；project-init 新增蒸馏步骤不需要新白名单（Read/Write/Glob/Grep 既在 allowedTools——核对结论见 design）。
- 测试：需改断言的既有测试文件 4 个（completion-config.test.ts:134-135,175-176,217；legacy-migration.test.ts:281-285,457；commands.test.ts:292；skill-type-taxonomy.test.ts:10,42）+ 新增修复/蒸馏/探针测试。
- 本机产物边界：`.iagent/` 与 `openspec/` 不入库；rules 文件**无** frontmatter、不引入指纹机制（手改保护走人工域标记，D-Q4）；`test/markdown-first-regression.test.ts` 无直接影响（不引入 JSON 主产物）。

**版本递增**：BREAKING（产物契约变更 + 旧名不做兼容整体删除）→ **major（7.1.0 → 8.0.0）**，递增依据 AGENTS.md 版本递增表。
