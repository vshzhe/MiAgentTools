# migration-skills 增量规格

## MODIFIED Requirements

### Requirement: migration 规范要点写入上下文包

`iagent_migration` 的 Phase 3（实现阶段）SHALL 将目标项目规范要点**写入变更级 handoff 包**（`.openspec-tmp/pipeline-<change-name>/handoff-pack.md`）的 `## 规范要点` 节（作为附加来源与**项目侧** `.iagent/rules/coding-rules.md` 的要点合并——该文件是 `openspec/rules/ai-coding.md` 经 `iagent init` 蒸馏后的项目规则；目标项目缺该文件时退回源仓要点或记录的 WARN），MUST NOT 再为每个子代理的调度指令内联注入一份规范要点文本。

目标项目规范要点仍为**BINDING 约束**（来源为 `exploration.md` 的 `## 目标项目规范要点` 节，由 Phase 2 从目标项目的 CLAUDE.md / AGENTS.md / openspec 主规格蒸馏），但载体由「每单元重复内联」改为「包内单点写入」，消除同类重复内联。包内 `## 文件归属表`、`## 契约`、`## Codebase 摘要` 与 `## 已产出` 四节按同一协议（见 `spec-workflow-skills / spec-apply 派发协议与共享资源协议`）供子代理只读消费；阶段收束时 SHALL 向包追加 `## 阶段结论`。

**降级**：handoff 包不可用（工作区不可写 / 包产出失败）时，技能 SHALL 退化为既有内联注入行为并记 WARN，MUST NOT 阻断迁移实现。

#### Scenario: 规范要点写入包的规范要点节

- **WHEN** Phase 3 进入实现阶段并确保 handoff 包存在
- **THEN** 技能把 `exploration.md` 的 `## 目标项目规范要点` 内容与项目侧 `.iagent/rules/coding-rules.md` 要点合并写入包的 `## 规范要点` 节，子代理通过读包获得 BINDING 约束

#### Scenario: 不再内联注入规范要点

- **WHEN** 技能为某派发单元构造调度指令
- **THEN** 指令 MUST NOT 内联目标项目规范要点全文，改为引用 handoff 包的 `## 规范要点` 节

#### Scenario: 包路径与协议与其他技能一致

- **WHEN** migration 创建或复用 handoff 包
- **THEN** 路径为 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md`，六节结构与 `spec-apply` 协议一致，MUST NOT 另立包格式或第二份协议

#### Scenario: 包不可用时退化为内联注入

- **WHEN** handoff 包不可用（工作区不可写或包产出失败）
- **THEN** 技能退化为既有行为（每子代理指令内联注入规范要点）并记 WARN，迁移实现 MUST NOT 被阻断

#### Scenario: 规范要点缺失时不阻断

- **WHEN** 目标项目无规范文件且 Phase 2 未能蒸馏出要点
- **THEN** 包 `## 规范要点` 节记「无目标项目规范要点」，迁移流程照常继续并记 WARN
