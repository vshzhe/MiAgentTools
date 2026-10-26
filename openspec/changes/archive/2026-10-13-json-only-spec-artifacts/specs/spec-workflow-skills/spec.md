# Spec Delta

## MODIFIED Requirements

### Requirement: spec-propose 模板 SHALL 按合并 JSON 主产物生成提案
spec-propose.ts 模板 MUST 将 JSON Sidecar Generation 段重写为合并文件流程：逐段写 `.iagent/change.json`（proposal → specs → design）→ 写 `tasks.json` → **仅运行** `iagent spec render tasks` 渲染 tasks.md。MUST NOT 运行 `iagent spec render proposal` / `specs` / `design`，MUST NOT 手写 proposal.md / design.md / specs/*.md（新变更无 MD 生成路径、无 MD 降级）。MUST NOT 再引用 `iagent spec sidecar manifest`。

#### Scenario: 按依赖序累积写入三段
- **WHEN** AI 生成变更制品
- **THEN** SHALL 依次：写 change.json 的 proposal 段 → 追加 specs 段 → 追加 design 段 → 写 tasks.json → 运行 `iagent spec render tasks`
- **AND** 每次整文件 Write MUST 保留已有段落
- **AND** MUST NOT 产出 proposal.md / design.md / specs/*.md

#### Scenario: 移除旧命令引用
- **WHEN** 检查 spec-propose.ts 正文
- **THEN** MUST NOT 含 `iagent spec sidecar manifest` 或 `iagent spec tasks render` 引用
- **AND** MUST NOT 指示 `iagent spec render proposal|specs|design` 或手写对应 MD
- **AND** 渲染失败时 MUST NOT 降级手写 proposal/design/specs MD（tasks.md 手写降级不受影响）
- **AND** SHOULD 引用 `openspec/rules/artifact-generation.md` 作为生成协议单一源

### Requirement: 验证与复查技能 SHALL 优先读 JSON，MD 降级
spec-verify / spec-verify-proposal / proposal-review MUST 从 change.json + tasks.json 读取结构化数据进行校验与评分。MD 降级 MUST 仅用于**存量 / 已归档变更**（其无 change.json 时）并记 WARN；对存在 change.json 的变更 MUST NOT 读或写 proposal.md / design.md / specs/*.md。

#### Scenario: spec-verify 结构化对比
- **WHEN** 实现完成后的完整性验证
- **THEN** SHALL 读 change.json 的 specs 段（需求/场景清单）+ tasks.json（任务状态）做逐需求覆盖对比
- **AND** 变更无 change.json（存量 / 已归档）时降级 MD 解析并记 WARN

#### Scenario: 复查技能的读取与修复
- **WHEN** proposal-review 执行深度复查与缺漏修复
- **THEN** 读取 SHALL 从 change.json（proposal/design/specs 段）
- **AND** 修复缺漏时 SHALL 更新 change.json 段落，MUST NOT 重渲染或直接编辑 proposal.md / design.md / specs/*.md
- **AND** spec-verify-proposal 的 D1-D10 评分证据 SHALL 取自 JSON 结构化数据
