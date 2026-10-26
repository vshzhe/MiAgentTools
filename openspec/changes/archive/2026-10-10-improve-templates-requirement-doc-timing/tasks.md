# Tasks: improve-templates-requirement-doc-timing

## 1. 核心模板修改 —— 全自动工作流

- [ ] 1.1 [代码] 修改 tr-impl-auto-workflow.ts Skill 模板：Phase 3.3 PASS 分支改为生成需求文档
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 变更点：
    - `getTrImplAutoWorkflowSkillTemplate()` L523：将"do NOT generate the requirement document"改为生成
    - L586-587：Phase 5 描述中 requirement document generation 改为 alignment
    - L625：Guardrails converge 规则更新
    - `allowedTools` skillDelegation 增加 `'tr_docs_requirement_doc'`
  - 验证：`pnpm build` 通过

- [ ] 1.2 [代码] 修改 tr-impl-auto-workflow.ts Command 模板：同步更新 Phase 3/5 描述
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 变更点：
    - `getTrImplAutoWorkflowCommandTemplate()` L684-687：Phase 3 command 版更新
    - L692-694：Phase 5 command 版更新
    - L700：Guardrails command 版更新
  - 验证：`pnpm build` 通过

## 2. 核心模板修改 —— 引导式工作流

- [ ] 2.1 [代码] 修改 tr-impl-workflow.ts Skill 模板：Phase 3.5 step 5 改为生成需求文档
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`
  - 变更点：
    - `getTrImplWorkflowSkillTemplate()` L1380-1382：改为生成需求文档
    - L2197：Guardrails converge 规则更新
    - `allowedTools` skillDelegation 增加 `'tr_docs_requirement_doc'`
  - 验证：`pnpm build` 通过

- [ ] 2.2 [代码] 修改 tr-impl-workflow.ts Command 模板：同步更新描述
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`
  - 变更点：
    - `getTrImplWorkflowCommandTemplate()` L1619：description 更新
    - Command content 中 Phase 3/Guardrails 同步更新
  - 验证：`pnpm build` 通过

## 3. 核心模板修改 —— 全流程编排器

- [ ] 3.1 [代码] 修改 tr-impl-genfull.ts Skill 模板：Stage 2.3 收束改为生成需求文档
  - 文件：`src/core/templates/workflows/tr-impl-genfull.ts`
  - 变更点：
    - `getTrImplGenfullSkillTemplate()` L200-203：改为生成需求文档
    - L281：Stage 4 描述从"需求文档生成"改为"需求文档对齐"
    - L320：Guardrails converge 规则更新
    - `allowedTools` skillDelegation 增加 `'tr_docs_requirement_doc'`
  - 验证：`pnpm build` 通过

- [ ] 3.2 [代码] 修改 tr-impl-genfull.ts Command 模板：同步更新描述
  - 文件：`src/core/templates/workflows/tr-impl-genfull.ts`
  - 变更点：
    - `getTrImplGenfullCommandTemplate()` L346：description 更新
    - L386：Stage 2 command 版更新
    - L402：Stage 4 command 版更新
    - L408：Guardrails command 版更新
  - 验证：`pnpm build` 通过

## 4. 核心模板修改 —— 归档

- [ ] 4.1 [代码] 修改 spec-archive.ts：Step 4.8 rationale 更新
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 变更点：
    - L158-174：step 4.8 rationale 文本更新，反映需求文档在验证阶段已生成
    - Branch A/B 行为保持（已存在对齐 / 不存在生成后向兼容）
    - L352：Guardrails 中需求文档规则文本更新
    - L303：Output 中 Requirement Document 状态描述更新
  - 验证：`pnpm build` 通过

## 5. 同步修改 —— 批量归档

- [ ] 5.1 [代码] 修改 spec-bulk-archive.ts：b.5 段需求文档引用更新
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 变更点：
    - L210 附近：需求文档迁移段落的引用文本更新
  - 验证：`pnpm build` 通过

## 6. 同步修改 —— 需求文档技能

- [ ] 6.1 [代码] 修改 tr-docs-requirement-doc.ts：Caller note 扩展自动调用方
  - 文件：`src/core/templates/workflows/tr-docs-requirement-doc.ts`
  - 变更点：
    - `getTrDocsRequirementDocSkillTemplate()` L44：Caller note 增加验证阶段为合法自动调用方
    - Command template L398：同步更新 Caller note
  - 验证：`pnpm build` 通过

## 7. 同步修改 —— 调试工作流

- [ ] 7.1 [代码] 修改 tr-impl-debug.ts：归档 step 4.8 引用文本更新
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 变更点：
    - L495-499：Phase 7 归档引用文本更新
    - L568：Guardrails 引用文本更新
    - L689：Command 版引用文本更新
    - L703：Guardrails command 版更新
  - 验证：`pnpm build` 通过

## 8. 同步修改 —— 自动迁移

- [ ] 8.1 [代码] 检查并更新 tr-impl-auto-migration.ts 中归档需求文档引用
  - 文件：`src/core/templates/workflows/tr-impl-auto-migration.ts`
  - 变更点：搜索并更新"归档阶段生成需求文档"类引用文本
  - 验证：`pnpm build` 通过

## 9. 构建与测试验证

- [ ] 9.1 [测试][单元][P0] 运行 pnpm build && pnpm generate:skills
  - 文件：构建产物 `dist/` 与 `skills/` 快照
  - 验证：构建成功，快照生成无错误

- [ ] 9.2 [测试][单元][P0] 运行 pnpm test 全量测试
  - 文件：`test/` 目录
  - 验证：71 个测试用例全部通过（尤其 skills-parity.test.ts 和 allowed-tools.test.ts）

## 10. 版本号与变更日志

- [ ] 10.1 [代码] 更新 package.json version（minor 递增）
  - 文件：`package.json`
  - 验证：`node -e "console.log(require('./package.json').version)"` 输出新版本号

- [ ] 10.2 [代码] 更新 CHANGELOG.md 归档 [Unreleased] 条目
  - 文件：`CHANGELOG.md`
  - 验证：确认 `## [新版本] - 2026-10-10` 小节存在，链接引用定义更新
