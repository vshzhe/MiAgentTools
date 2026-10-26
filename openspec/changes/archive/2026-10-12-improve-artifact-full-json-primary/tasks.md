# Tasks: improve-artifact-full-json-primary

## 1. Schema 与写入器

- [x] [代码] 1.1 新增合并 ChangeSchema 到 sidecar-schema.ts [N6]
  - ChangeSchema 根字段: $schema(venus/change/v1) / changeName / createdAt / updatedAt / phase
  - ProposalSection: why / whatChanges / capabilities(new+modified) / impact(files+breaking+compatibility)
  - DesignSection: context / goals / nonGoals / decisions(复用 DecisionEntry) / risks
  - SpecsSection: specs[{ name, path, operations[{ type, requirement, description, scenarios, reason?, migration?, from?, to? }] }]
  - createEmptyChange(changeName) 工厂（三段缺省）
  - 旧 ManifestSchema / DecisionsSchema / CapabilitiesSchema 标 @deprecated（保留供降级读取）
  - TasksSchema / TaskEntry 保持不变
  - 对应: specs/artifact-json-sidecar/spec.md
  - 产出文件: `src/core/spec/sidecar-schema.ts`

- [x] [代码] 1.2 新增 change.json 读写函数到 sidecar-writer.ts [N6]
  - readChangeJson(changeDir): ChangeSchema | null（文件缺失返回 null）
  - writeChangeJson(changeDir, data): ChangeSchema（validate → 写入 .venus/change.json → 返回）
  - initChangeJson(changeDir, changeName): ChangeSchema（骨架 + 幂等不覆盖）
  - validateSidecar('change') 扩展：根字段 + 三段结构校验，错误信息含具体路径（如 proposal.whatChanges 必须为数组）
  - 保留旧 4 类型校验（降级读取用）
  - 依赖: 1.1
  - 对应: specs/artifact-json-sidecar/spec.md
  - 产出文件: `src/core/spec/sidecar-writer.ts`

- [x] [代码] 1.3 新增段落级渲染函数到 sidecar-writer.ts [N8]
  - renderProposalMd(proposal, changeName): string（Why/What Changes/Capabilities/Impact 四段）
  - renderDesignMd(design, changeName): string（Context/Goals-NonGoals/Decisions/Risks 四段）
  - renderSpecsMd(specs, changeName): Array<{ path, content }>（按 specs[].path 多文件拆分；REMOVED 渲染 Reason/Migration；RENAMED 渲染 FROM:/TO:）
  - 纯函数、确定性（同输入同输出）
  - 遵循 renderTasksMd 既有模式
  - 依赖: 1.1
  - 对应: specs/artifact-json-sidecar/spec.md
  - 产出文件: `src/core/spec/sidecar-writer.ts`

- [x] [测试][单元][P0] 1.4 更新 sidecar-schema 单元测试 [N6]
  - createEmptyChange 工厂（三段缺省 + 根字段）
  - ChangeSchema 段落类型校验枚举
  - 旧 3 schema 保留可校验（降级路径）
  - 依赖: 1.1
  - 对应: specs/artifact-json-sidecar/spec.md
  - 产出文件: `test/sidecar-schema.test.ts`

- [x] [测试][单元][P0] 1.5 更新 sidecar-writer 单元测试 [N8]
  - writeChangeJson 校验失败抛异常（错误含字段路径）
  - initChangeJson 幂等（不覆盖已存在文件）
  - renderProposalMd / renderDesignMd 幂等 + 四段标题断言
  - renderSpecsMd 多文件拆分 + REMOVED/RENAMED 字段渲染
  - 段缺失时 render 报错引导
  - 依赖: 1.2, 1.3
  - 对应: specs/artifact-json-sidecar/spec.md
  - 产出文件: `test/sidecar-writer.test.ts`

## 2. CLI 命令

- [x] [代码] 2.1 新增统一 `venus spec render <type>` 子命令到 spec.ts [N8]
  - type ∈ {proposal, specs, design, tasks}；--change <name> 必填
  - proposal/specs/design: 读 .venus/change.json → 提取对应段 → 校验 → 渲染 MD
  - specs: 多文件拆分写入 specs/<name>/spec.md
  - tasks: 读 tasks.json → renderTasksMd（替换现行 spec tasks render）
  - 读取时校验：校验失败报字段名+原因，退出码非零；段缺失报错引导
  - 移除 spec tasks render 子命令注册
  - 依赖: 1.2, 1.3
  - 对应: specs/spec-workflow-skills/spec.md
  - 产出文件: `src/commands/spec.ts`

- [x] [代码] 2.2 调整 sidecar 子命令组 [N4]
  - `sidecar init` 改为生成 .venus/change.json 骨架（含根字段；幂等不覆盖）；--type 参数简化（change/all/tasks）
  - 移除 `sidecar manifest` 子命令（manifest 信息吸收进 change.json 根字段）
  - 更新命令组 description
  - 依赖: 1.2
  - 对应: specs/artifact-json-sidecar/spec.md
  - 产出文件: `src/commands/spec.ts`

- [x] [代码] 2.3 更新 reindex 读取链
  - 优先读 .venus/change.json：根字段 → changes 表；proposal 段 → capabilities 表 + summary（whatChanges 首条/why 截断 200）；design.decisions → decisions_fts；specs 段 → capabilities/requirements_fts
  - 降级：旧 3 文件（manifest/decisions/capabilities）→ WARN
  - 再降级：MD 解析（现有逻辑保留）
  - tasks.json / exploration.md 读取逻辑不变
  - 依赖: 1.2
  - 对应: specs/sqlite-cross-change-index/spec.md
  - 产出文件: `src/commands/spec.ts`

- [x] [代码] 2.4 更新 completion.ts 的 VENUS_COMMANDS 表
  - 新增 render 子命令（含四种 type）
  - 移除 tasks render 旧条目；sidecar 子命令组调整
  - 依赖: 2.1
  - 产出文件: `src/commands/completion.ts`

## 3. 协议与模板

- [x] [代码] 3.1 重写 openspec/rules/artifact-generation.md 的 G2 段为 JSON-first 协议（单一源） [N5]
  - 每个 artifact：写 change.json 对应段（或 tasks.json）→ venus spec render <type> → 校验失败修正 JSON → 渲染失败手写 MD 降级（WARN）
  - 含 change.json 段落结构/字段说明（或指向 jsonTemplate）
  - G1 补充 `venus spec sidecar init` 可选骨架
  - 供 spec-propose / tr-impl-workflow / tr-impl-auto-workflow 共享
  - 依赖: 2.1
  - 对应: specs/template-generation/spec.md
  - 产出文件: `openspec/rules/artifact-generation.md`

- [x] [代码] 3.2 重写 spec-propose.ts 的 JSON 生成段（合并文件流程） [N5]
  - 替换现行 JSON Sidecar Generation 段（4 文件设计）为：累积写 change.json 三段 → render 各类型 → 降级分支
  - 移除 `venus spec sidecar manifest` 与 `venus spec tasks render` 旧引用
  - 引用 openspec/rules/artifact-generation.md（不复制完整步骤）
  - allowedTools 更新：JSON Write/Edit + Bash(venus spec render:*)
  - 依赖: 2.1
  - 对应: specs/spec-workflow-skills/spec.md
  - 产出文件: `src/core/templates/workflows/spec-propose.ts`

- [x] [代码] 3.3 更新 spec-apply.ts 的上下文读取
  - 实现上下文优先读 .venus/change.json 的 specs/design/proposal 段；缺失降级 MD（WARN）
  - tasks.json 状态管线保持（读 status → 完成后更新 → venus spec render tasks）
  - 更新旧 `venus spec tasks render` 引用为 `venus spec render tasks`
  - allowedTools 相应更新
  - 依赖: 2.1
  - 对应: specs/spec-workflow-skills/spec.md
  - 产出文件: `src/core/templates/workflows/spec-apply.ts`

- [x] [代码] 3.4 更新 spec-verify.ts 的 JSON 优先读取
  - change.json 的 specs 段（需求/场景清单）+ tasks.json（任务状态）结构化对比
  - JSON 缺失降级 MD（WARN）
  - 依赖: 2.1
  - 对应: specs/spec-workflow-skills/spec.md
  - 产出文件: `src/core/templates/workflows/spec-verify.ts`

- [x] [代码] 3.5 更新 tr-docs-requirement-doc.ts 的章节来源（技能版+命令版同口径）
  - 读取顺序：.venus/change.json → .venus/tasks.json → MD 降级（WARN）
  - 映射更新：一←proposal.why；二拆解←proposal.whatChanges；二非本期←design.nonGoals；三←design.decisions（表直接遍历）；四←design.decisions+context；七←proposal.impact
  - 移除对旧 decisions.json 的专属依赖（改由 change.json design 段承担）
  - 依赖: 2.1
  - 对应: specs/spec-workflow-skills/spec.md
  - 产出文件: `src/core/templates/workflows/tr-docs-requirement-doc.ts`

- [x] [代码] 3.6 重写 spec-archive.ts 的主 spec 同步段
  - delta spec 同步改读 .venus/change.json 的 specs 段结构化 operations（ADDED/MODIFIED/REMOVED/RENAMED）→ 应用至主 spec
  - change.json 缺失降级解析 delta spec MD（WARN）
  - 预归档需求文档对齐（步骤 4.8）来源改 change.json + tasks.json
  - 依赖: 2.1
  - 对应: specs/spec-workflow-skills/spec.md
  - 产出文件: `src/core/templates/workflows/spec-archive.ts`

- [x] [代码] 3.7 更新 spec-bulk-archive.ts 的并行同步段（a 段）
  - 与 spec-archive 同口径：读 change.json specs 段结构化 operations
  - 缺失降级 delta spec MD（WARN）
  - 依赖: 2.1
  - 对应: specs/spec-workflow-skills/spec.md
  - 产出文件: `src/core/templates/workflows/spec-bulk-archive.ts`

- [x] [代码] 3.8 更新 tr-impl-debug.ts 的 Phase 6 同步提案为 JSON-first
  - 修复内容写入 change.json 的 proposal 段（What Changes 追加根因/修复）与 specs 段（行为变化）
  - tasks.json 勾选 + 新增回归测试任务
  - 运行 venus spec render <type> 重渲染 MD
  - 格式校验改为 JSON 校验 + 渲染成功（不再校验 MD 格式）
  - allowedTools 更新（JSON Edit + render）
  - 依赖: 2.1
  - 对应: specs/spec-workflow-skills/spec.md
  - 产出文件: `src/core/templates/workflows/tr-impl-debug.ts`

- [x] [代码] 3.9 更新 spec-verify-proposal.ts + tr-impl-review-proposal.ts 的读取与修复
  - 两者优先读 change.json（proposal/design/specs 段）做评分/复查证据；缺失降级 MD（WARN）
  - review-proposal 的缺漏修复改为更新 change.json 段落 + 重渲染（不再直接改 MD）
  - 依赖: 2.1
  - 对应: specs/spec-workflow-skills/spec.md
  - 产出文件: `src/core/templates/workflows/spec-verify-proposal.ts`, `src/core/templates/workflows/tr-impl-review-proposal.ts`

- [x] [代码] 3.10 更新 tr-impl-auto-workflow.ts Phase 2 内联生成
  - 显式引用 openspec/rules/artifact-generation.md 的 JSON-first 步骤（消除绕过 JSON 的生成路径）
  - 核验 tr-impl-workflow.ts Phase 2.4 已通过协议引用继承（无需重复步骤文本）
  - 依赖: 2.1
  - 对应: specs/template-generation/spec.md
  - 产出文件: `src/core/templates/workflows/tr-impl-auto-workflow.ts`

## 4. instructions 契约与文档

- [x] [代码] 4.1 jsonTemplate 契约与 artifact instruction 文案 [N5]
  - templates/index.ts：导出各 artifact 的 JSON schema 模板常量（proposal/specs/design 段 + tasks）
  - instructions.ts：输出新增 jsonTemplate 字段（纯新增，向后兼容）
  - schema.ts：artifact instruction 文案更新为 JSON-first 表述
  - 依赖: 1.1
  - 对应: specs/template-generation/spec.md
  - 产出文件: `src/core/spec/templates/index.ts`, `src/core/spec/instructions.ts`, `src/core/spec/schema.ts`

- [x] [代码] 4.2 同步 README.md / AGENTS.md 中的侧车与命令描述
  - 检查并更新：4 文件→合并 change.json 的描述、spec tasks render→spec render、sidecar manifest 移除
  - 仓库地图中相关文件职责描述核对
  - 依赖: 2.1
  - 对应: specs/template-generation/spec.md
  - 产出文件: `README.md`, `AGENTS.md`

## 5. 构建与交付

- [x] [代码] 5.1 运行 pnpm build && pnpm generate:skills 刷新产物
  - 确认 skills/ 与 .claude/commands/venus/ 快照含 JSON-first 指令与新 allowedTools
  - 确认 template-derivation / skills-parity 结构完整
  - 依赖: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 4.1, 4.2
  - 产出文件: `skills/`, `.claude/commands/venus/`

- [x] [测试][功能][P0] 5.2 运行 pnpm test 全量通过 + 端到端冒烟
  - 全量测试（sidecar-schema / sidecar-writer / sqlite-index / allowed-tools / skills-parity / template-derivation / artifact-dataflow 等）
  - 端到端冒烟：以本变更目录手工构造 change.json 三段 → venus spec render 三种类型 → 校验 MD 产出 → reindex 读取验证
  - artifact-dataflow.test.ts 断言核验（探索移动/需求文档时机不受影响）
  - 依赖: 5.1

- [x] [代码] 5.3 版本与变更日志
  - package.json version minor 递增
  - CHANGELOG.md：归档 [Unreleased] → 新版本小节（Added: 合并 ChangeSchema / render 命令 / jsonTemplate；Changed: 10 模板 JSON-first 重写 / reindex 读取链）；保留空 [Unreleased]；同步底部链接
  - 依赖: 5.2
  - 产出文件: `package.json`, `CHANGELOG.md`

> 进度: 24/24 (100%)
