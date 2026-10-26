# Tasks: add-spec-workflow

> 任务类型标签：[代码] 实现代码 / [使用说明] 补充文档（默认产出至 attachments/）

## 1. spec 状态机核心（src/core/spec/）

- [x] 1.1 [代码] 定义 `SPEC_DRIVEN_SCHEMA` 依赖图常量（artifacts: proposal[requires:[]] / specs[requires:[proposal]] / design[requires:[proposal]] / tasks[requires:[specs,design]]；apply: requires=[tasks], tracks=tasks.md），导出共享类型
  - 文件：`src/core/spec/schema.ts`
  - 验证：四命令共享引用，无重复定义
- [x] 1.2 [代码] 实现 artifact 状态检测：按 generates 文件/glob 存在性判 done，依赖满足且未完成判 ready，否则 blocked（含 missingDeps）；Kahn 拓扑排序按声明序
  - 文件：`src/core/spec/status.ts`
  - 验证：仅 proposal.md 存在时 → proposal:done, specs:ready, design:ready, tasks:blocked(missingDeps=[specs,design])
- [x] 1.3 [代码] 实现 tasks.md 进度统计（`- [ ]`/`- [x]` 勾选解析 → total/complete/remaining）
  - 文件：`src/core/spec/status.ts`
  - 验证：5 个未勾 + 3 个已勾 → total:8, complete:3, remaining:5
- [x] 1.4 [代码] 实现内置 artifact 模板常量（proposal/specs/design/tasks 四个 Markdown 模板，内容对齐 openspec spec-driven 模板结构：Why/What Changes/Capabilities/Impact、ADDED/MODIFIED/REMOVED 操作头、Context/Decisions、任务清单）
  - 文件：`src/core/spec/templates/`
  - 验证：模板含必须分节占位，instructions 分发返回全文
- [x] 1.5 [代码] 实现 `venus spec instructions` 逻辑：返回 artifact 的 template/outputPath/resolvedOutputPath/dependencies/unlocks；非法 id 报错并列出合法 id
  - 文件：`src/core/spec/instructions.ts`
  - 验证：proposal 的 unlocks 含 design 与 specs；非法 id 非零退出
- [x] 1.6 [代码] 实现 `venus spec new` 逻辑：创建 `openspec/changes/<name>/` + 写 `.openspec.yaml`（schema: spec-driven / created: YYYY-MM-DD / 可选 goal）；openspec/ 不存在时自动创建骨架；已存在同名变更报错不覆盖
  - 文件：`src/core/spec/new-change.ts`
  - 验证：全新目录创建成功；重名非零退出
- [x] 1.7 [代码] 实现 `venus spec archive` 逻辑：校验变更存在 → 未完成任务警告 → 移动至 `openspec/changes/archive/YYYY-MM-DD-<name>/`（已含日期前缀不叠加；renameSync 失败回退 copy+delete）；无 --yes 时预览退出
  - 文件：`src/core/spec/archive.ts`
  - 验证：正常归档 / 无 --yes 拒绝 / 未完成警告后 --yes 可执行
- [x] 1.8 [代码] 状态机单元测试（依赖图判定 / 进度统计 / 模板分发 / new/archive 生命周期 / .openspec.yaml 非标准 schema WARN 容错）
  - 文件：`test/spec-status.test.ts`、`test/spec-commands.test.ts`
  - 验证：vitest 全绿（23 tests passed）

## 2. CLI 注册（src/commands/spec.ts + cli/index.ts）

- [x] 2.1 [代码] 实现 spec 命令入口（commander 嵌套子命令组：new "<name>" [--goal] / status --change <name> [--json] [--all] / instructions <artifact-id> --change <name> [--json] / archive <name> [--yes] [--json]）
  - 文件：`src/commands/spec.ts`
  - 验证：--json 输出契约字段与源项目对齐（changeName/artifacts[].status/applyRequires/progress/template/...）
- [x] 2.2 [代码] buildProgram 注册 specCommand；--help 展示子命令组
  - 文件：`src/cli/index.ts`
  - 验证：venus spec --help / venus spec new/status/instructions/archive 全链路可用（临时目录实测通过：new 创建/status 状态判定/instructions JSON 合法/archive 日期前缀归档）
- [x] 2.3 [代码] completion 补全适配：验证 shell 补全脚本生成逻辑对嵌套子命令的支持，不支持则 spec 组暂时排除出补全清单并输出 WARN 注释
  - 文件：`src/commands/completion.ts`
  - 验证：bash 与 powershell 补全脚本均已支持 spec 二级子命令补全（无降级）

## 3. spec 技能模板（src/core/templates/workflows/）

- [x] 3.1 [代码] config.ts 扩展：SkillType 联合类型加 'spec'，SKILL_TYPES 追加 `{ id: 'spec', name: '规格', description: '规格驱动工作流：探索、提案、实现、归档、验证' }`
  - 文件：`src/core/config.ts`
  - 验证：isSkillType('spec') 为 true；SKILL_TYPE_IDS 含 spec
- [x] 3.2 [代码] spec-explore 技能模板：CodeGraph 强制首动作守卫（codegraph_status 先行，Glob/Grep 仅回退）、结构化探索文件持久化（openspec/explorations/<keyword>-explore-<seq>.md）、CONTEXT.md 术语启动检查、写入确认守卫（命名文件 + yes/no 单独确认）、置信度标记（HIGH/MEDIUM/LOW）
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：SkillTemplate.name=venus_spec_explore，allowedTools 含 Bash(codegraph:*) 与 Read/Glob/Grep
- [x] 3.3 [代码] spec-propose 技能模板：venus spec new/status/instructions 命令驱动循环（获取 applyRequires 与传递闭包 → 逐 artifact 生成）、能力记忆注入（specs/<capability>/explorations.md）、探索文件关联迁移、命名规范引擎（prefix-module-feature）、完成后强制调用 spec-verify-proposal 验证门
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：正文引用 venus spec 命令（零 openspec 依赖）；验证门为 MUST 步骤
- [x] 3.4 [代码] spec-apply 技能模板：venus spec status + instructions apply 获取任务清单、设计确认门（呈现批次计划 WAIT 确认）、任务类型标签处理（[代码] 实现 / 非 [代码] 读产出字段写 attachments/）、勾选推进、编译检查（tech stack 检测 + autoFix 3 次）、tr_impl 触发边界说明（description 区分）
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：description 明确"基于 openspec/changes/ 制品的规格驱动实现"，与 tr_impl（直接实现需求）区分
- [x] 3.5 [代码] spec-archive 技能模板：CONTEXT.md 术语同步检查点、探索记忆同步检查点（冲突标"已过时"）、delta spec AI 智能合并（ADDED/MODIFIED/REMOVED/RENAMED 到主 spec）、venus spec archive 移动调用、CodeGraph 增量同步（失败 WARN 非阻塞）
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 验证：正文命令调用为 venus spec archive 与 codegraph sync
- [x] 3.6 [代码] spec-verify 技能模板：三维度验证（Completeness/Correctness/Coherence）、CRITICAL/WARNING/SUGGESTION 分级、file:line 证据、优雅降级（仅 tasks → 只验任务）、report-only 不修改不归档
  - 文件：`src/core/templates/workflows/spec-verify.ts`
  - 验证：正文含只读约束
- [x] 3.7 [代码] spec-verify-proposal 技能模板：D1-D9 评分体系（D6-D9 条件启用，未启用标"不适用"排除计分）、90% 阈值 PASS/FAIL、FAIL 修复循环、tech stack 从 openspec/config.yaml context 检测
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`
  - 验证：评分表与阈值规则完整；条件维度不计 0 分
- [x] 3.8 [代码] registry.ts 注册：WORKFLOW_PAIRS 追加 6 个 spec 技能对；验证 deriveCommandId(venus_spec_verify_proposal)=spec-verify-proposal
  - 文件：`src/core/templates/registry.ts`
  - 验证：getSkillTemplates('spec') 返回 6 项；指令 id 派生正确
- [x] 3.9 [代码] init 规则文件联动：.venus/rules/ 生成 spec 类型规则文件（spec.md，与 tr_* 同模式 —— 文件名=类型 id）
  - 文件：`src/core/project-config.ts`（规则文件清单扩展）
  - 验证：venus init 后 .venus/rules/ 含 spec.md（实测通过；实现说明：机制约束为每类型一个规则文件，文件名=类型 id，故为 spec.md 而非 spec_propose.md）
- [x] 3.10 [代码] 模板注册测试：skills-parity / commands 测试扩展（6 个新技能的命名、类型、指令派生、安装路径）
  - 文件：`test/skills-parity.test.ts`、`test/commands.test.ts`、`test/templates.test.ts`
  - 验证：vitest 全绿

## 4. 管理命令适配与验证

- [x] 4.1 [代码] list 分组验证：countSkillsByType 8 类完整展示（规格组 6 技能）
  - 文件：`src/commands/list.ts`
  - 验证：venus list 输出含"规格"分组
- [x] 4.2 [代码] validate 校验适配：spec 类型技能 frontmatter 校验通过
  - 文件：`src/commands/validate.ts`
  - 验证：安装后 venus validate 零失败
- [x] 4.3 [代码] update 刷新路径验证：venus update 可刷新 6 个 spec 技能（手改保护逻辑不变）
  - 文件：`src/commands/update.ts`
  - 验证：update 后技能内容与模板一致
- [x] 4.4 [代码] .openspec.yaml 兼容性验证：venus spec new 创建的变更可被 openspec CLI（openspec status --change）识别读取
  - 文件：`test/spec-commands.test.ts`（跨 CLI 兼容断言，openspec 存在时执行）
  - 验证：openspec status 输出与 venus spec status 的 artifact 状态一致

## 5. 交付文档

- [x] 5.1 [使用说明] spec 工作流使用指南：6 技能 + 4 命令的完整用法、与 tr_* 技能的协作关系、目录结构说明、从 openspec CLI 迁移的对照说明
  - 产出：`attachments/spec-workflow-guide.md`
  - 验证：指南覆盖全部 6 技能与 4 命令，含最小可用示例
