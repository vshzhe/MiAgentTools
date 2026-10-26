## MODIFIED Requirements

### Requirement: 提案结构化数据 SHALL 合并为单一主产物 `.venus/change.json`
提案的 proposal / design / specs 三段结构化内容 MUST 合并存储于单一文件 `.venus/change.json`（schema `venus/change/v1`），由代码从该文件确定性渲染对应 MD。tasks.json MUST 保持独立（变更目录根，不并入合并文件）。

#### Scenario: proposal 段驱动 proposal.md 渲染
- **WHEN** spec-propose 生成提案
- **THEN** AI SHALL 写入 `.venus/change.json` 的 `proposal` 段（why / whatChanges / capabilities.new+modified / impact.files+breaking+compatibility）
- **AND** SHALL 运行 `venus spec render proposal --change <name>` 从该段渲染 proposal.md
- **AND** change.json 校验失败时渲染命令 SHALL 报错字段名+原因并退出码非零，MUST NOT 产出损坏的 MD

#### Scenario: specs 段驱动 specs/*.md 渲染
- **WHEN** specs 内容就绪
- **THEN** AI SHALL 更新 `.venus/change.json` 的 `specs` 段（数组，每项含 name / path / operations）
- **AND** operations SHALL 支持四种类型：ADDED / MODIFIED（含 description）/ REMOVED（含 reason + migration）/ RENAMED（含 from + to）
- **AND** `venus spec render specs` SHALL 按 `specs[].path` 拆分为多个 `specs/<name>/spec.md` 文件

#### Scenario: design 段驱动 design.md 渲染
- **WHEN** design 内容就绪
- **THEN** AI SHALL 更新 `.venus/change.json` 的 `design` 段（context / goals / nonGoals / decisions / risks）
- **AND** `venus spec render design` SHALL 渲染 design.md

#### Scenario: 段落可缺省但渲染时报错引导
- **WHEN** `venus spec render design` 执行但 change.json 无 design 段
- **THEN** 命令 SHALL 报错提示 "design 段不存在，请先写入 change.json 的 design 段"
- **AND** MUST NOT 静默产出空 MD

### Requirement: change.json 写入 MUST 累积保留已有段落
AI 逐段累积写入 change.json（整文件 Write）时 MUST 保留已有段落，MUST NOT 丢弃先前写入的段。CLI 提供 `venus spec sidecar init --change <name>` 生成含根字段（changeName/createdAt/updatedAt/phase）的空骨架。

#### Scenario: 三段累积写入
- **WHEN** proposal 段已写入，AI 继续写入 specs 段
- **THEN** 生成的 change.json MUST 同时包含 proposal 段与 specs 段
- **AND** 根字段 MUST 保留（changeName 不变）
- **AND** `updatedAt` SHOULD 更新为写入时间

#### Scenario: sidecar init 生成骨架
- **WHEN** 运行 `venus spec sidecar init --change <name>`
- **THEN** SHALL 创建 `.venus/change.json`，含 `$schema: "venus/change/v1"` 与根字段，proposal/design/specs 段全部缺省
- **AND** 文件已存在时 MUST NOT 覆盖（幂等）

### Requirement: 旧 JSON Sidecar 文件 SHALL 保留可读，读方按降级链回退
存量变更的 manifest.json / decisions.json / capabilities.json MUST NOT 被删除或修改。消费方读取链 SHALL 为：`.venus/change.json` 对应段 → 旧 JSON 文件（manifest/decisions/capabilities）→ MD 散文解析，逐级 WARN。

#### Scenario: 新提案不再产出旧 3 文件
- **WHEN** spec-propose 创建新提案
- **THEN** SHALL 产出 `.venus/change.json` + `tasks.json`
- **AND** MUST NOT 产出 manifest.json / decisions.json / capabilities.json
- **AND** 旧文件缺席 MUST NOT 产生 WARN

#### Scenario: 存量变更的旧 JSON 降级读取
- **WHEN** 消费方读取含旧 3 文件但无 change.json 的存量变更
- **THEN** SHALL 降级读取旧 JSON（WARN 提示 "change.json 缺失，降级读取旧 sidecar"）
- **AND** 旧 JSON 也缺失时降级解析 MD（WARN）

### Requirement: validateSidecar SHALL 支持合并 schema，旧类型保持校验
sidecar-writer.ts 的 validateSidecar MUST 新增 'change' 类型（校验根字段 changeName 必填、phase 合法、proposal/design/specs 段落结构合法），并保持 manifest/tasks/decisions/capabilities 四旧类型可校验（供降级读取使用）。

#### Scenario: change 校验定位到段落级错误
- **WHEN** change.json 的 proposal.whatChanges 非数组
- **THEN** validateSidecar('change', data) SHALL 返回 `{ valid: false, errors: ['proposal.whatChanges 必须为数组'] }`
- **AND** 错误信息 MUST 含具体路径（段落.字段）

### Requirement: render*Md SHALL 确定性渲染，同段输入 MUST 产出同 MD
三个新 render 函数（renderProposalMd / renderDesignMd / renderSpecsMd）MUST 为纯函数——相同段落 JSON 输入 → 相同 MD 输出，无时间戳注入、无随机性。

#### Scenario: renderProposalMd 幂等
- **WHEN** 两次以同样 proposal 段调用 renderProposalMd
- **THEN** 两次产出的 proposal.md 内容 MUST 完全一致
- **AND** 渲染的 MD MUST 含 Why / What Changes / Capabilities / Impact 四段标题

#### Scenario: renderSpecsMd 多文件拆分
- **WHEN** specs 段含 2 个 capability
- **THEN** SHALL 产出 2 个文件内容（按 `specs[].path`），每个按 operation type 分组渲染（ADDED/MODIFIED/REMOVED/RENAMED 标题）
- **AND** REMOVED 操作 MUST 渲染 Reason 与 Migration；RENAMED MUST 渲染 FROM:/TO:

#### Scenario: renderDesignMd 渲染四段
- **WHEN** design 段含 context/goals/nonGoals/decisions/risks
- **THEN** SHALL 渲染 Context / Goals-NonGoals / Decisions / Risks-Trade-offs 四段
- **AND** decisions 每条渲染 选择/理由/备选 三要素