### 3.1 自动执行验证（无用户询问）

**⚠️ 验证现为自动执行——不再出现用户选择询问**

全部制品在 Phase 2.5 生成并校验后，系统 MUST 不询问用户直接自动进入 Phase 3 验证：

1. **跳过按方式区分的提示** — 不展示 "Propose 方式一步生成，建议运行验证" 或 "已通过逐步迭代创建，验证可选"
2. **跳过用户选择** — 不询问 [立即验证] / [跳过验证]
3. **直接执行** — 进入 3.2 验证执行

### 3.2 验证执行（主 agent 内联，单轮）

**执行方式（强制）**：本阶段由**主 agent 内联**执行，**一次**完成下列合并清单，返回 `executionMode=inline` / `independence=self`；MUST NOT 派生 `iagent-spec-verify-proposal` / `iagent-proposal-review` 验证子代理（兼容窗内旧 `subagent` 回执记 deprecation WARN）。

**固定清单（D1-D10 核心维度 + B1-B7 边界）**：

1. **D1: 需求覆盖** — Decisions → 规格需求
2. **D2: 技术一致性** — 技术选型 → `design.md`
3. **D3: 任务完整性** — 规格需求 → 任务
4. **D4: 边界覆盖** — 问题 / 边界场景 → 规格 Scenario
5. **D5: Pending 解决** — Pending 事项 → 已解决
6. **D6-D10: 条件维度** — 交互细节 / API 契约 / 数据库映射 / 业务步骤 / 流程图节点覆盖，未触发不计分
7. **B1-B7 边界清单**：B1 自写制品自证（`independence=self` + WARN，结论必须带 `文件:行`）／B2 FAIL 同上下文修复（禁止新开代理 / 全量重读，≤3）／B3 归档内联失败沿用非阻断语义／B4 debug fix 内联共用预算 ≤3／B5 migration 上下文超限降级子代理 + WARN／B6 spec-bulk-archive 保留并行子代理（≤3）／B7 无 `delegate` 宿主仅阻断 propose/apply

**证据契约（强制）**：每条结论 MUST 带 `文件:行` 或制品章节锚点；**无证据的结论 MUST NOT 计入通过**（标为「缺证据」）。报告 MUST 落盘 `.openspec-tmp/pipeline-<change-name>/verify-report.md`；回执记 `executionMode=inline` / `independence=self` / `readScope`。

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
- ≥90%：质量达标，可进入实现（PASS——按 3.5 收束进入实现 + 测试桥）
- <90%：实现前需修订（FAIL——按 3.6 自动修复）

### 3.4 技术栈检测

从 `openspec/config.yaml` 的 context 字段检测技术栈：

```bash
# Read config.yaml and parse context field
# Match keywords: TypeScript, Java/JSP, Python, Go, Rust
```

检测到技术栈时：**直接执行技术栈专项校验**（不再询问），并在验证报告中说明已校验的项目。
> 例：检测到 [TypeScript] → 直接应用 TypeScript 专项规则，报告「技术栈专项校验：已执行（TypeScript）」

### 3.5 验证通过 → 收束并进入 Phase 3.7 交付桥

当全部清单项 PASS（≥90%，含 B1-B7 边界清单）时：

1. **深度复查已并入同一轮** — B1-B7 边界清单与 D1-D10 在**同一次内联验证**中完成，MUST NOT 另起 `iagent-proposal-review` 子代理，也不存在第二次独立复查轮次
2. 深度复查结论作为验证报告的一部分展示（每条结论附 `文件:行` 或章节锚点）
3. **报告落盘** — 验证报告写入 `.openspec-tmp/pipeline-<change-name>/verify-report.md`，回执记 `executionMode=inline` / `independence=self` / `readScope`
4. **无证据不计分** — 缺少证据的结论标为「缺证据」且 MUST NOT 计入通过；整体不得据此判定 PASS

5. **收束 —— 进入实现 + 测试桥前置** — 验证 PASS 后本阶段**不停顿**：把「提案摘要 + 验证评分与证据摘要 + 深度复查清单结论」交给 Phase 3.7 的实现 + 测试桥。需求文档桥已整体移除，MUST NOT 展示文档选项、MUST NOT 委派需求文档技能；验证 FAIL、重验循环中或证据不完整时 MUST NOT 进入实现桥。
   - 验证阶段由主 agent 内联执行；回执含 `score` / `reviewSummary` / 可选 `reportPath`
   - **自动修复后重建包**：若验证阶段自动修复改动制品，MUST 在验证通过后按新 `sourceFingerprint` 重建 handoff 包一次；重建失败 → `incomplete`，MUST NOT 进入 Phase 4

### 3.6 验证失败 → 同上下文自动修复并重跑

**FAIL 时不进入实现桥。** 仅在修复后经重新验证通过时才进入 Phase 3.7 实现 + 测试桥。

任一清单项 FAIL（<90%）时，系统 MUST 在**同一主上下文**内自动修复：

1. **自动生成修复建议**：
   - 对每个 FAIL 项生成具体修复项（缺失场景、未完成小节）
   - 示例：D4 缺失边界场景 → 在 specs 中补充 Scenario

2. 用 Edit 工具把修复**应用到制品文件**

3. 修复应用后**按 `fixDiff` 只重跑受影响清单项**（MUST NOT 重读未改动制品或从头全量重读，MUST NOT 新开验证代理）；循环上限 3 次

4. **展示修复摘要**：
   ```
   ## Auto-Fix Applied
   - D4: Added 2 boundary scenarios to specs/auth/spec.md
   - D1: Added 1 requirement scenario to specs

   Re-running affected checks in the same context...
   ```

5. **重跑通过**：进入 3.5（收束并进入实现 + 测试桥）
6. **重跑仍失败或循环超限**：暂停并展示剩余问题与证据缺口（无跳过直接 apply 的路径）：
   > [1] 手动编辑 — 自行修复制品
   > [2] 返回探索 — 补充缺失决策
   > [3] 查看详细差异报告

---
