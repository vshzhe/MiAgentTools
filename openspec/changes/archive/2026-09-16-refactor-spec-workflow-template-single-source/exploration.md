# 探索记录：OpenSpec v1.1.20 四大工作流对比（explore / propose / apply / archive）

> 探索日期：2026-09-14 · 触发：`/venus:spec-explore` · 状态：决策已确认，待创建变更提案

## 背景与目的

对比 `E:\github\OpenSpec_v1120`（OpenSpec v1.1.20 原版）与本项目（VenusAgentTools，功能迁移自 OpenSpec）
的 explore / propose / apply / archive 四个工作流模板，识别迁移遗漏与优化点。

## Codebase Findings（代码库发现）

- **规模**：Venus 模板共 3034 行 vs 原版 1192 行（约 2.5 倍），迁移时做了大量有意的增强
  （验证门、并发调度、编译检查、CodeGraph 同步、探索记忆闭环、命名规范、ARCHIVE-INDEX）。
- **双模板注册机制**：`src/core/templates/registry.ts:116-119` 中每个 spec 工作流成对注册
  skill 模板（`getSpecXxxSkillTemplate().instructions`）与 command 模板
  （`getSpecXxxCommandTemplate().content`），两份 90% 相同的 markdown 字符串手工双写。
- **实测漂移证据（4 处）**：
  1. explore：skill 版 Visualize 示例图表损坏（`spec-explore.ts:90` 右边框错位），command 版完好；
  2. propose：skill 版 Guardrails 含 "display a design blueprint summary and wait for user
     confirmation"，command 版缺失（防护缺口）；
  3. propose：skill 版 Step 0 子编号 0-6 与主步骤 1-6 混排，command 版编号稍好；
  4. archive：执行顺序 4.7 → 5 → 6 → 7 → 6.5 → 8，步骤 6.5 排在 7 之后（编号错序）。
- **CLI 能力差异**：原版有 `openspec instructions apply --change <name> --json`
  （返回 contextFiles / progress / 动态 instruction / context / operationGuidance 注入）、
  `skip_specs`（skipped 状态）、`--schema` 多工作流选择；Venus CLI 均无，apply 模板已改为直接读变更目录文件绕过。

## Analysis（差异分析）

### P0 安全性/正确性

1. **archive sync 失败不阻断**：Venus 在主规格 AI merge 失败时仅 WARN 并继续归档，无事后验证；
   原版要求逐 capability 复核 ADDED/MODIFIED/REMOVED/RENAMED 全部落盘，不匹配即停止（changeRoot 完好可重试）。
2. **archive 零确认**：不完整 artifacts/tasks 不提示确认直接归档；原版要求确认。
3. **apply 缺 scope-creep 防护**：无 "never silently narrow, defer, or simplify away specified
   behavior" 与 "Only mark `- [x]` when fully implemented, not partially done or deferred" 判定标准。
4. **propose 缺 Planning Boundary**：无"用户请求授权的是规划，即使要求实现也须停止等待新请求"的边界声明。

### P1 原版方法论未同步

- explore 写入确认门（首次写操作前 yes/no 确认、范围限定、"回答设计问题 ≠ 同意写入"）；
- explore 提问方法论（依赖序提问、一次一个焦点、有据推荐 + 替代方案）；
- propose 起草前代码库检查（区分观察行为 vs 假设、与现有 spec 冲突表面化）；
- propose 依赖文件 re-read from disk（用户可能已编辑）；
- propose required set 传递闭包（status 仅查文件存在性，防 tasks done 而 specs 未写的早停）；
- 材料性歧义 vs 小细节假设的划分原则；
- ASCII-only 图表约束（终端渲染宽度，Venus 模板用 Unicode 框线）；
- capability 嵌套路径（原版支持 `identity/user-auth`，Venus 平铺）。

## Decisions（已确认决策，2026-09-14）

1. **P0-1 / P0-2 为刻意设计**：archive 的"零确认 + sync 失败不阻断"是为 auto-workflow
   全自动化服务的设计决策，保持现状（如后续考虑"手动调用时恢复确认门"作为独立增强另议）。
2. **P2-12 去重方案**：接受"单一 prompt 源 + 代码生成 command 压缩版"的重构，
  消除 skill/command 双模板手工双写。顺带修复 4 处漂移 + archive 编号错序。
3. **CLI 能力补充**：补充原版有而 Venus 缺失的 CLI 能力——`instructions apply`
  （contextFiles / progress / context / operationGuidance 注入）、`skip_specs` 支持、多 schema 选择。
4. **防漂移规则**：已写入 `AGENTS.md` 修改守则第 7 条（含 4 处漂移实录与双写要求），
   并更新仓库地图涵盖 `spec-*.ts`。
5. P0-3（apply 判定标准）、P0-4（planning boundary）与 P1 各项**未在本轮决策范围内**，
   可随单一源重构（决策 2）顺带回填模板正文，或另立变更。

## Questions（开放问题）

- CLI 能力补充（决策 3）的优先级与拆分：三项能力一个变更还是多个？
- 单一源重构（决策 2）中 command 压缩版的生成策略：纯截断/标记段落级裁剪/LLM 无关的模板变量替换？
- P1 方法论回填是否纳入重构范围（避免重构后又要改一遍正文）？

## 术语表

- **双模板漂移**：同一工作流的 skill instructions 与 command content 两份手工维护字符串
  产生内容不一致的现象。
- **单一 prompt 源**：模板正文只维护一份（skill 版），command 版由代码从源派生压缩生成。
