## Context

- **尺寸现状**（SKILL.md 行数，降序）：`workflow` 1660、`proposal_review` 832、`auto_workflow` 644、`debug` 571、`spec_verify_proposal` 557、`spec_apply` 525、`spec_bulk_archive` 455、`feature_doc` 429、`spec_explore` 404…… 合计 497 KB。
- **既有机制**：`SkillTemplate.references?: SkillReference[]`（`path` + `content`），`generator.generateSkillContent` 透传，`init.ts` 的 `writeSkillReferences` / `update.ts` 的 `syncReferences`（先 `removeDir` 再写）落盘；已有 6 个技能使用（`prompt-gate.md` / `flowchart-gate.md` / `schema-java.md` / `doc-*.md`）。
- **既有要求**：`spec-workflow-skills / SKILL 模板 references 机制启用` 规定 spec-* 将 >50 行的独立段移入 `references/`，但无预算、无测试、仅 spec-*。
- **先例**：`prompt-gate.ts` / `flowchart-gate.ts` 的 `buildXxxCompact`（~20 行内联）+ `buildXxxBlock`（全文入 `references/`）已示范"紧凑引用 + 全文下沉"模式。
- **次序约束**：B（提案委派）与 B2（探索委派）将重写 `workflow` / `auto_workflow` / `spec_explore` 正文；C 须在其后实施。

## Goals / Non-Goals

**Goals**:
- 主 SKILL.md 尺寸预算（≤ 500 行）与可测试断言；
- 全部技能遵循"控制流留主文件、参考性内容下沉 `references/`"；
- 复用既有 `references` 机制，零语义变化。

**Non-Goals**:
- **不改任何技能行为**：确认门、阶段、委派面、allowedTools 白名单、frontmatter 语义均不变。
- **不引入新机制**：不新增模板语法、不改 `SkillReference` 类型、不改生成/同步链路。
- **不重排 B/B2 负责的编排正文**：`workflow` / `auto_workflow` / `spec_explore` 的下沉以 B/B2 后的形态为准（次序 A→B→B2→C）。
- **不拆分为新技能**：仅内容分层，不新增/删除技能。

## Decisions

### D1: 预算量纲与阈值——500 行
- **选择**：主 SKILL.md 行数 ≤ 500。
- **理由**：贴近 Agent Skills 实践（~500 行上限）；与既有的"50 行段"判据同量纲（行）；避免字节受中文字符宽度干扰。
- **备选**：①按字节（20 KB）——中文技能字节/行比高，阈值不直观，弃；②按 token——需分词器依赖，不成比例，弃。

### D2: 下沉载体——既有 `references/`，不新增机制
- **选择**：`SkillTemplate.references` + 主文件 `Read references/<topic>.md` 引导；复用 `writeSkillReferences` / `syncReferences`。
- **理由**：机制已存在且经验证（prompt-gate/flowchart-gate/schema-*）；改造成本最低、风险最小。
- **备选**：①外置 `.md` 由构建合并——改构建链，弃；②多级引用——过度设计，弃。

### D3: 分层判据——控制流 vs 参考性内容
- **选择**：MUST 留主文件：触发条件、阶段骨架、确认门、委派清单、Guardrails、CLI 契约要点；MUST 下沉：评分细则与矩阵、评分示例、L1-L5 问句库、长样例/代码模板、字段级表格。
- **理由**：主文件是"看到即需执行"的控制流；参考性内容仅特定节点按需读，下沉不损可执行性。
- **备选**：无（这是渐进披露的标准划分）。

### D4: 测试断言——预算 + references 存在性 + 同步
- **选择**：测试断言 ① 每个技能主 SKILL.md 行数 ≤ 500（超限失败）；② 主文件正文引用的每个 `references/*.md` 在 `SkillTemplate.references` 中存在；③ `update` 的 references 同步无残留（既有行为回归）。
- **理由**：把预算变成回归锁，防后续新增内容重新膨胀；references 缺失会导致 AI `Read` 失败。
- **备选**：仅文档告诫（无强制力，弃）。

### D5: 语义零变化的验收
- **选择**：本变更的验收 MUST 包含"行为等价"断言——前后对照确认 allowedTools / 确认门关键词 / 阶段编号未变；`skills-parity` 快照 diff 仅允许文本位置移动（主文件缩短 + references 新增）。
- **理由**：内容分层最易被误做成"删除/改写"，需显式锁住零语义变化。
- **备选**：无（安全底线）。

## Architecture Mapping

```
主 SKILL.md（≤500 行）                      references/
─────────────────────                      ───────────
触发条件 / 阶段骨架 / 确认门 /              scoring.md（评分细则与矩阵）
委派清单 / Guardrails                       questioning.md（L1-L5 问句库）
  │                                          examples.md（长样例/模板）
  └── "在 <节点> Read references/X.md" ──────►（按需加载）
```

## Migration Plan

1. 定稿预算测试（先以当前代码运行，列出超预算技能清单作为重构目标）。
2. 逐技能拆分：`proposal_review` → `debug` → `spec_verify_proposal` → `spec_apply`（按行数降序）；每个技能把参考性内容移入 `references/`，主文件改 `Read` 引导。
3. `workflow` / `auto_workflow` / `spec_explore` 的下沉在 B/B2 落地后按其最终正文执行。
4. 行为等价断言 + `pnpm build && pnpm generate:skills`；`git diff skills/` 审查（仅位置移动）。
5. 全量 `pnpm test`；版本收尾（纯重构 → patch/minor）。

## Risks / Trade-offs

| 风险 | 缓解 |
| :--- | :--- |
| 下沉时误删控制流内容（防护语句/确认门） | D5 行为等价断言 + 关键词 diff 审查 |
| references 引用路径写错导致 AI Read 失败 | D4 引用存在性测试 |
| 与 B/B2 的正文重写冲突（返工） | 次序 A→B→B2→C；workflow/auto_workflow/spec_explore 留到 B/B2 后 |
| 预算过紧导致频繁失败 | 设 500 行为软预算并仅对超限者强制重构；测试为显式断言便于调整 |
| 主文件与 references 语义漂移 | 二者同源于 `instructions`（同一模板文件），非第二份真源；无独立维护 |

## Open Questions

- **[待确认]** 临界技能 `spec_bulk_archive`（455 行）是否纳入本轮——默认不纳入（未超预算）。
- **[待确认]** 预算是否随 B/B2 后 `workflow` 的实际尺寸下调（如 400 行）——默认固定 500，避免过早收紧。
