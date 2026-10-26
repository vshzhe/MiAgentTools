## Why

对比 OpenSpec v1.1.20（源项目）与本项目迁移后的四大工作流模板（explore / propose / apply / archive）发现两类结构性问题（探索记录见 exploration.md）：

1. **skill/command 双模板手工双写已实际漂移**。`src/core/templates/workflows/spec-*.ts` 中每个工作流导出 `getSpecXxxSkillTemplate()`（instructions）与 `getSpecXxxCommandTemplate()`（content）两份 90% 相同的模板字符串，靠手工双写维护。2026-09-14 实测发现 4 处漂移：
   - explore：skill 版 Visualize 示例图表损坏（spec-explore.ts:90 右边框错位），command 版完好；
   - propose：skill 版 Guardrails 含"蓝图展示后等待用户确认"，command 版缺失（**防护语句缺口**）；
   - propose：skill 版 Step 0 子编号 0-6 与主步骤 1-6 混排；
   - archive：执行顺序 4.7 → 5 → 6 → 7 → 6.5 → 8，步骤 6.5 排在 7 之后。
2. **CLI 能力缺失迫使模板绕路**。源项目有 `openspec instructions apply`（返回 contextFiles / progress / 动态 instruction / context / operationGuidance 注入）与 `skip_specs` 机制；Venus CLI 均无，apply 模板只能改为"直接读变更目录文件"绕过，模板正文长期带着 "The venus CLI does not provide an instructions apply command" 的让步性说明。
3. **v1.1.20 的多项防护语句在迁移中丢失**（P0-3 scope-creep 防护与任务完成判定、P0-4 planning boundary、P1 各项），需要趁重构过一遍正文时统一回填到唯一源。

探索决策（2026-09-14 已确认）：接受"单一 prompt 源 + 代码派生 command 压缩版"重构；CLI 能力补充限定为 instructions apply + skip_specs 两项（**多 schema 暂不做**，`spec-workflow-cli` 既有 ADR-0001"依赖图硬编码、SHALL NOT 读外部 schema.yaml"保持有效）；两项合并为一个变更（本提案）。

## What Changes

1. **模板单一源重构**：`spec-*.ts` 每个工作流模板正文仅维护 skill instructions 一份（唯一源），command 压缩版由代码从源派生生成（派生策略在 design.md 确定），消除手工双写。
2. **消除既有 4 处漂移**：重构统一到唯一源后自然修复（explore 图表、propose 蓝图确认句、Step 0 编号、archive 步骤编号错序）。
3. **回填 v1.1.20 防护语句到唯一源**（摘自探索记录 P0-3/P0-4/P1）：
   - apply：scope-creep 防护（"禁止为让任务通过而默默缩小/推迟/简化规格行为，发现须表面化并询问"）+ 任务完成判定标准（"仅当规格行为完整实现才可勾选，部分完成或推迟不算"）；
   - propose：Planning Boundary（"触发请求授权的是规划，即使要求实现也须在 artifacts 完成后停止等待新请求"）；
   - explore：写入确认门（首次写操作前 yes/no 确认、范围限定、"回答设计问题 ≠ 同意写入"）、依赖文件 re-read from disk、材料性歧义划分（影响范围/行为/兼容性/验收的歧义必问，小细节合理假设并记录）；
   - propose：required set 传递闭包（按 requires 边构建必需集，防 applyRequires 早停）。
4. **CLI 新增 `venus spec instructions apply --change <name> --json`**：返回 contextFiles（artifact→文件路径映射）、progress、task list、动态 instruction；apply 模板正文改为优先使用该命令，删除让步性说明。
5. **CLI 支持 `skip_specs`**：变更在 `.openspec.yaml` 声明 `skip_specs` 时，status/instructions 将 specs artifact 置为 `skipped` 状态；模板按 skipped 处理（不再创建 delta spec 文件），与源项目语义对齐。
6. **AGENTS.md 修改守则第 7 条退役**：单一源落地后，该条双写约束由"长期方案已决策"改为"已落地，仅维护唯一源"。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `spec-workflow-skills`: 模板体系从 skill/command 手工双写改为单一 prompt 源派生；唯一源回填 v1.1.20 防护语句（apply 判定标准、propose planning boundary、explore 写入确认门等）；apply 模板改用 `instructions apply` 命令获取任务上下文。
- `spec-workflow-cli`: `venus spec instructions` 新增 `apply` artifact 支持（contextFiles / progress / 动态 instruction）；status 与 instructions 支持 `skip_specs` 声明的 `skipped` 状态语义。
- `spec-bulk-archive-skill`: 其模板文件（spec-bulk-archive.ts）符合 `spec-*.ts` 通配，纳入单一源派生规则（command content 改由派生函数生成）；行为需求（多选/并行归档/冲突裁决）不变。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/spec-explore.ts` / `spec-propose.ts` / `spec-apply.ts` / `spec-archive.ts` / `spec-bulk-archive.ts` / `spec-verify.ts` / `spec-verify-proposal.ts`: 重构为单一源结构（skill instructions 为唯一源，command content 改为派生）
- `src/core/templates/registry.ts`: 注册表适配单一源（CommandTemplate.content 由派生函数填充）
- `src/core/templates/types.ts`: 新增派生配置类型（段落标记 / 裁剪规则）
- `src/core/command-generation/generator.ts` 或新文件: command 压缩版派生逻辑
- `src/commands/spec.ts`: instructions apply 支持 + skip_specs 状态处理
- `test/`: 模板派生一致性测试（替代人工双写核对）、CLI 新命令测试
- `skills/`: 快照重新生成（`pnpm build && pnpm generate:skills`）
- `AGENTS.md`: 修改守则第 7 条更新为"已落地"状态

### 向后兼容

- CLI 新增子命令与 skip_specs 可选声明：既有变更（未声明 skip_specs）行为完全不变，无破坏性。
- 模板正文变化（防护语句回填 + 漂移修复）会改变生成的 SKILL.md / 指令内容——这是预期修复，`venus update` 的 generatedBy 手改保护机制不受影响。
- **[待确认]** apply 模板改用 `instructions apply` 后，目标项目可能存在"技能新版 + CLI 旧版"的组合（技能与 CLI 版本独立演进）——design.md 需确定策略：模板保留"命令失败则回退直接读文件"的兼容分支，或声明最低 CLI 版本要求。
