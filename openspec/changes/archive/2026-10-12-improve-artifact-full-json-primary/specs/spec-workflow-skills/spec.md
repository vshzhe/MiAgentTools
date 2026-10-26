## MODIFIED Requirements

### Requirement: spec-propose 模板 SHALL 按合并 JSON 主产物生成提案
spec-propose.ts 模板 MUST 将 JSON Sidecar Generation 段重写为合并文件流程：逐段写 `.venus/change.json` → `venus spec render <type>` 渲染 → 校验失败修正 → 渲染失败降级手写 MD。MUST NOT 再引用 `venus spec sidecar manifest`。

#### Scenario: 按依赖序累积写入三段
- **WHEN** AI 生成变更制品
- **THEN** SHALL 依次：写 change.json 的 proposal 段 → `render proposal` → 追加 specs 段 → `render specs` → 追加 design 段 → `render design` → 写 tasks.json → `render tasks`
- **AND** 每次整文件 Write MUST 保留已有段落
- **AND** 命令失败时 SHALL 降级为 Write 工具手写对应 MD + WARN

#### Scenario: 移除旧命令引用
- **WHEN** 检查 spec-propose.ts 正文
- **THEN** MUST NOT 含 `venus spec sidecar manifest` 或 `venus spec tasks render` 引用
- **AND** SHOULD 引用 `openspec/rules/artifact-generation.md` 作为生成协议单一源

### Requirement: 生成协议 artifact-generation.md SHALL 承载 JSON-first 步骤（单一源）
`openspec/rules/artifact-generation.md` 的 G2 段 MUST 重写为 JSON-first 流程，供 spec-propose / tr-impl-workflow / tr-impl-auto-workflow 三条生成路径共享。tr-impl-auto-workflow Phase 2 MUST 显式引用该协议。

#### Scenario: 协议定义 JSON-first 步骤
- **WHEN** 读取 artifact-generation.md G2
- **THEN** 每个 artifact 的生成步骤 SHALL 为：写 change.json 对应段（或 tasks.json）→ `venus spec render <type>` → 校验失败修正 JSON → 渲染失败手写 MD 降级（WARN）
- **AND** SHALL 含 change.json 段落结构与字段说明（或指向 jsonTemplate）

#### Scenario: 三条生成路径统一生效
- **WHEN** tr-impl-workflow Phase 2.4 / tr-impl-auto-workflow Phase 2 执行内联生成
- **THEN** 两者 MUST 引用或复述 artifact-generation.md 的 JSON-first 步骤
- **AND** MUST NOT 存在"仅写 MD、不写 JSON"的生成路径

### Requirement: tr-docs-requirement-doc SHALL 从 change.json 结构化获取章节内容
需求文档生成 MUST 优先从 `.venus/change.json`（proposal/design/specs 段）+ `.venus/tasks.json` 读取章节来源，MD 文件仅作降级回退。

#### Scenario: 章节来源改为 JSON 段落
- **WHEN** tr-docs-requirement-doc 生成需求文档
- **THEN** 读取顺序 SHALL 为：1. `.venus/change.json` 2. `.venus/tasks.json` 3. MD 降级（proposal.md/design.md/tasks.md，WARN）
- **AND** 映射 SHALL 更新：一、原始需求←proposal.why；二、需求拆解←proposal.whatChanges；二、非本期范围←design.nonGoals；三、技术框架←design（decisions 表直接遍历渲染）；四、业务流程←design.decisions+context；七、影响分析←proposal.impact
- **AND** "关键技术决策"表 SHALL 从 `design.decisions[]` 遍历渲染（不再需要旧 decisions.json 判断）

#### Scenario: 命令版与技能版同步
- **WHEN** 检查 tr-docs-requirement-doc 的技能版与命令版
- **THEN** 两版 MUST 使用相同的 change.json 读取与映射口径（单一源或在途派生）

### Requirement: spec-archive / spec-bulk-archive SHALL 从 change.json specs 段执行主 spec 同步
归档的 delta spec → 主 spec 合并 MUST 优先从 `.venus/change.json` 的 specs 段读取结构化操作（ADDED/MODIFIED/REMOVED/RENAMED + requirement/scenarios），散文解析 specs/*.md 仅为降级回退。

#### Scenario: 结构化操作分类替代散文分类
- **WHEN** spec-archive 执行 delta spec 同步
- **THEN** SHALL 读取 change.json 的 specs 段 → 遍历 `specs[].operations[]` → 按 type 应用至主 spec：
  - ADDED → 主 spec 追加需求/场景
  - MODIFIED → 主 spec 原位替换
  - REMOVED → 主 spec 删除（reason/migration 可供归档摘要引用）
  - RENAMED → 主 spec 更新标识与交叉引用
- **AND** change.json 缺失时 SHALL 降级解析 delta spec MD（WARN）
- **AND** bulk-archive 的平行步骤 a 段 MUST 使用同一读取口径

#### Scenario: 归档需求文档对齐读 JSON
- **WHEN** 归档执行预归档需求文档增量对齐（spec-archive 步骤 4.8 / bulk-archive a.6）
- **THEN** 一~七章节重派生 SHALL 使用 change.json + tasks.json 作为来源（人工域保护不变）

### Requirement: tr-impl-debug Phase 6 SHALL 以 JSON-first 同步提案
调试技能的"同步提案"步骤 MUST 将修复同步写入 change.json 段落 + tasks.json，再重渲染 MD，MUST NOT 直接编辑 MD 制品。

#### Scenario: 同步修复内容
- **WHEN** Phase 6 汇总循环内全部修复
- **THEN** SHALL 更新 `.venus/change.json` 的 proposal 段（What Changes 追加根因与修复）与 specs 段（行为变化时）
- **AND** SHALL 更新 `tasks.json`（勾选完成 + 新增回归测试任务）
- **AND** SHALL 运行 `venus spec render <type>` 重渲染对应 MD
- **AND** 格式校验 SHALL 以 JSON 校验 + 渲染成功为准（MD 格式由渲染器保证）

### Requirement: 验证与复查技能 SHALL 优先读 JSON，MD 降级
spec-verify / spec-verify-proposal / tr-impl-review-proposal MUST 优先从 change.json + tasks.json 读取结构化数据进行校验与评分，MD 降级回退。

#### Scenario: spec-verify 结构化对比
- **WHEN** 实现完成后的完整性验证
- **THEN** SHALL 读 change.json 的 specs 段（需求/场景清单）+ tasks.json（任务状态）做逐需求覆盖对比
- **AND** JSON 缺失时降级 MD 解析（WARN）

#### Scenario: 复查技能的读取与修复
- **WHEN** tr-impl-review-proposal 执行深度复查与缺漏修复
- **THEN** 读取 SHALL 优先 change.json（proposal/design/specs 段）
- **AND** 修复缺漏时 SHALL 更新 change.json 段落并重渲染（而非直接改 MD）
- **AND** spec-verify-proposal 的 D1-D10 评分证据 SHOULD 优先取自 JSON 结构化数据

### Requirement: spec-apply SHALL 优先从 change.json 读取实现上下文
spec-apply MUST 在读取实现上下文（规格/设计/提案）时优先读 change.json 段落；tasks.json 的进度管线（读 status → 完成后更新 → render）保持不变。

#### Scenario: 上下文读取顺序
- **WHEN** spec-apply 加载实现上下文
- **THEN** SHALL 优先读 `.venus/change.json` 的 specs/design/proposal 段
- **AND** change.json 缺失时降级读 MD（WARN）
- **AND** tasks.json 状态读取与 `venus spec render tasks` 更新链路 MUST 保持不变