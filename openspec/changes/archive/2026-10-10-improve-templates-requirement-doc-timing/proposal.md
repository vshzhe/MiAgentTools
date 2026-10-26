## Why

当前 VenusAgentTools 的需求文档生成时机在**归档阶段**（Phase 5 / Stage 4），即在全部代码实现完成后才生成。这导致两个问题：

1. **排查时机过晚**：用户在实现阶段发现需求理解偏差时，没有一份结构化的需求文档可供对照——需求文档要到归档时才出现，此时代码早已写完
2. **文档必然过期**：归档时生成的需求文档反映的是"最终制品"，但评审者需要的是"实现前的设计意图"——提案验证通过时是产品质量最高的时刻（exploration decisions + proposal + specs + design 均已齐备且交叉验证），此后实现的代码细节不应反向污染需求文档的业务语义

**目标**：将需求文档生成时机从归档阶段提前到**提案验证通过后**，在实现开始前自动生成，便于用户在实现前/中排查问题。

## What Changes

### 核心行为变更

1. **验证阶段新增需求文档生成**（tr-impl-auto-workflow、tr-impl-workflow、tr-impl-genfull）：
   - Phase 3 / Stage 2 验证通过 + 深度复查收束后，**非交互调用 `venus_tr_docs_requirement_doc` 生成需求文档**
   - 生成失败非阻断（WARN 记录，继续进入实现阶段）

2. **归档阶段行为调整**（spec-archive、spec-bulk-archive）：
   - 需求文档**已存在** → 就地增量对齐（保留人工域：`## 基本信息` + `## 八、评审记录`）
   - 需求文档**不存在** → 仍生成（向后兼容存量变更，未经新流程的变更归档时仍需生成）
   - 更新 step 4.8 的 rationale 文本，反映新时机

3. **需求文档技能 Caller note 更新**（tr-docs-requirement-doc）：
   - 自动调用方从"仅归档阶段"扩展为"验证阶段 + 归档阶段"
   - 非交互模式行为不变

4. **同步更新引用文本**（tr-impl-debug、tr-impl-auto-migration）：
   - 这些模板引用归档 step 4.8 的文本描述，需同步更新以反映新时机

### 不变项

- `venus_tr_docs_requirement_doc` 技能本身的生成逻辑不变
- 需求文档输出路径不变（`openspec/changes/<name>/需求文档.md`）
- 归档阶段的 devdocs 迁移逻辑不变
- debug 工作流的需求文档禁令不变（Phase 7 仍不生成）
- 独立手动调用需求文档技能的行为不变

## Capabilities

### New Capabilities

（无——本次为行为调整，不新增独立能力）

### Modified Capabilities

- `template-generation`: SKILL 模板正文中需求文档生成时机的引用点从"归档阶段"改为"验证阶段"

## Impact

### 直接影响的文件

| 文件 | 变更说明 |
|------|----------|
| `src/core/templates/workflows/tr-impl-auto-workflow.ts` | Phase 3.3 PASS 分支改为生成需求文档；Phase 5 描述改为对齐；Guardrails 更新 |
| `src/core/templates/workflows/tr-impl-workflow.ts` | Phase 3.5 step 5 改为生成需求文档；Guardrails 更新 |
| `src/core/templates/workflows/tr-impl-genfull.ts` | Stage 2.3 收束改为生成需求文档；Stage 4 描述改为对齐 |
| `src/core/templates/workflows/spec-archive.ts` | Step 4.8 rationale 更新，Branch A/B 行为保持 |
| `src/core/templates/workflows/spec-bulk-archive.ts` | b.5 段需求文档引用文本更新 |
| `src/core/templates/workflows/tr-docs-requirement-doc.ts` | Caller note 扩展自动调用方列表 |
| `src/core/templates/workflows/tr-impl-debug.ts` | 归档 step 4.8 引用文本同步更新 |
| `src/core/templates/workflows/tr-impl-auto-migration.ts` | 检查并更新类似引用 |

### 间接影响

- `skills/` 静态快照需重新生成（`pnpm generate:skills`）
- `.claude/` dogfood 产物不受影响（不入库）

### 向后兼容

- **无破坏性变更**：存量变更（旧流程创建、未经新验证阶段生成需求文档的）在归档时仍会生成需求文档（spec-archive step 4.8 Branch A 保持）
- 模板正文变更后需依次 `pnpm build && pnpm generate:skills` 保证测试通过
- 版本号按 minor 递增（功能变更）