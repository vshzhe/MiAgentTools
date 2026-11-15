# Tasks: add-spec-update-capability

<!-- 流程基准节点 id（N1–N22）与 exploration.md §功能流程图 一一对应；MUST NOT 静默补节点 -->
<!-- 测试任务依赖其对应实现任务；6.x 依赖全部实现任务完成 -->
<!-- 任务类型标签：[代码] / [测试][单元|功能][P0|P1|P2] / [DB脚本] / [使用说明] -->

## 1. 技能模板新增（src/core/templates/workflows/spec-update.ts）

- [x] 1.1 [代码] 新建 `src/core/templates/workflows/spec-update.ts`：导出 skill 版正文唯一源 `getSpecUpdateSkillTemplate()`（内部名 `iagent_spec_update`，type `spec`）与 `getSpecUpdateCommandTemplate()`（command 版由 `deriveCommandContent()` 从 skill 版派生，MUST NOT 手写第二份正文）[N1]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：`pnpm build` 后 `test/template-derivation.test.ts` 的「skill 单一源」断言通过
  - Spec Ref：spec-update / spec-update 技能注册与形态
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / 技能与指令成对注册

- [x] 1.2 [代码] 技能 description 与 Step 0 输入契约：description 含三向 `NOT for` 排歧（新建提案 → `iagent_spec_propose`；实现未完成 → `iagent_spec_apply`；孤立缺陷根因排查 → `iagent_debug`）；输入契约为「变更名 + 测试问题描述」[N1]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照 frontmatter description 含三向排歧句
  - Spec Ref：spec-update / spec-update 技能注册与形态
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / description 排歧区分相邻技能

- [x] 1.3 [代码] 正文前置校验段：变更存在 + `tasks.md` 全勾选（判据 `iagent spec status --change "<name>" --json` 的 `progress.remaining === 0`）；不满足 → 阻断并提示先走 `spec-apply`，MUST NOT 写任何制品、MUST NOT 提供跳过出口 [N2][N3]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文含 `progress.remaining` 判据与阻断出口表述
  - Spec Ref：spec-update / update 前置校验与实现未完成阻断
  - Scenario Ref：spec-update / update 前置校验与实现未完成阻断 / 实现未完成时阻断
  - Scenario Ref：spec-update / update 前置校验与实现未完成阻断 / 目标变更不存在时阻断
  - Scenario Ref：spec-update / update 前置校验与实现未完成阻断 / 任务全部勾选时放行

- [x] 1.4 [代码] 正文已归档复活复制段：判定归档态 → 复制为 `update-<原名>-<YYYYMMDD>`（`node -e "fs.cpSync(...)"` 递归复制，MUST NOT 用 `cp -r` / `xcopy`）；原归档目录保持不动；复制失败 → 阻断并报 WARN [N4][N5]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文含复制命名规则与「原归档不动」表述
  - Spec Ref：spec-update / 已归档变更的复活复制
  - Scenario Ref：spec-update / 已归档变更的复活复制 / 已归档变更复制为新变更
  - Scenario Ref：spec-update / 已归档变更的复活复制 / 原归档目录保持不动
  - Scenario Ref：spec-update / 已归档变更的复活复制 / 复制失败时阻断

- [x] 1.5 [代码] 正文根因定位段（双轨）：默认轻量三方差异定位（变更制品 ↔ 实际实现 ↔ 用户测试现象）；无结论 → 降级委派 `iagent_debug`（委派未真正发生 MUST NOT 表述为委派完成）；两者皆无结论 → 输出「根因未定位」报告、不改任何制品、停在探索阶段出口 [N6][N7][N8][N9][N10]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文含「轻量优先 / 降级 debug / 未定位不改制品」三段表述
  - Spec Ref：spec-update / 双轨根因定位与降级委派
  - Scenario Ref：spec-update / 双轨根因定位与降级委派 / 轻量定位得出根因
  - Scenario Ref：spec-update / 双轨根因定位与降级委派 / 轻量无结论时降级委派 debug
  - Scenario Ref：spec-update / 双轨根因定位与降级委派 / 降级委派未完成时如实报告
  - Scenario Ref：spec-update / 双轨根因定位与降级委派 / 根因未定位时不修改任何制品

- [x] 1.6 [代码] 正文根因结论与修订清单段：产出根因 + 影响面结论；生成修订清单（改哪些制品 / 改哪些段）并呈现给用户 [N11][N12]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文含修订清单段且字段与 `references/update-protocol.md` 模板一致
  - Spec Ref：spec-update / 破坏性改动确认门
  - Scenario Ref：spec-update / 破坏性改动确认门 / 呈现修订清单并确认后改写

- [x] 1.7 [代码] 正文破坏性改动确认门段：呈现修订清单后 **⛔ GATE** 硬停止（归门白名单第 5 类 `destructive-change`，动作级不可豁免）；用户拒绝 → 记录拒绝并停在「更新提案」阶段，MUST NOT 提供跳过出口 [N13][N14]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文门段引用既有 5 类白名单（经 `renderGateWhitelistSection`），含拒绝出口
  - Spec Ref：spec-update / 破坏性改动确认门
  - Scenario Ref：spec-update / 破坏性改动确认门 / 用户拒绝时不改任何制品
  - Scenario Ref：spec-update / 破坏性改动确认门 / 确认门不新增门类别

- [x] 1.8 [代码] 正文原地改写与修订记录段：写前内存副本 → 按 `proposal.md` → `specs/**` → `design.md` → `tasks.md` 顺序逐个写入；成功后向 `revision.md` **追加**条目（问题现象 / 根因 / 修订点 / 影响制品 / 来源）；MUST NOT 创建 `change.json` / `tasks.json` [N15]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文含「写前快照 + 追加而非覆盖 + 不写 JSON 制品」表述
  - Spec Ref：spec-update / 原地改写与修订记录追加
  - Scenario Ref：spec-update / 原地改写与修订记录追加 / 原地改写既有制品并追加修订记录
  - Scenario Ref：spec-update / 原地改写与修订记录追加 / 连续多次 update 追加而非覆盖
  - Scenario Ref：spec-update / 原地改写与修订记录追加 / 不引入 JSON 制品

- [x] 1.9 [代码] 正文改写失败回滚段：任一写入失败 → 用写前内存副本逐个还原已改写制品，报 WARN，停在「更新提案」阶段，MUST NOT 进入实现 [N16]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文含回滚出口与「不留半改写状态」表述
  - Spec Ref：spec-update / 改写失败回滚
  - Scenario Ref：spec-update / 改写失败回滚 / 改写部分失败时回滚
  - Scenario Ref：spec-update / 改写失败回滚 / 回滚后停在更新提案阶段

- [x] 1.10 [代码] 正文再实现优化段：委派 `spec-apply`（精确技能条目 `Skill(iagent-spec-apply)`）承接修订后的任务清单调度 + 编译检查 + 测试执行关卡；MUST NOT 自建一套实现调度 [N17]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文含 apply 委派段与委派失败出口
  - Spec Ref：spec-update / 再实现优化与能力测试对比
  - Scenario Ref：spec-update / 再实现优化与能力测试对比 / 委派 apply 实现优化

- [x] 1.11 [代码] 正文能力测试对比段：产出 `capability-comparison.md`（固定表头：能力 / 修复前表现 / 修复后表现 / 证据位置 / 结论）；修复前基线在轻量差异定位阶段落盘、修复后表现在此追加；委派 `iagent_test` 生成并执行对比用例；MUST NOT 复用 `spec-verify` 三维度口径 [N18]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文含对比表字段清单与口径互斥声明
  - Spec Ref：spec-update / 再实现优化与能力测试对比
  - Scenario Ref：spec-update / 再实现优化与能力测试对比 / 产出能力测试对比制品
  - Scenario Ref：spec-update / 再实现优化与能力测试对比 / 对比口径与 spec-verify 互补不混用

- [x] 1.12 [代码] 正文一致性验证与对比结论段：委派 `spec-verify` 做三维度一致性验证；对比结论 FAIL → 对比表标 FAIL 并列出新引入的问题，MUST NOT 进入归档出口 [N19][N20][N21]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文含 FAIL 出口与「不进归档出口」表述
  - Spec Ref：spec-update / 再实现优化与能力测试对比
  - Scenario Ref：spec-update / 再实现优化与能力测试对比 / 对比结论 FAIL 时不进入归档出口

- [x] 1.13 [代码] 正文结构化回执段：流程收束输出 `phase` / `status` / `artifact` / `nextAllowed` 四字段回执（字段集对齐 `src/core/host-orchestration/protocol.ts` 的 `DEFAULT_RECEIPT_FIELDS`），MUST NOT 只给会话小结 [N22]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文回执段含四个字段名
  - Spec Ref：spec-update / 四环节编排形态与结构化回执
  - Scenario Ref：spec-update / 四环节编排形态与结构化回执 / 输出结构化回执

- [x] 1.14 [代码] `allowedTools` 派生：`Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(node:*)` + `${CODEGRAPH_MCP}` + `${CODEGRAPH_CLI}` + `${skillDelegation(['spec_apply', 'spec_verify', 'test', 'debug'])}`；MUST NOT 手写 `Skill(...)` 字面量、MUST NOT 使用 `Skill(*)` [N1][N5]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照 frontmatter allowed-tools 含四条 canonical 委派条目且无通配
  - Spec Ref：spec-update / 依赖注入与随装补全
  - Scenario Ref：spec-update / 依赖注入与随装补全 / 委派面与依赖面一致

- [x] 1.15 [代码] `references/update-protocol.md` 下沉：修订清单模板 + `revision.md` 条目模板（问题现象 / 根因 / 修订点 / 影响制品 / 来源）+ `capability-comparison.md` 对比表模板；主文件保留骨架与 `Read references/update-protocol.md` 引导 [N12][N15][N18]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：`test/skill-size-budget.test.ts` 通过（生成 SKILL.md ≤ 500 行）且 references 齐备
  - Spec Ref：spec-update / 四环节编排形态与结构化回执
  - Scenario Ref：spec-update / 四环节编排形态与结构化回执 / 四环节顺序不可重排

## 2. 注册与依赖

- [x] 2.1 [代码] `src/core/templates/registry.ts`：新增 `getSpecUpdateSkillTemplate` / `getSpecUpdateCommandTemplate` 导入 + `WORKFLOW_PAIRS` 成对注册条目（spec 类型分组内，与既有 spec 技能并列）[N1]
  - 文件：`src/core/templates/registry.ts`
  - 验证：`iagent list` 规格分组展示新增技能；`deriveCommandId('iagent_spec_update')` ⇒ `spec-update`
  - 依赖：1.1
  - Spec Ref：spec-update / spec-update 技能注册与形态
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / 技能与指令成对注册
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / 指令 id 派生为 spec-update

- [x] 2.2 [代码] `src/core/profiles.ts`：`DEPS` 新增 `'spec-update': ['spec-apply', 'spec-verify', 'test', 'debug']`（与正文委派面逐条一致）；`DEFAULT_WORKFLOWS` 保持 8 项不变，`spec-update` 不纳入 [N1]
  - 文件：`src/core/profiles.ts`
  - 验证：`resolveWorkflows(['spec-update'])` 注入四项；`DEFAULT_WORKFLOWS` 不含 `spec-update`
  - 依赖：1.14
  - Spec Ref：spec-update / 依赖注入与随装补全
  - Scenario Ref：spec-update / 依赖注入与随装补全 / 漏选 update 依赖时随装补全
  - Scenario Ref：spec-update / 依赖注入与随装补全 / update 依赖齐备时不重复注入
  - Scenario Ref：spec-update / 依赖注入与随装补全 / 委派面与依赖面一致

- [x] 2.3 [代码] `src/core/templates/workflows/debug.ts`：description 补反向排歧句（NOT for 已实现变更的提案修订，改用 `iagent-spec-update`）；仅改路由描述文本，MUST NOT 改变 debug 行为（可选增强，ADR-0003 列为可选后续；用户否决则删除本任务，其余任务不受影响）[N8]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：生成快照 debug description 含反向排歧句；`test/templates.test.ts` 的 debug 相关断言全绿
  - 依赖：1.2
  - Spec Ref：spec-update / spec-update 技能注册与形态
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / description 排歧区分相邻技能

- [x] 2.4 [代码] `src/core/legacy-migration.ts`：`LEGACY_WORKFLOW_ID_MAP` 登记同名透传条目 `'spec-update': 'spec-update'`（「新增能力（无旧前身）」登记先例，同 `frontend-skill-gen` / `backend-skill-gen`），保持「映射目标集合 == 注册表指令 id 集」不变量；同步 `test/legacy-migration.test.ts` 三处计数（当前指令 id 数 22 → 23；映射表**键数** 23 → 24；映射目标去重数 22 → 23）[N1]
  - 文件：`src/core/legacy-migration.ts`、`test/legacy-migration.test.ts`
  - 验证：`pnpm test -- legacy-migration` 通过（映射不变量 `toEqual` 断言绿）
  - 依赖：2.1
  - Spec Ref：spec-update / spec-update 技能注册与形态
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / 新技能同步旧标识映射表

## 3. 制品与修订机制边界

- [x] 3.1 [设计] 门归属核对：`GATE_WHITELIST` / `GateWhitelistId` 仍为既有 5 类（`destructive-change` 类别已含「覆盖既有制品」，语义吻合）；`PHASE_GATE_CATEGORY` 不新增映射；`spec-update` 不进 `WORKFLOW_PROTOCOLS` → `src/core/host-orchestration/protocol.ts` 与 `workflows.ts` 零改动，核对结论写入任务留痕 [N13]
  - 文件：`src/core/host-orchestration/protocol.ts`、`src/core/host-orchestration/workflows.ts`
  - 验证：`test/host-orchestration.test.ts` 的 `auditGateWhitelistAlignment` 断言全绿
  - Spec Ref：spec-update / 破坏性改动确认门
  - Scenario Ref：spec-update / 破坏性改动确认门 / 确认门不新增门类别

- [x] 3.2 [设计] 新增变更级制品边界核对：`revision.md` / `capability-comparison.md` 落在变更目录根（不在 `specs/**` 下），不登记进 `SPEC_DRIVEN_SCHEMA.artifacts` → 不被 `status` / `instructions` / `archive` 的主 spec 合并范围收录；归档随变更目录整体移动 → `src/core/spec/schema.ts` 与 `src/core/templates/workflows/spec-archive.ts` 零改动，核对结论写入任务留痕 [N15][N18]
  - 文件：`src/core/spec/schema.ts`、`src/core/templates/workflows/spec-archive.ts`
  - 验证：`test/markdown-spec-cli.test.ts` / `test/spec-instructions-apply.test.ts` 全绿
  - Spec Ref：spec-update / 新增变更级制品的归档边界
  - Scenario Ref：spec-update / 新增变更级制品的归档边界 / 新增制品不进入主 spec 合并范围
  - Scenario Ref：spec-update / 新增变更级制品的归档边界 / 归档时随变更目录整体移动

- [x] 3.3 [设计] 「修复前表现」基线落盘时点确认：在轻量差异定位阶段（N6）随用户测试现象写入 `capability-comparison.md` 基线块，修复后表现在 N18 追加；基线不落 `.openspec-tmp/`（本机产物不入库）[N6][N18]
  - 文件：`src/core/templates/workflows/spec-update.ts`
  - 验证：生成快照正文含基线落盘时点与追加语义表述
  - 依赖：1.5、1.11
  - Spec Ref：spec-update / 再实现优化与能力测试对比
  - Scenario Ref：spec-update / 再实现优化与能力测试对比 / 产出能力测试对比制品

## 4. 快照、计数断言与文档

- [x] 4.1 [代码] `pnpm build && pnpm generate:skills` 重新生成 `skills/` 静态快照（模板改动的强制伴随步骤，`test/skills-parity.test.ts` 回归锁）[N1]
  - 文件：`skills/`
  - 验证：`test/skills-parity.test.ts` 通过
  - 依赖：1.1、2.1、2.3
  - Spec Ref：spec-update / spec-update 技能注册与形态
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / 技能与指令成对注册

- [x] 4.2 [代码] 同步既有测试中的技能 / 指令计数断言（实际分布 **8 个文件、15 处**：`test/templates.test.ts:28`、`test/template-derivation.test.ts:21-22`、`test/template-consistency.test.ts:146`、`test/skills-parity.test.ts:123`、`test/commands.test.ts:151/162/601/615`、`test/config-command.test.ts:32`、`test/validate-update.test.ts:37/45/46`、`test/legacy-migration.test.ts:209/213`）由 22 → 23；只改计数，MUST NOT 改测试语义 [N1]
  - 特别注意：`test/legacy-migration.test.ts:210` 的映射表**键数**断言语义不同（23 → 24），MUST NOT 按「22 → 23」盲改（见任务 2.4）
  - 文件：`test/templates.test.ts`、`test/template-derivation.test.ts`、`test/template-consistency.test.ts`、`test/skills-parity.test.ts`、`test/commands.test.ts`、`test/config-command.test.ts`、`test/validate-update.test.ts`、`test/legacy-migration.test.ts`
  - 验证：`pnpm test` 对应文件全绿
  - 依赖：2.1、2.4、4.1
  - Spec Ref：spec-update / spec-update 技能注册与形态
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / 指令 id 派生为 spec-update

- [x] 4.3 [使用说明] 版本号判定与变更日志：`node bin/iagent.js version` 只读判定 → `node bin/iagent.js version bump` 写回（新增技能模板 = minor）；同步 `package.json` / `CHANGELOG.md` / `README.md` 版本示例 [N1]
  - 产出：`package.json`、`CHANGELOG.md`、`README.md`
  - 验证：`node bin/iagent.js version` 输出与提交内容一致
  - 依赖：4.1
  - Spec Ref：spec-update / spec-update 技能注册与形态
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / 不进入默认集与阶段协议表

## 5. 测试

- [x] 5.1 [测试][单元][P0] 新增 `test/spec-update-skill.test.ts`：断言注册与派生形态 —— `WORKFLOW_PAIRS` 含 `spec-update` 技能对；`deriveCommandId('iagent_spec_update')` ⇒ `spec-update`；command 正文由 `deriveCommandContent()` 派生；`DEFAULT_WORKFLOWS` 与 `WORKFLOW_PROTOCOLS` 均无 `spec-update`；description 含三向 `NOT for` 排歧；`LEGACY_WORKFLOW_ID_MAP` 含同名透传条目 `'spec-update': 'spec-update'` 且其目标集合 == 注册表指令 id 集（依赖 2.1 / 2.2 / 2.4 / 4.1）[N1]
  - 文件：`test/spec-update-skill.test.ts`
  - 验证：`pnpm test -- spec-update-skill`
  - 依赖：2.1、2.2、2.4、4.1
  - Spec Ref：spec-update / spec-update 技能注册与形态
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / 技能与指令成对注册
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / 指令 id 派生为 spec-update
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / 不进入默认集与阶段协议表
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / description 排歧区分相邻技能
  - Scenario Ref：spec-update / spec-update 技能注册与形态 / 新技能同步旧标识映射表

- [x] 5.2 [测试][单元][P0] 同上测试文件：断言前置校验阻断语义 —— `progress.remaining !== 0` → 阻断且不改任何制品；变更不存在 → 阻断；`remaining === 0` → 放行进入归档态判定（依赖 1.3 / 4.1）[N2][N3]
  - 文件：`test/spec-update-skill.test.ts`
  - 验证：`pnpm test -- spec-update-skill`
  - 依赖：1.3、4.1
  - Spec Ref：spec-update / update 前置校验与实现未完成阻断
  - Scenario Ref：spec-update / update 前置校验与实现未完成阻断 / 实现未完成时阻断
  - Scenario Ref：spec-update / update 前置校验与实现未完成阻断 / 目标变更不存在时阻断
  - Scenario Ref：spec-update / update 前置校验与实现未完成阻断 / 任务全部勾选时放行

- [x] 5.3 [测试][单元][P0] 同上测试文件：断言已归档复活复制语义 —— 复制为 `update-<原名>-<YYYYMMDD>`；原归档目录不动；复制失败 → 阻断（依赖 1.4 / 4.1）[N4][N5]
  - 文件：`test/spec-update-skill.test.ts`
  - 验证：`pnpm test -- spec-update-skill`
  - 依赖：1.4、4.1
  - Spec Ref：spec-update / 已归档变更的复活复制
  - Scenario Ref：spec-update / 已归档变更的复活复制 / 已归档变更复制为新变更
  - Scenario Ref：spec-update / 已归档变更的复活复制 / 原归档目录保持不动
  - Scenario Ref：spec-update / 已归档变更的复活复制 / 复制失败时阻断

- [x] 5.4 [测试][单元][P0] 同上测试文件：断言双轨根因定位语义 —— 轻量得出根因时不委派 debug；无结论降级委派 `iagent_debug`；委派未发生 MUST NOT 表述为委派完成；根因未定位时 MUST NOT 改任何制品（依赖 1.5 / 4.1）[N6][N7][N8][N9][N10]
  - 文件：`test/spec-update-skill.test.ts`
  - 验证：`pnpm test -- spec-update-skill`
  - 依赖：1.5、4.1
  - Spec Ref：spec-update / 双轨根因定位与降级委派
  - Scenario Ref：spec-update / 双轨根因定位与降级委派 / 轻量定位得出根因
  - Scenario Ref：spec-update / 双轨根因定位与降级委派 / 轻量无结论时降级委派 debug
  - Scenario Ref：spec-update / 双轨根因定位与降级委派 / 降级委派未完成时如实报告
  - Scenario Ref：spec-update / 双轨根因定位与降级委派 / 根因未定位时不修改任何制品

- [x] 5.5 [测试][单元][P0] 同上测试文件：断言破坏性改动确认门语义 —— 呈现修订清单后经 ⛔ GATE 确认才改写；拒绝 → 不改任何制品且无跳过出口；门段只引用既有 5 类白名单且破坏性门归 `destructive-change`（依赖 1.6 / 1.7 / 3.1 / 4.1）[N13][N14]
  - 文件：`test/spec-update-skill.test.ts`
  - 验证：`pnpm test -- spec-update-skill`；`test/host-orchestration.test.ts` 全绿
  - 依赖：1.6、1.7、3.1、4.1
  - Spec Ref：spec-update / 破坏性改动确认门
  - Scenario Ref：spec-update / 破坏性改动确认门 / 呈现修订清单并确认后改写
  - Scenario Ref：spec-update / 破坏性改动确认门 / 用户拒绝时不改任何制品
  - Scenario Ref：spec-update / 破坏性改动确认门 / 确认门不新增门类别

- [x] 5.6 [测试][单元][P0] 同上测试文件：断言原地改写与修订记录追加语义 —— 写前内存副本；`revision.md` 追加不覆盖；MUST NOT 写 `change.json` / `tasks.json`；部分失败 → 回滚；回滚后停在「更新提案」阶段（依赖 1.8 / 1.9 / 4.1）[N15][N16]
  - 文件：`test/spec-update-skill.test.ts`
  - 验证：`pnpm test -- spec-update-skill`
  - 依赖：1.8、1.9、4.1
  - Spec Ref：spec-update / 原地改写与修订记录追加
  - Scenario Ref：spec-update / 原地改写与修订记录追加 / 原地改写既有制品并追加修订记录
  - Scenario Ref：spec-update / 原地改写与修订记录追加 / 连续多次 update 追加而非覆盖
  - Scenario Ref：spec-update / 原地改写与修订记录追加 / 不引入 JSON 制品
  - Spec Ref：spec-update / 改写失败回滚
  - Scenario Ref：spec-update / 改写失败回滚 / 改写部分失败时回滚
  - Scenario Ref：spec-update / 改写失败回滚 / 回滚后停在更新提案阶段

- [x] 5.7 [测试][单元][P0] 同上测试文件：断言再实现与能力测试对比语义 —— 委派 `spec-apply`；产出 `capability-comparison.md`（固定表头）；对比口径与 `spec-verify` 三维度互补不混用；FAIL → 标 FAIL 且不进归档出口；`revision.md` / `capability-comparison.md` 未登记进 `SPEC_DRIVEN_SCHEMA` 且随变更目录整体移动（依赖 1.10 / 1.11 / 1.12 / 3.2 / 4.1）[N17][N18][N19][N20][N21]
  - 文件：`test/spec-update-skill.test.ts`
  - 验证：`pnpm test -- spec-update-skill`
  - 依赖：1.10、1.11、1.12、3.2、4.1
  - Spec Ref：spec-update / 再实现优化与能力测试对比
  - Scenario Ref：spec-update / 再实现优化与能力测试对比 / 委派 apply 实现优化
  - Scenario Ref：spec-update / 再实现优化与能力测试对比 / 产出能力测试对比制品
  - Scenario Ref：spec-update / 再实现优化与能力测试对比 / 对比口径与 spec-verify 互补不混用
  - Scenario Ref：spec-update / 再实现优化与能力测试对比 / 对比结论 FAIL 时不进入归档出口
  - Spec Ref：spec-update / 新增变更级制品的归档边界
  - Scenario Ref：spec-update / 新增变更级制品的归档边界 / 新增制品不进入主 spec 合并范围
  - Scenario Ref：spec-update / 新增变更级制品的归档边界 / 归档时随变更目录整体移动

- [x] 5.8 [测试][单元][P1] 扩展 `test/profiles.test.ts`：`resolveWorkflows(['spec-update'])` 注入 `spec-apply` / `spec-verify` / `test` / `debug` 四项并输出提示；四项齐备时不重复注入（依赖 2.2）[N1]
  - 文件：`test/profiles.test.ts`
  - 验证：`pnpm test -- profiles`
  - 依赖：2.2
  - Spec Ref：spec-update / 依赖注入与随装补全
  - Scenario Ref：spec-update / 依赖注入与随装补全 / 漏选 update 依赖时随装补全
  - Scenario Ref：spec-update / 依赖注入与随装补全 / update 依赖齐备时不重复注入

- [x] 5.9 [测试][单元][P1] `test/spec-update-skill.test.ts`：委派面与依赖面一致回归锁 —— `spec-update` 正文委派集合 == `DEPS['spec-update']`；委派条目均为 canonical 形态（`Skill(iagent-spec-apply)` 等）；MUST NOT 出现 `Skill(*)` 或裸名条目（依赖 1.14 / 2.2 / 4.1）[N1]
  - 文件：`test/spec-update-skill.test.ts`
  - 验证：`pnpm test -- spec-update-skill`；`test/allowed-tools.test.ts` / `test/tool-whitelist-constants.test.ts` 全绿
  - 依赖：1.14、2.2、4.1
  - Spec Ref：spec-update / 依赖注入与随装补全
  - Scenario Ref：spec-update / 依赖注入与随装补全 / 委派面与依赖面一致

- [x] 5.10 [测试][单元][P2] 评估：四环节顺序不可重排与结构化回执为纯正文行为契约（无独立运行时面），由 5.1 的正文形态断言与 5.11 的全量回归覆盖 —— 判定并入 5.1 / 5.11，无需独立测试文件（依据：同一断言面，无可测的运行时行为）
  - 留痕：判定结论 —— `test/spec-update-skill.test.ts` 的「四环节段序 + 回执字段」用例断言 `exploration` → `更新提案` → `再实现` → `能力测试对比` 顺序与 `phase` / `status` / `artifact` / `nextAllowed` 字段名
  - 文件：`test/spec-update-skill.test.ts`
  - 验证：5.1 / 5.11 通过即留痕判定结论
  - 依赖：5.1
  - Spec Ref：spec-update / 四环节编排形态与结构化回执
  - Scenario Ref：spec-update / 四环节编排形态与结构化回执 / 四环节顺序不可重排
  - Scenario Ref：spec-update / 四环节编排形态与结构化回执 / 输出结构化回执

- [x] 5.11 [测试][单元][P1] 全量回归 `pnpm test`（至少 skills-parity / allowed-tools / skill-size-budget / templates / template-derivation / template-consistency / command-reference-refs / profiles / host-orchestration / gate-ledger / pi-native / opencode-v2 / claude-host-adapter）；既有断言随模板扩展同步更新（仅扩展断言，MUST NOT 改测试语义）（依赖全部实现任务）[N1]
  - 留痕：全量 `pnpm test` **75 文件 / 1669 用例全绿**（含新增 `test/spec-update-skill.test.ts` 27 用例）；既有断言同步面：计数 8 文件 15 处（22 → 23）、`legacy-migration` 键数 23 → 24、`generation` 注入数 21 → 22 与 `uninstall` 47/67/69 → 50/70/72、`templates` 类型统计 spec 7 → 8
  - 文件：`test/`（既有测试文件按需同步）
  - 验证：`pnpm test` 全绿
  - 依赖：1.1、1.2、1.3、1.4、1.5、1.6、1.7、1.8、1.9、1.10、1.11、1.12、1.13、1.14、1.15、2.1、2.2、2.3、3.1、3.2、3.3、4.1、4.2、4.3
  - Spec Ref：spec-update / 四环节编排形态与结构化回执
  - Scenario Ref：spec-update / 四环节编排形态与结构化回执 / 四环节顺序不可重排
