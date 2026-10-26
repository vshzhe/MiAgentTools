# Tasks: refactor-spec-workflow-template-single-source

<!-- 任务类型标签：[代码] 实现代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/） -->

## 1. 派生基础设施

- [x] 1.1 [代码] 实现 deriveCommandContent 纯函数：解析唯一源正文中成对 `<!-- CMD:SKIP -->` / `<!-- /CMD:SKIP -->` 标记段落并裁剪、未标记段落默认保留（fail-safe，防漏标致防护语句缺失）、输出时剥离全部标记注释；输入输出均为纯字符串
  - 文件：`src/core/templates/derive-command.ts`（新建）
  - 验证：单元测试覆盖——标记段落被裁剪、未标记段落保留、标记未闭合（按字面保留并 WARN 或容错策略，按 design D2 fail-safe 原则）、空输入返回空串
- [x] 1.2 [代码] derive-command 单元测试：四类用例（含标记/无标记/边界/空输入）
  - 文件：`test/derive-command.test.ts`（新建）
  - 验证：`pnpm test` 全绿

## 2. CLI 能力（spec-workflow-cli delta）

- [x] 2.1 [代码] 新增 `venus spec instructions apply --change <name> --json`：返回 contextFiles（artifact→绝对路径映射，未创建为空串）、progress（tasks.md 勾选统计，无文件时 0/0/0 不报错）、taskList（原始行+checked+缩进）、动态 instruction 三态（blocked 含 missingDeps / ready / all_done）；变更不存在时非零退出；全程基于内置依赖图，无读外部 schema、无写操作
  - 文件：`src/commands/spec.ts`
  - 验证：测试覆盖 delta spec 四场景（blocked / ready / all_done / 变更不存在）
- [x] 2.2 [代码] 实现 skip_specs 状态语义：`.openspec.yaml` 可选布尔字段（缺省 false）；status 将 specs 报告为 `skipped`（missingDeps 为空，下游 design/tasks 的 requires 视为满足）；`instructions specs` 返回 skip guidance（template 为空或提示文本，outputPath 为空或省略）；未声明时行为与引入前完全一致
  - 文件：`src/commands/spec.ts`
  - 验证：测试覆盖 delta spec 四场景（status 报告 skipped / instructions 跳过指导 / apply 必需集视为满足 / 未声明向后兼容）
- [x] 2.3 [代码] 实现 skip_specs 冲突检测：声明 `skip_specs: true` 且 `specs/` 下存在 delta spec 文件时，status 将 specs 标记 `conflict` 态并在 warnings/stderr 输出二选一提示；`instructions apply` 冲突态返回 blocked 指导；`instructions specs` 输出冲突警告（不返回正常模板也不返回 skip guidance）
  - 文件：`src/commands/spec.ts`
  - 验证：测试覆盖 delta spec 两场景（status 冲突警告 / apply 冲突态 blocked）

## 3. 模板单一源迁移与防护语句回填（spec-workflow-skills delta）

- [x] 3.1 [代码] spec-explore.ts 迁移：`getSpecExploreCommandTemplate().content` 改为调用 deriveCommandContent；修复 skill 版 Visualize 图表右边框错位（漂移 #1）；回填防护语句——写入确认守卫强化（确认范围限定 + 回答设计问题≠同意写入）、依赖文件 re-read from disk、材料性歧义划分
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：派生一致性断言（4.1）+ 人工核对图表闭合 + Guardrails 含三个新增条款
- [x] 3.2 [代码] spec-propose.ts 迁移：command content 改派生；回填 Planning Boundary（触发请求授权的是规划、artifacts 完成后停止等待新请求）、依赖 artifact re-read from disk、required set 传递闭包（按 requires 边构建必需集防早停）、材料性歧义划分；修复蓝图确认句 command 版缺失（漂移 #2）与 Step 0 子编号混排（漂移 #3）
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：派生一致性断言 + Guardrails 含蓝图确认句 + Step 0 编号结构化（子编号嵌套于 Step 0 内）
- [x] 3.3 [代码] spec-apply.ts 迁移：command content 改派生；任务上下文获取改为优先 `venus spec instructions apply`（旧版 CLI 失败回退直接读文件并记录回退原因）、删除 "The venus CLI does not provide an instructions apply command" 让步性说明；回填任务完成判定标准（仅规格行为完整实现才勾选，部分/推迟不算）与 scope-creep 防护（禁止默默缩小/推迟/简化规格行为，须表面化询问并同步 artifacts）
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：派生一致性断言 + 正文含回退分支描述 + Guardrails 含两条新判定
- [x] 3.4 [代码] spec-archive.ts 迁移：command content 改派生；修复步骤编号错序（漂移 #4：4.7 → 5 → 6 → 6.5 → 7 → 8 修正为 6 → 6.5 → 7 → 8 的自然执行顺序）
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 验证：派生一致性断言 + 步骤编号单调递增核对
- [x] 3.5 [代码] spec-bulk-archive.ts / spec-verify.ts / spec-verify-proposal.ts 迁移：三个模板的 command content 均改为 deriveCommandContent 派生（无已知漂移，纯迁移）
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`、`spec-verify.ts`、`spec-verify-proposal.ts`
  - 验证：派生一致性断言（4.1 覆盖）
- [x] 3.6 [代码] skip_specs 模板侧联动：spec-propose / spec-apply 模板正文增加 skipped 状态处理说明（status 报告 skipped 的 artifact 不创建文件，依赖满足继续推进）；spec-archive 模板 Guardrail 增加遇 skip_specs 声明的归档摘要提示（"主规格未同步（skip_specs 声明）"）
  - 文件：`src/core/templates/workflows/spec-propose.ts`、`spec-apply.ts`、`spec-archive.ts`
  - 验证：模板正文含 skipped 处理描述（grep 断言）

## 4. 一致性测试与快照

- [x] 4.1 [代码] 模板派生一致性测试：7 个 spec 工作流逐一断言 `command.content === deriveCommandContent(skill.instructions)`，源码中不存在第二份手工维护正文（替换人工双写核对，对应 delta「模板单一源派生规则」场景）
  - 文件：`test/template-derivation.test.ts`（新建）
  - 验证：`pnpm test` 全绿
- [x] 4.2 [代码] 重新生成 skills/ 快照并全量回归：`pnpm build && pnpm generate:skills`，确认 skills-parity / allowed-tools / spec-commands / spec-status 等既有测试通过
  - 文件：`skills/`（快照）、`test/skills-parity.test.ts`
  - 验证：`pnpm test` 全绿 + `git diff skills/` 人工审查（防护语句回填与漂移修复的预期差异）

## 5. 文档收尾

- [x] 5.1 [代码] AGENTS.md 修改守则第 7 条更新：由"长期方案已决策，落地前以本条约束"改为"已落地——正文仅维护 skill 唯一源，command 版由 derive-command.ts 派生，禁止直接编辑派生产物"；仓库地图 workflows 注释同步
  - 文件：`AGENTS.md`
  - 验证：人工核对 + 与 derive-command.ts 实际路径一致
