# Tasks: add-project-skill-integration

## 1. 配置与技能载体（N9-N13）

- [x] 1.1 [代码] 扩展 `parseProjectConfig` / `readProjectConfig` 解析 `skills:` 段（`frontend` / `backend` 分组、裸名条目、缺段为空集；非法条目跳过 + WARN，不重序列化 YAML） [N9]
  - 文件：`src/core/project-config.ts`
  - 验证：`parseProjectConfig` 返回 `skills` 分组；注释/未知段逐字保留
  - Spec Ref：project-skill-config / 项目技能配置段
  - Scenario Ref：解析分组条目

- [x] 1.2 [代码] 实现项目技能文件读取（frontmatter `phases` / `scope` / `frameworks`，非法记未读）与路径解析回退（`.iagent/skills/<name>.md` 优先 → 生效 `tools` 顺序的 `<skillsDir>/skills/<name>/SKILL.md`；同名冲突 WARN、不合并；全无 `exists=false`） [N11][N12][N13]
  - 文件：`src/core/project-skills.ts`（新建）
  - 验证：frontmatter 三键解析与非法路径；三路命中/回退/未命中单测；跨平台路径用 `path.join` + posix 归一化
  - Spec Ref：project-skill-config / 项目技能文件载体与 frontmatter
  - Scenario Ref：读取有效技能文件

- [x] 1.3 [代码] 新增 `iagent skills` 命令（`--json` / 文本），注册到 CLI、同步 completion `IAGENT_COMMANDS` 表与 version `collectFileSignals` 信号 [N10]
  - 文件：`src/commands/skills.ts`（新建）、`src/cli/index.ts`、`src/commands/completion.ts`、`src/commands/version.ts`
  - 验证：`node bin/iagent.js skills --json` 输出条目与元数据；无配置返回空集合并退出 0
  - Spec Ref：project-skill-config / iagent skills 枚举命令
  - Scenario Ref：JSON 输出

- [x] 1.4 [代码] 新增 `skills:` 段回写函数（段替换、保留注释/未知段、幂等追加，不重复条目） [N7]
  - 文件：`src/core/project-config.ts`
  - 验证：追加/重复/既有注释三组单测；字节级幂等
  - Spec Ref：project-skill-distillation / 蒸馏产物自动注册
  - Scenario Ref：自动注册

- [x] 1.5 [代码] `iagent skills --json` 输出 `validation`（`status` / `missingSections` / `emptySections` / `placeholders` / `ruleLinesWithoutEvidence`）；必需章节名与占位符清单与蒸馏自检共享同一常量 [N10]
  - 文件：`src/commands/skills.ts`、`src/core/project-skills.ts`
  - 验证：完整 / 缺章节 / 占位符 / exists=false 四组单测；只读不修改文件
  - Spec Ref：project-skill-config / 技能完整性校验输出
  - Scenario Ref：完整技能

## 2. 技能蒸馏（N1-N8）

- [x] 2.1 [代码] `iagent_project_init` 新增第 11 步：读取扫描基线、证据判定前后端框架、无证据侧不生成（候选 ≠ 使用） [N1][N2][N2S]
  - 文件：`src/core/templates/workflows/project-init.ts`
  - 验证：技能正文含触发顺序与零猜测条款；`test/templates.test.ts` 断言
  - Spec Ref：project-skill-distillation / 框架证据判定与单侧缺失
  - Scenario Ref：纯后端项目

- [x] 2.2 [代码] 实现蒸馏产物生成与复杂度拆分判定（默认每侧一份；≥2 框架 / ≥3 分层族 / 单段 >150 行时拆分；多框架同文档分节 + `frameworks`） [N3][N4][N4S]
  - 文件：`src/core/templates/workflows/project-init.ts`
  - 验证：正文含拆分判据与报告要求；模板断言
  - Spec Ref：project-skill-distillation / 产物形态与复杂度拆分
  - Scenario Ref：复杂时拆分

- [x] 2.3 [代码] 复用逐份确认与人工域保护分支处理已存在技能文件（重新生成 / 修改 / 跳过；破损取保留侧） [N5][N5C]
  - 文件：`src/core/templates/workflows/project-init.ts`
  - 验证：正文复用既有第 5/6 步分支；`test/grill-paper-trail.test.ts` 或模板断言覆盖
  - Spec Ref：project-skill-distillation / 已存在确认与人工域保护
  - Scenario Ref：人工域逐字保留

- [x] 2.4 [代码] 蒸馏后自动注册 + 失败非阻断（写入/注册失败 WARN 继续，不回滚已生成文件） [N6][N7][N8]
  - 文件：`src/core/templates/workflows/project-init.ts`
  - 验证：正文含非阻断条款；模板断言
  - Spec Ref：project-skill-distillation / 技能蒸馏步骤与触发顺序
  - Scenario Ref：写入失败不阻断

- [x] 2.5 [代码] 蒸馏安全边界条款写入正文（MUST NOT 记录凭据值与绕过细节，只写键名）
  - 文件：`src/core/templates/workflows/project-init.ts`
  - 验证：正文含安全禁令；模板断言
  - Spec Ref：project-skill-distillation / 蒸馏安全边界
  - Scenario Ref：配置文件含凭据

- [x] 2.6 [代码] 蒸馏写入前 C1-C6 完整性自检门 + 报告完整性摘要（缺章节补齐或写「不适用 + 依据」；无法补齐 MUST NOT 写入；无证据规则不写入；占位符阻断；冲突标注；超长拆分） [N3][N4][N4S]
  - 文件：`src/core/templates/workflows/project-init.ts`
  - 验证：正文含 C1-C6 清单与不写入条件；报告逐侧给出自检结论
  - Spec Ref：project-skill-distillation / 技能内容完整性自检门
  - Scenario Ref：完整通过写入

## 3. 探索消费（N14-N19）

- [x] 3.1 [代码] `iagent_spec_explore`：规则基线之后新增技能基线检查点，**按阶段筛选**（`phases` 含 design|both）加载，落探索文件 `## 项目技能基线`（与 `## 项目规则基线` 并列、互不替代）；无配置/缺失 WARN 继续 [N14][N15][N16][N19]
  - 文件：`src/core/templates/workflows/spec-explore.ts`、`references/skill-baseline.md`（新建，超预算时下沉）
  - 验证：模板含检查点与段落结构；两段并列；`test/skill-size-budget.test.ts` 通过
  - Spec Ref：project-skill-consumption / 探索起点技能基线
  - Scenario Ref：建立技能基线

- [x] 3.2 [代码] 探索 grill / 功能设计以技能为约束，技能与代码冲突显式呈现（代码事实优先） [N17]
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：正文含约束与冲突呈现条款
  - Spec Ref：project-skill-consumption / 设计与排查以技能为约束
  - Scenario Ref：技能与代码冲突

- [x] 3.3 [代码] `iagent_spec_propose`：读取 exploration 的 `## 项目技能基线`，在 handoff `## 规范要点` 追加「技能要点」子节并标来源；基线缺失时 WARN + 枚举一次，MUST NOT 重新枚举或编造 [N18]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：正文含复用/降级条款；模板断言
  - Spec Ref：project-skill-consumption / 编排层跨阶段透传与核对
  - Scenario Ref：propose 复用而非重枚举

- [x] 3.4 [代码] `iagent_debug`：排查起点建立技能基线（阶段筛选 design|both，与规则基线并列） [N15]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：正文含技能基线条款；skill + command 双处同步
  - Spec Ref：project-skill-consumption / 探索起点技能基线
  - Scenario Ref：读取失败计未读

- [x] 3.5 [代码] 探索技能基线记录完整性状态（`ok` / `incomplete` / `null`）；`incomplete` 记 WARN 并列出缺失章节 / 占位符 / 无证据规则数 [N16]
  - 文件：`src/core/templates/workflows/spec-explore.ts`、`src/core/templates/workflows/debug.ts`
  - 验证：正文含完整性列与 WARN 处置；模板断言
  - Spec Ref：project-skill-consumption / 不完整技能的消费处置
  - Scenario Ref：基线记录不完整状态

## 4. 实现消费（N20-N26）

- [x] 4.1 [代码] `iagent_spec_apply`：实现前读取 `phases` 含 implement|both 的技能，回执新增 `skillsRead`（配置空时为空数组）与 `skillsIncomplete` [N20][N21]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：正文含读取与回执字段；模板断言
  - Spec Ref：project-skill-consumption / 实现消费与回执
  - Scenario Ref：实现前读取技能

- [x] 4.2 [代码] `iagent_workflow` / `iagent_auto_workflow`：Phase 1 透传技能基线状态；实现阶段核对被委派回执 `skillsRead` / `skillsIncomplete`，缺字段 WARN，不伪造 [N25]
  - 文件：`src/core/templates/workflows/workflow.ts`、`src/core/templates/workflows/auto-workflow.ts`
  - 验证：Phase 1 与 Phase 4 双处条款；skill + command 双处同步；模板断言
  - Spec Ref：project-skill-consumption / 编排层跨阶段透传与核对
  - Scenario Ref：Phase 1 透传基线状态

- [x] 4.3 [代码] 实现一致性门新增 `skills-not-read` 诊断（**仅统计 implement|both**；存在未读 fail；design-only 不要求；缺失 WARN；空配置 pass；与 `rules-not-read` 独立） [N22][N23][N24][N26]
  - 文件：`src/core/templates/workflows/spec-verify.ts`
  - 验证：正文含诊断码与三条判定分支；模板断言
  - Spec Ref：project-skill-consumption / skills-not-read 一致性诊断
  - Scenario Ref：声明且存在但未读

- [x] 4.4 [代码] apply 回执新增 `skillsIncomplete`；一致性诊断输出 `skills-incomplete` 为 WARN（MUST NOT 判 fail；已读但不完整不触发 `skills-not-read`） [N21][N22]
  - 文件：`src/core/templates/workflows/spec-apply.ts`、`src/core/templates/workflows/spec-verify.ts`
  - 验证：正文含回执字段与 WARN 判定；模板断言
  - Spec Ref：project-skill-consumption / 不完整技能的消费处置
  - Scenario Ref：apply 回执记录不完整技能

- [x] 4.5 [代码] `iagent_debug` 修复阶段读取 implement|both 技能并回执 `skillsRead` / `skillsIncomplete`；design-only 不要求 [N20][N21]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：修复阶段条款与阶段过滤；skill + command 双处同步
  - Spec Ref：project-skill-consumption / debug 修复阶段消费实现技能
  - Scenario Ref：修复前读取实现技能

## 5. 文档与快照

- [x] 5.1 [使用说明] 更新项目 `AGENTS.md`：补充 `skills:` 配置、`iagent skills` 命令、技能基线与 `skillsRead` 的约定
  - 产出: `AGENTS.md`
  - 验证：章节含新增能力与命令
  - Spec Ref：project-skill-consumption / 技能基线与规则基线并列
  - Scenario Ref：两段并列存在

- [x] 5.2 [代码] 重新生成 `skills/` 静态快照（`pnpm build && pnpm generate:skills`）
  - 文件：`skills/**`
  - 验证：`pnpm test` 中 `skills-parity` 通过
  - Spec Ref：project-skill-config / iagent skills 枚举命令
  - Scenario Ref：命令只读

## 6. 测试

- [x] 6.1 [测试][单元][P0] 配置段解析：分组条目、缺段空集、注释与未知段保留
  - 文件：`test/project-config-skills.test.ts`
  - 验证：断言解析结果与原文保留
  - Spec Ref：project-skill-config / 项目技能配置段
  - Scenario Ref：解析分组条目
  - Scenario Ref：无 skills 段为空集
  - Scenario Ref：注释与未知段保留

- [x] 6.2 [测试][单元][P0] 技能文件载体与 frontmatter：有效读取、非法记未读
  - 文件：`test/project-skills.test.ts`
  - 验证：断言元数据与 WARN 路径
  - Spec Ref：project-skill-config / 项目技能文件载体与 frontmatter
  - Scenario Ref：读取有效技能文件
  - Scenario Ref：frontmatter 非法
  - Scenario Ref：名称与文件名不一致

- [x] 6.3 [测试][单元][P0] 路径解析与回退（含硬约束 1、6：默认路径优先 / 同名不合并）
  - 文件：`test/project-skills.test.ts`
  - 验证：三路命中、回退顺序、未命中
  - Spec Ref：project-skill-config / 路径解析与宿主目录回退
  - Scenario Ref：.iagent 命中优先
  - Scenario Ref：回退宿主目录
  - Scenario Ref：全部未命中
  - Scenario Ref：跨宿主回退顺序一致

- [x] 6.4 [测试][单元][P0] CLI 枚举：JSON 输出、无配置空集合、只读（含硬约束 2：只认配置）
  - 文件：`test/skills-command.test.ts`
  - 验证：子进程或函数级断言输出与退出码
  - Spec Ref：project-skill-config / iagent skills 枚举命令
  - Scenario Ref：JSON 输出
  - Scenario Ref：无配置返回空集合
  - Scenario Ref：命令只读

- [x] 6.5 [测试][单元][P0] 蒸馏步骤与顺序（含硬约束 4：非阻断）
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：正文断言顺序与非阻断条款
  - Spec Ref：project-skill-distillation / 技能蒸馏步骤与触发顺序
  - Scenario Ref：在规则蒸馏之后触发
  - Scenario Ref：写入失败不阻断

- [x] 6.6 [测试][单元][P0] 框架证据判定与单侧缺失（含硬约束 5：无证据不生成）
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：正文断言零猜测与单侧缺失条款
  - Spec Ref：project-skill-distillation / 框架证据判定与单侧缺失
  - Scenario Ref：候选依赖不产生技能
  - Scenario Ref：纯后端项目

- [x] 6.7 [测试][单元][P0] 产物形态与拆分判定
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：正文断言默认单文档、拆分判据、多框架分节
  - Spec Ref：project-skill-distillation / 产物形态与复杂度拆分
  - Scenario Ref：默认单文档
  - Scenario Ref：复杂时拆分
  - Scenario Ref：多框架同文档分节

- [x] 6.8 [测试][单元][P0] 已存在确认与人工域保护
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言逐份确认、人工域保留、全跳过终态
  - Spec Ref：project-skill-distillation / 已存在确认与人工域保护
  - Scenario Ref：逐份确认
  - Scenario Ref：人工域逐字保留
  - Scenario Ref：全部跳过

- [x] 6.9 [测试][单元][P0] 蒸馏自动注册与幂等
  - 文件：`test/project-config-skills.test.ts`
  - 验证：自动追加、重复不变、失败不回滚
  - Spec Ref：project-skill-distillation / 蒸馏产物自动注册
  - Scenario Ref：自动注册
  - Scenario Ref：幂等
  - Scenario Ref：注册失败不回滚

- [x] 6.10 [测试][单元][P1] 蒸馏安全边界（不写凭据值）
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：正文断言安全禁令
  - Spec Ref：project-skill-distillation / 蒸馏安全边界
  - Scenario Ref：配置文件含凭据

- [x] 6.11 [测试][单元][P0] 探索技能基线（建立 / 无配置 / 读取失败）
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言 `## 项目技能基线` 结构与三态
  - Spec Ref：project-skill-consumption / 探索起点技能基线
  - Scenario Ref：建立技能基线
  - Scenario Ref：无技能配置
  - Scenario Ref：读取失败计未读

- [x] 6.12 [测试][单元][P0] 设计与技能冲突呈现
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言设计约束与冲突条款
  - Spec Ref：project-skill-consumption / 设计与排查以技能为约束
  - Scenario Ref：设计阶段加载 design 技能
  - Scenario Ref：技能与代码冲突

- [x] 6.13 [测试][单元][P1] handoff 技能要点
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言子节与无配置文案
  - Spec Ref：project-skill-consumption / handoff 技能要点
  - Scenario Ref：技能要点入包
  - Scenario Ref：无技能时显式记录

- [x] 6.14 [测试][单元][P0] 实现消费与回执
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言读取、`skillsRead` 三态
  - Spec Ref：project-skill-consumption / 实现消费与回执
  - Scenario Ref：实现前读取技能
  - Scenario Ref：回执缺字段
  - Scenario Ref：无配置合法终态

- [x] 6.15 [测试][单元][P0] `skills-not-read` 诊断（含硬约束 3：缺失不 fail / 未读 fail）
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言三条判定分支与独立校验
  - Spec Ref：project-skill-consumption / skills-not-read 一致性诊断
  - Scenario Ref：声明且存在但未读
  - Scenario Ref：design-only 技能不要求读取
  - Scenario Ref：声明但文件缺失
  - Scenario Ref：与 rules-not-read 独立

- [x] 6.16 [测试][单元][P1] 技能基线与规则基线并列
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言两段并列、技能不计入规则源
  - Spec Ref：project-skill-consumption / 技能基线与规则基线并列
  - Scenario Ref：两段并列存在
  - Scenario Ref：技能不计入规则源

- [x] 6.17 [测试][单元][P0] 蒸馏内容完整性自检门（C1-C6；不完整不写入）
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言自检清单、补齐路径、不写入条件、占位符阻断、无证据规则拦截、冲突标注、超长拆分
  - Spec Ref：project-skill-distillation / 技能内容完整性自检门
  - Scenario Ref：完整通过写入
  - Scenario Ref：缺章节可补齐
  - Scenario Ref：无法补齐不写入
  - Scenario Ref：占位符阻断
  - Scenario Ref：规则无证据不写入
  - Scenario Ref：与既有规则冲突
  - Scenario Ref：超长拆分
  - Scenario Ref：拆分产物各自通过自检

- [x] 6.18 [测试][单元][P0] 蒸馏报告完整性摘要
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言逐侧自检结论与未生成原因
  - Spec Ref：project-skill-distillation / 蒸馏报告完整性摘要
  - Scenario Ref：报告含自检结论
  - Scenario Ref：未生成侧说明原因

- [x] 6.19 [测试][单元][P0] `iagent skills --json` 完整性校验输出
  - 文件：`test/skills-command.test.ts`
  - 验证：断言 `validation` 四态与只读性
  - Spec Ref：project-skill-config / 技能完整性校验输出
  - Scenario Ref：完整技能
  - Scenario Ref：缺章节
  - Scenario Ref：含占位符
  - Scenario Ref：不存在条目
  - Scenario Ref：分阶段章节要求

- [x] 6.20 [测试][单元][P0] 不完整技能消费处置
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言基线 WARN、`skillsIncomplete` 回执、`skills-incomplete` 仅 WARN
  - Spec Ref：project-skill-consumption / 不完整技能的消费处置
  - Scenario Ref：基线记录不完整状态
  - Scenario Ref：apply 回执记录不完整技能
  - Scenario Ref：诊断仅告警

- [x] 6.21 [测试][单元][P0] 编排层跨阶段透传与核对
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言 Phase 1 透传、Phase 4 核对、propose 复用/降级
  - Spec Ref：project-skill-consumption / 编排层跨阶段透传与核对
  - Scenario Ref：Phase 1 透传基线状态
  - Scenario Ref：Phase 4 核对实现回执
  - Scenario Ref：propose 复用而非重枚举
  - Scenario Ref：基线缺失降级

- [x] 6.22 [测试][单元][P0] debug 修复阶段消费实现技能
  - 文件：`test/project-skill-templates.test.ts`
  - 验证：断言修复读取、design-only 不要求
  - Spec Ref：project-skill-consumption / debug 修复阶段消费实现技能
  - Scenario Ref：修复前读取实现技能
  - Scenario Ref：design-only 不进入修复约束
