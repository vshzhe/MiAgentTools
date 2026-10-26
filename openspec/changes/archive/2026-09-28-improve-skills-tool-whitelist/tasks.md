# Tasks: improve-skills-tool-whitelist

## 1. 白名单共享模块与技能模板补齐

- [x] 1.1 [代码] 新增白名单共享常量模块
  - 文件：`src/core/templates/tool-whitelist.ts`
  - 内容：`CODEGRAPH_MCP`（裸 `mcp__codegraph` + 9 个具名工具，共 10 条的逗号分隔常量）、`SUBAGENT_DISPATCH = 'Agent, Task'`、`skillDelegation(names: readonly string[]): string`（产出 `Skill(a), Skill(b)`）
  - 验证：`pnpm build` 通过；`node -e` 导入并断言 `CODEGRAPH_MCP` 条目数为 10、`skillDelegation(['venus_spec_apply'])` 输出 `Skill(venus_spec_apply)`

- [x] 1.2 [代码] 逐技能人工核准「委派清单 / 派发清单 / CodeGraph 使用清单」
  - 文件：`src/core/templates/workflows/*.ts`（27 个，逐个通读正文，**MUST NOT 采信 `grep venus_` 结果**——散文提及他技能名不构成委派，如 `tr-tools` 列举所介绍的技能、`tr-impl-review-proposal` 正文的 `venus_user` 为业务示例）
  - 产出：三份清单（委派 / 派发 / 使用 CodeGraph）逐技能落表，作为 1.3–1.5 的输入
  - 验证：清单中每条委派均可回指正文中「经 Skill 工具委派」的实现句
  - 依据：design.md D3 执行约束

- [x] 1.3 [代码] 为使用 CodeGraph 的技能补 MCP 双写条目
  - 文件：`src/core/templates/workflows/*.ts`（按 1.2 清单，预判含 `tr-impl-workflow` / `tr-impl-debug` / `tr-impl-auto-workflow` / `tr-impl-genfull` / `tr-docs-feature-doc` / `tr-impl-auto-migration` / `spec-explore` / `spec-archive` / `spec-bulk-archive`）
  - 内容：`allowedTools` 拼接 `${CODEGRAPH_MCP}`；**仅**对已含 `Bash(codegraph:*)` 或正文引用 `codegraph_*` 的技能写入
  - 验证：`grep -c "mcp__codegraph" ` 命中技能数与 1.2 清单一致；不使用 CodeGraph 的技能无 `mcp__codegraph` 条目

- [x] 1.4 [代码] 为存在委派的技能补 `Skill(...)` 精确条目
  - 文件：`src/core/templates/workflows/*.ts`（按 1.2 清单，预判含 `tr-impl-genfull`（8 个）/ `tr-impl-auto-workflow`（5 个）/ `tr-impl-debug`（1 个）/ `tr-impl-workflow` / `spec-propose` / `tr-impl-auto-migration`）
  - 内容：`allowedTools` 拼接 `${skillDelegation([...])}`；**MUST NOT** 使用 `Skill(*)` 通配
  - 验证：`grep -rn "Skill(\*)" src/core/templates/` 无命中；每条 `Skill(...)` 均可回指 1.2 清单

- [x] 1.5 [代码] 为存在派发的技能补 `Agent, Task` 条目并修复存量漂移
  - 文件：`src/core/templates/workflows/*.ts`（按 1.2 清单，预判含 `tr-impl-auto-workflow` / `tr-impl-genfull` / `tr-impl-auto-migration` / `spec-apply` / `spec-bulk-archive` / `tr-impl-workflow`）
  - 内容：拼接 `${SUBAGENT_DISPATCH}`；**重点修复** `tr-impl-auto-workflow` 的存量缺口（正文 1.2.1.5 与 Phase 4 要求派发，白名单无条目）
  - 验证：`tr-impl-auto-workflow.ts` 的 `allowedTools` 含 `Agent` 与 `Task`；`spec-bulk-archive` 由仅 `Task` 变为 `Agent, Task` 双写

- [x] 1.6 [代码] 校验授权面未扩大
  - 文件：`src/core/templates/workflows/*.ts`
  - 内容：逐技能比对变更前后的 `Write` / `Edit` / `Bash(...)` 条目集合，确认数量与内容均未新增
  - 验证：`git diff` 中 `allowedTools` 行的删除段不含任何原有 `Write` / `Edit` / `Bash(` 条目丢失或新增
  - 依据：design.md D7

## 2. 指令白名单配对继承

- [x] 2.1 [代码] `CommandTemplate` 增可选字段、`CommandContent` 增必填字段 `allowedTools`
  - 文件：`src/core/templates/types.ts`（`CommandTemplate` → `allowedTools?: string`）、`src/core/command-generation/types.ts`（`CommandContent` → `allowedTools: string`）
  - 内容：**两处必填性不同**（design.md D5 实现期修正）——`CommandTemplate` 必须**可选**，否则 27 个指令模板工厂（各自返回字面量、不知配对技能）集体类型报错，迫使把白名单复制 27 份；`CommandContent` 必须**必填**，作为「白名单必须存在」的强制点
  - 验证：`pnpm build` 通过，且 27 个 `getXxxCommandTemplate()` 工厂**无需任何改动**

- [x] 2.2 [代码] 适配器改为读取内容字段并移除硬编码常量
  - 文件：`src/core/command-generation/adapters/claude.ts`
  - 内容：`formatFile` 输出 `allowed-tools: ${content.allowedTools}`；删除 `VENUS_CLI_ALLOWED_TOOLS` 导出
  - 验证：`grep -rn "VENUS_CLI_ALLOWED_TOOLS" src/ test/` 无残留引用（若测试引用则随 5.4 一并清理）

- [x] 2.3 [代码] 注册表统一回填配对技能白名单
  - 文件：`src/core/templates/registry.ts`
  - 内容：`getCommandTemplates()` 返回 `{ template: { ...command, allowedTools: skill.allowedTools }, id }`，在映射处统一回填，避免 27 行逐一改动
  - 验证：遍历 `getCommandTemplates()`，每一项的 `template.allowedTools` 与其配对技能的 `allowedTools` 全等；`test/subagent-resource-sharing.test.ts`（仅读 `template.content`）不受影响

- [x] 2.4 [代码] 生成调用点透传白名单
  - 文件：`src/commands/init.ts`（`buildCommand` 的 `template` 参数内联类型补 `allowedTools`）、`src/commands/update.ts`（`CommandContent` 字面量补该字段）
  - 内容：两处的 `CommandContent` 构造均传入 `template.allowedTools`
  - 验证：`venus init` 生成的指令文件 frontmatter 白名单与配对技能 SKILL.md 一致

## 3. 会话级权限载体

- [x] 3.1 [代码] 新增权限合并模块
  - 文件：`src/core/permissions.ts`
  - 内容：`buildPermissionEntries(templates)` —— 从已安装技能模板的 `allowedTools` 拆分、去重、**过滤全量放行条目**（`Bash(*)`、裸 `*`）；`mergePermissions(projectRoot, entries): MergeResult` —— 读 `.claude/settings.json` → 并入 `permissions.allow` → 去重 → 写回，返回 `created` / `merged` / `preserved-invalid`
  - 验证：`pnpm build` 通过；纯函数无 IO 依赖（合并逻辑可单测）
  - 约束：遵循仓库既有约定 —— ESM 相对导入带 `.js` 后缀、路径拼接一律 `path.join()`（AGENTS.md 守则 6）、4 空格缩进、中文注释
  - 依据：design.md D6

- [x] 3.2 [代码] `venus init` 接入权限写入
  - 文件：`src/commands/init.ts`、`src/commands/init.ts` 的 `InitResult` 类型
  - 内容：安装产物后调用 `mergePermissions`，结果并入 `InitResult` 供输出提示；失败仅 WARN **MUST NOT** 阻断安装
  - 验证：新项目 `venus init` 后 `.claude/settings.json` 含 `permissions.allow` 条目且结构合法

- [x] 3.3 [代码] `venus update` 接入权限写入
  - 文件：`src/commands/update.ts` 及其结果类型
  - 内容：同 3.2，保证存量项目升级后获得新增条目
  - 验证：对已 init 的项目执行 `venus update`，`permissions.allow` 补齐新增条目且不产生重复

## 4. 快照、文档与版本同步

- [x] 4.1 [代码] 重新生成产物快照
  - 文件：`skills/**`（由脚本生成，**勿手编**）
  - 内容：快照树**只含 27 个 `SKILL.md` 与 references 附属文件（`*.md` / `*.sh`），不含斜杠指令**——`scripts/generate-skills.mjs` 仅写 `generated.dirName/SKILL.md` + references；指令是 `venus init` 安装期产物，不入快照。故本变更**只需重跑快照即可反映技能侧白名单变化，指令侧白名单不在快照内**
  - 命令：`pnpm build && pnpm generate:skills`
  - 验证：`test/skills-parity.test.ts` 通过；`git status` 显示变更仅限 `skills/*/SKILL.md`
  - 依据：AGENTS.md 守则 1

- [x] 4.2 [使用说明] 同步技能手册的白名单列表
  - 文件：`docs/skills-manual.md`
  - 产出：`docs/skills-manual.md`
  - 内容：同步 20+ 处逐技能 `allowed-tools` 列举；补充白名单三层组合规则说明
  - 验证：文档中每处白名单与对应技能模板 `allowedTools` 逐字一致

- [x] 4.3 [使用说明] 同步编排与迁移指南的白名单列举
  - 文件：`docs/genfull-guide.md`、`docs/migration-suite-guide.md`
  - 产出：`docs/genfull-guide.md`、`docs/migration-suite-guide.md`
  - 验证：其中每处白名单与对应技能模板一致

- [x] 4.4 [使用说明] 更新仓库修改守则
  - 文件：`AGENTS.md`
  - 产出：`AGENTS.md`
  - 内容：守则 2 补充白名单三层组合规则（新增条目须走 `tool-whitelist.ts` 常量）、MCP/Skill/子代理条目齐备性要求、`Skill(*)` 禁用、以及会话语义载体 `permissions.ts` 的存在
  - 验证：守则文本与 design.md D1–D7 一致

- [x] 4.5 [使用说明] 修正术语表陈旧计数
  - 文件：`openspec/CONTEXT.md`
  - 产出：`openspec/CONTEXT.md`
  - 内容：workflow 计数 23 → 27；视需要补入「工具调用白名单」术语并与「归档标签白名单」区分
  - 验证：计数与 `getSkillTemplates().length` 实测值一致

- [x] 4.6 [代码] 版本号与变更日志
  - 文件：`package.json`、`CHANGELOG.md`
  - 内容：`1.6.0 → 1.7.0`（minor）；`[Unreleased]` 归档为 `## [1.7.0] - 2026-09-28` 并补链接定义
  - 验证：`node bin/venus.js --version` 输出 `1.7.0`；CHANGELOG 链接引用完整
  - 依据：AGENTS.md 守则 8

## 5. 测试

- [x] 5.1 [测试][单元][P0] 权限合并非破坏性
  - 文件：`test/permissions.test.ts`（新增）
  - 覆盖：① 全新创建；② 既有 `allow` 条目与 `deny` 段原样保留；③ 连续两次执行结果一致且无重复条目；④ 既有文件非法 JSON 时字节不变 + WARN；⑤ `Bash(*)` 与裸 `*` 被过滤掉
  - 验证：`pnpm test` 全部通过

- [x] 5.2 [测试][单元][P0] 白名单条目齐备性
  - 文件：`test/allowed-tools.test.ts`（扩展）
  - 覆盖：① 引用 `codegraph_*` 的技能含 `mcp__codegraph` 与 9 个具名条目；② 有委派的技能含对应 `Skill(...)`；③ 有派发的技能含 `Agent` 与 `Task`；④ **不存在** `Skill(*)`；⑤ 只读技能 `venus_spec_verify_proposal` 与 `venus_spec_verify` 不含 `Write`/`Edit`（**注意：`venus_spec_archive` 含 `Write`/`Edit`，不属只读技能**——实现期核验更正，见 design.md D8）；⑥ 指令白名单与配对技能全等；⑦ 全部条目为合法规则串（无空条目、无首尾空白、无重复项）
  - 验证：`pnpm test` 通过；人为删除一条 MCP 条目后该测试失败（反向验证拦截力）

- [x] 5.3 [测试][单元][P0] 指令白名单继承
  - 文件：`test/commands.test.ts`（更新）
  - 覆盖：新增「`venus init` 后每个指令文件的 frontmatter 白名单等于其配对技能的 `allowedTools`」断言（该文件**原先无** `allowed-tools` 断言，属新增覆盖）；全量 27 技能端到端安装后逐对校验
  - 验证：`pnpm test` 通过

- [x] 5.4 [测试][单元][P0] 生成器与适配器
  - 文件：`test/generation.test.ts`（更新）
  - 覆盖：① **`test/generation.test.ts:64` 的原硬断言 `allowed-tools: Bash(venus:*)` 改写**为「等于传入 `content.allowedTools`」；② `:52-62` 手工构造的 `CommandContent` **补 `allowedTools` 字段**（字段改必填后此处编译期报错，必须同步）；③ SKILL.md frontmatter 与模板一致（既有断言保持）
  - 验证：`pnpm test` 通过；`pnpm build` 无类型错误
  - 依据：design.md D5（字段设必填）

- [x] 5.5 [测试][功能][P1] 端到端安装验证
  - 文件：`test/commands.test.ts`（在既有临时目录端到端用例内扩展）
  - 覆盖：`venus init` 全量 27 技能后 —— ① 技能与指令白名单一致；② `.claude/settings.json` 生成且含预期条目；③ 重复 `init` 幂等
  - 验证：`pnpm test` 通过

- [x] 5.6 [测试][单元][P1] 确认门未被白名单改动侵蚀
  - 文件：`test/templates.test.ts`（扩展）
  - 覆盖：5 个含门的技能（explore / workflow / auto-workflow / debug / genfull）正文中，提示词校验门与功能流程图门的段落内容**逐字未被改动**——白名单化只消除工具级弹窗，MUST NOT 触碰对话级确认门
  - 验证：`pnpm test` 通过；人为改动任一门的门文本后该测试失败（反向验证拦截力）
  - 依据：spec `tool-call-whitelist` 需求「白名单不改变对话级确认门」

- [x] 5.7 [测试][单元][P2] 已评估：白名单运行时生效性无需测试
  - 文件：无新增（记录依据）
  - 依据：白名单是否真正抑制权限弹窗由 Claude Code 运行时决定，仓库内无法断言；可测部分是**条目内容、格式合法性与传递链路**（已由 5.1–5.6 覆盖，条目格式合法性断言见 5.2 扩展项）。运行时生效性建议以 `/permissions` 人工确认一次，不纳入自动化测试
