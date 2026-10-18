### 3.1 自动执行验证（无用户询问）

**⚠️ 验证现为自动执行——不再出现用户选择询问**

全部制品在 Phase 2.5 生成并校验后，系统 MUST 不询问用户直接自动进入 Phase 3 验证：

1. **跳过按方式区分的提示** — 不展示 "Propose 方式一步生成，建议运行验证" 或 "已通过逐步迭代创建，验证可选"
2. **跳过用户选择** — 不询问 [立即验证] / [跳过验证]
3. **直接执行** — 进入 3.2 验证执行

### 3.2 验证执行

通过**调用 `iagent_spec_verify_proposal` 技能**执行 D1-D5 核心验证（而不是 CLI 指令）：

```bash
# Resolve change status first
iagent spec status --change "<name>" --json
# Then invoke the verification skill (iagent_spec_verify_proposal is a SKILL name, not a valid
# `iagent spec instructions` artifact ID — valid artifact IDs are proposal/specs/design/tasks only.
# Running `iagent spec instructions iagent_spec_verify_proposal` errors with "Artifact not found".)
```

调用技能：为变更 `<name>` 调用 `iagent_spec_verify_proposal`。该技能通过读取制品与 exploration.md 内联完成 D1-D5 评分，不依赖任何 CLI verify 命令（并不存在——iagent CLI 只有做 schema 级检查的 `validate`）。

**降级（回退）（技能不可用）**：若 `iagent_spec_verify_proposal` 技能未安装或调用失败，降级为 AI 内联读取 proposal/specs/design/tasks + D1-D5 手工评分，并输出 WARN 日志："iagent_spec_verify_proposal 技能不可用，已降级为内联评分"。MUST NOT 静默跳过验证。

执行 5 维度验证：
1. **D1: 需求覆盖** — Decisions → 规格需求
2. **D2: 技术一致性** — 技术选型 → `design.md`
3. **D3: 任务完整性** — 规格需求 → 任务
4. **D4: 边界覆盖** — 问题 / 边界场景 → 规格 Scenario
5. **D5: Pending 解决** — Pending 事项 → 已解决
6. **D6-D10: 条件维度** — 交互细节（Interaction Detail）/ API 契约（API Contract）/ 数据库映射（DB Mapping）/ 业务步骤（Business Steps）/ 流程图节点覆盖，由 `iagent_spec_verify_proposal` 按变更类型自动触发；未触发维度不计分

### 3.3 量化评分报告

展示带评分的验证结果：

```
## Verification Report

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 85% | PASS |
| D2: Technical | 90% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 70% | FAIL |
| D5: Pending | 100% | PASS |
| D6-D10: 条件维度 | N/A | SKIP（无触发） |

**Overall Score**: 89%
```

评分口径（统一 90% 阈值——此前的 70%/90% 双档已移除）：
- ≥90%：质量达标，可进入实现（PASS——按 3.5 自动触发深度复查）
- <90%：实现前需修订（FAIL——按 3.6 自动修复）

### 3.4 技术栈检测

从 `openspec/config.yaml` 的 context 字段检测技术栈：

```bash
# Read config.yaml and parse context field
# Match keywords: TypeScript, Java/JSP, Python, Go, Rust
```

检测到技术栈时：
> "检测到技术栈：[TypeScript]。是否运行技术栈专项校验？"
> [是] [否 - 仅基础校验]

### 3.5 验证通过 → 自动触发深度复查 → 自动生成需求文档

当所有维度 PASS（≥90%）时：

1. **自动执行深度复查** — 调用 `iagent_proposal_review` **技能**——不询问用户，自动执行（用户可中断跳过）
2. 深度复查范围：代码库深度探索 + 多维完整性
3. 结果与验证报告一并展示
4. **降级（回退）（技能不可用或调用失败）**：降级为主工作流内联只读深度复查 + WARN 日志——永不静默跳过

> "验证通过！D1-D5 全部 ≥90%。自动运行 iagent_proposal_review..."
> [展示深度复查结果]

若用户想跳过深度复查，可主动中断；否则自动运行。

5. **收束——生成需求文档** — 深度复查收束后，以非交互模式委派 `iagent_requirement_doc`，在 `openspec/changes/<change-name>/需求文档.md` 生成需求文档。该文档在实现开始前由**当前**制品（proposal/specs/design/tasks）生成——用户可在 apply 阶段评审它。生成失败不阻断（WARN 日志 + 继续）。MUST NOT 向用户询问文档基本信息。生成后进入 Phase 3.7 实现桥（不得停在 apply-ready）。
   - 理由：在验证阶段生成文档，可使用户在实现开始前拿到可评审的文档；归档阶段对既有文档就地增量对齐

> "深度复查完成。"
> "需求文档：已生成于 openspec/changes/<name>/需求文档.md。"

### 3.6 验证失败 → 自动修复并重跑

**FAIL 时不生成需求文档。** 仅在修复后经重新验证通过时才生成（此时走 3.5 第 5 步）。

任一维度 FAIL（<90%）时，系统 MUST 自动修复：

1. **自动生成修复建议**：
   - 对每个 FAIL 维度生成具体修复项（缺失场景、未完成小节）
   - 示例：D4 缺失边界场景 → 在 specs 中补充 Scenario

2. 用 Edit 工具把修复**应用到制品文件**

3. 修复应用后**自动重跑验证**

4. **展示修复摘要**：
   ```
   ## Auto-Fix Applied
   - D4: Added 2 boundary scenarios to specs/auth/spec.md
   - D1: Added 1 requirement scenario to specs

   Re-running verification...
   ```

5. **重跑通过**：进入 3.5（自动触发深度复查）
6. **重跑仍失败**：展示剩余问题并给出选项（无跳过直接 apply 的路径）：
   > [1] 手动编辑 — 自行修复制品
   > [2] 返回探索 — 补充缺失决策
   > [3] 查看详细差异报告

---
