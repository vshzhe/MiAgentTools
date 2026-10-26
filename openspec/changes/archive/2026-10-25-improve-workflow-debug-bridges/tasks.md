# Tasks: improve-workflow-debug-bridges

## Caller Updates

- `getWorkflowSkillTemplate` / `VERIFICATION_PROTOCOL_FULL`、`getAutoWorkflowSkillTemplate`、`getDebugSkillTemplate`、`getSpecVerifyProposalSkillTemplate`、`getRequirementDocSkillTemplate`、`getSpecArchiveChangeSkillTemplate`、`getSpecBulkArchiveSkillTemplate`、`getSpecProposeSkillTemplate` 是本次模板行为关联入口；前后向影响包含 `src/core/templates/registry.ts` 的 SKILL/command 派生。
- `WORKFLOW_PROTOCOLS`、`VERIFY_PHASE`、`APPLY_PHASE`、`ARCHIVE_PHASE`、debug phase 与 `evaluatePhaseTransition` 需保持阶段、gate、能力和 receipt 一致；`renderHostOrchestrationSection` 消费 `ORCHESTRATION_DELEGATIONS`。
- debug 新增实际的 `requirement_doc` / `test` 委派必须同步模板 `allowedTools`、宿主 delegation 与 OpenCode V2 permissions；`skillDelegation` 是共享常量，不扩展其他调用方权限。
- `debug` 的无条件 `requirement_doc` 委派必须由 `DEPS`（`src/core/profiles.ts`）覆盖；Pi 编排阶段 agent 的嵌套委派经 `allowed_subagents`（`src/core/pi-native.ts`）授予并报告缺口；`iagent_spec_propose` 独立调用移除自动生成动作与 `Skill(requirement_doc)` 条目。
- CodeGraph 影响线索来自 `codegraph_explore` 的调用方/依赖分析；独立 `codegraph_impact` 工具不可用，因此不宣称执行了独立 impact 查询。
- 模板改动后由 `pnpm build && pnpm generate:skills` 更新静态 `skills/` 快照。关键回归包含 `test/template-derivation.test.ts`、`test/templates.test.ts`、`test/template-consistency.test.ts`、`test/host-orchestration.test.ts`、`test/claude-host-adapter.test.ts`、`test/tool-whitelist-constants.test.ts`、`test/allowed-tools.test.ts`、`test/opencode-v2.test.ts`、`test/pi-native.test.ts`、`test/profiles.test.ts`、`test/artifact-dataflow.test.ts`、`test/command-reference-refs.test.ts`。

## 1. 父工作流需求文档桥

- [x] 1.1 [代码] 在 workflow、auto-workflow、debug 的验证 PASS + 深度复查收束后加入一次“生成 / 跳过”业务桥；确认生成后直接非交互委派，跳过后继续各自原流程；`spec-propose` 独立调用改为验证后停止（无桥、不生成）。[N8] [N9] [N10] [N38] [N39] [N40]
  - 文件：`src/core/templates/workflows/workflow.ts`、`src/core/templates/workflows/auto-workflow.ts`、`src/core/templates/workflows/debug.ts`、`src/core/templates/workflows/requirement-doc.ts`、`src/core/templates/workflows/spec-propose.ts`
  - 验证：独立 verifier 不生成文档；FAIL 不出现文档桥；生成失败输出 WARN 并记录 `generation-failed`；成功生成记录 `generated`；桥确认后无重复的“是否调用 requirement-doc”询问；workflow 与 auto-workflow 后续桥语义不变；`auto-workflow` 的 description 与 Phase 3 / Phase 4 说明披露唯一文档桥且不再声称该阶段无需确认；`iagent_spec_propose` 独立调用在 PASS 后停止、无生成动作、无 `Skill(requirement_doc)` 条目、无生成/跳过桥。
  - **D9 A 组顺序拆解（workflow / auto-workflow，N4–N20；与任务 1.2、3.1、4.1、4.4 衔接）：**
    1. **[后端]（模板编排/技能调用）[N4][N5][N6][N7]** N4 委派 spec-propose，完成后 N5 验证；FAIL 转 N6 修订并返回 N5，PASS 后 N7 深度复查。异常路径：N4 委派失败或制品无效时按既有节点重试或报告、不进入验证；验证技能不可用时内联评分并 WARN；N6 重验仍 FAIL 时呈现继续修订/返回探索选项，不进入实现；复查技能不可用时内联只读复查并 WARN；验证与复查均通过前不展示文档桥。
    2. **[后端]（父模板/需求文档状态层）[N8][N9][N10]** N8 展示生成/跳过桥；生成分支直接委派 N9（成功记 `generated`），跳过分支记录 N10 的 `skipped-by-user`。异常路径：N9 生成失败记录 `generation-failed`、WARN 并继续；N9/N10 状态写入失败时自动重试一次，仍失败则停止该桥（不委派生成、不进入依赖该状态的下一阶段）、输出 WARN 与恢复指引，不得报告状态已持久化或阶段已完成。
    3. **[后端]（workflow 模板/宿主协议）[N11][N12][N13][N14][N15][N16][N17]** N11 分流到 guided 流程；N12 展示实现与测试桥，N13 修改后回到 N12、拒绝则停止；确认后 N14 委派 apply，N15 验证，通过后 N16 归档确认，确认后 N17 委派 archive 并传文档状态。异常路径：N13 拒绝或修改未完成时不得调用 N14；N14 失败暂停报告；N15 失败回 N14 修复；N16 被拒绝时回实现、不归档；N17 失败报告原因。
    4. **[后端]（auto-workflow 模板/宿主协议）[N18][N19][N20]** 文档桥完成后 N18 auto-apply，随后 N19 执行测试门与实现验证，通过后 N20 自动 archive 并传文档状态。异常路径：N18 失败暂停报告、不自动归档；N19 失败按既有预算修复重试，预算耗尽则暂停；N20 失败报告，不伪报完成。
  - **事务边界：** 本组不涉及 DB 写入，DB 事务不适用。技能调用、文档产出、状态写入、阶段回执与后续 archive 是不同阶段的操作，不定义为同一原子事务。
  - **不适用层：** 本组无前端界面、API endpoint 或 DB 实现；执行层使用 `[后端]（模板编排/宿主协议/状态层）`。
  - Spec Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动
  - Scenario Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动 / PASS 与深度复查后由父编排器询问文档选择
  - Scenario Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动 / 用户确认生成后直接委派
  - Scenario Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动 / 用户跳过后继续原流程
  - Scenario Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动 / 验证失败时不展示需求文档桥
  - Spec Ref: workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更
  - Scenario Ref: workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更 / 三个父工作流可在生成分支调用
  - Scenario Ref: workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更 / spec-propose 独立调用不自动生成
  - Spec Ref: workflow-suite-skills / workflow 提案阶段委派 spec-propose
  - Scenario Ref: workflow-suite-skills / workflow 提案阶段委派 spec-propose / 提案阶段委派而非内联
  - Scenario Ref: workflow-suite-skills / workflow 提案阶段委派 spec-propose / 预迁移验证与影响分析保留在编排器
  - Scenario Ref: workflow-suite-skills / workflow 提案阶段委派 spec-propose / 验证门仍由编排器执行
  - Scenario Ref: workflow-suite-skills / workflow 提案阶段委派 spec-propose / 阶段主权归编排器
  - Spec Ref: workflow-suite-skills / auto-workflow 全自动自述与文档桥一致
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动自述与文档桥一致 / 自述与阶段说明一致
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动自述与文档桥一致 / 桥后不追加确认
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动自述与文档桥一致 / 桥不扩大门预算
  - Spec Ref: template-generation / 需求文档生成时机
  - Scenario Ref: template-generation / 需求文档生成时机 / 全自动工作流验证通过后经桥决定
  - Scenario Ref: template-generation / 需求文档生成时机 / 引导式工作流验证通过后经桥决定
  - Scenario Ref: template-generation / 需求文档生成时机 / spec-propose 独立调用不生成需求文档
  - Scenario Ref: template-generation / 需求文档生成时机 / 验证失败不生成
  - Spec Ref: template-generation / 需求文档技能自动调用方扩展
  - Scenario Ref: template-generation / 需求文档技能自动调用方扩展 / 非交互模式调用方识别
  - Scenario Ref: template-generation / 需求文档技能自动调用方扩展 / spec-propose 不再是自动调用方
  - Spec Ref: template-generation / 模板正文一致性
  - Scenario Ref: template-generation / 模板正文一致性 / debug 归档引用同步
  - Scenario Ref: template-generation / 模板正文一致性 / migration 引用同步
  - Scenario Ref: template-generation / 模板正文一致性 / spec-propose 引用同步

- [x] 1.2 [代码] 定义四值状态模型（`absent` / `skipped-by-user` / `generation-failed` / `generated`）并持久写入变更 `exploration.md` 的 `## 需求文档状态` 段，将其从 verify 经过 apply 传至 archive；debug `verify-close` 回执也携带同一结果。写入与读取均“失败自动重试一次后停止”，仍失败按既定语义停止依赖分支。[N10] [N14] [N17] [N20] [N40] [N41]
  - 文件：`src/core/host-orchestration/protocol.ts`、`src/core/host-orchestration/workflows.ts`、`src/core/host-orchestration/transition.ts`、`src/core/host-orchestration/index.ts`、`src/core/templates/workflows/workflow.ts`、`src/core/templates/workflows/auto-workflow.ts`、`src/core/templates/workflows/debug.ts`
  - 验证：`generated` 为终态且与 skip / failure 可区分；`APPLY_PHASE` / `ARCHIVE_PHASE` 输入含同一状态；状态可由新会话 archive 从探索文件恢复；写入重试一次仍失败时不委派生成、不进入依赖阶段、不伪报持久化；读取重试一次仍失败时不落 `absent`、不生成；不丢失 `nextAllowed`、strict/degraded 与其他门语义。
  - Spec Ref: host-orchestration / 需求文档状态跨阶段 handoff
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / 桥写入四种结果
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / 状态写入重试一次后失败
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / 状态读取重试一次后失败
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / 状态穿过 guided apply 到 archive
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / auto-workflow 状态穿过自动 apply 到 archive
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / debug 后续独立 archive 恢复状态
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / 历史变更无状态保持兼容

- [x] 1.3 [代码] 让 archive（单变更与批量归档）按四值持久状态与文档存在性分流：已有文档始终保护人工域并增量对齐；缺失且 skip 时不生成；generation-failed 时 WARN 且不重试；generated 时 WARN 且不重建；只有无状态历史变更保留兼容生成；状态/文件读取失败重试一次后不落入兼容生成。[N42] [N43] [N44] [N45] [N46] [N47]
  - 文件：`src/core/templates/workflows/spec-archive.ts`、`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：四个缺失分支均明确且互斥；`## 基本信息` 与 `## 八、评审记录` 逐字保留；状态或文件存在性读取重试一次仍失败时不生成、不阻断归档；需求文档失败不阻断目录归档。
  - **D9 B 组顺序拆解（archive 需求文档状态分流，N42–N47；关联任务 4.2）：**
    1. **[后端]（archive 状态/文件读取层）[N42][N43]** N42 读取变更持久状态（`absent` / `skipped-by-user` / `generation-failed` / `generated`）及需求文档是否存在，N43 据此分流。异常路径：读取 I/O 失败时自动重试同一读取一次，仍失败不得当作"无状态"进入 N47、不得生成文档（文档存在仍走对齐），WARN + 恢复指引并继续归档。
    2. **[后端]（Markdown 文档对齐层）[N44]** 文档存在时增量对齐第一至七章并逐字保留 `## 基本信息` 与 `## 八、评审记录`。异常路径：检查或对齐失败输出含原因的 WARN，并按既有规格继续归档。
    3. **[后端]（archive 状态分支）[N45][N46]** 文档缺失且状态为 `skipped-by-user` 时 N45 跳过生成；状态为 `generation-failed` 时 N46 输出 WARN 并继续；`generated` 状态由同一 WARN 分支处理并注明"曾生成但文件缺失"。异常路径：N45 不调用 requirement-doc；N46 分支不静默重试或重建。
    4. **[后端]（历史兼容生成层）[N47]** 仅无显式状态且文档缺失时走历史兼容生成。异常路径：生成失败输出 WARN 并继续归档；I/O 读取错误不能作为进入该分支的依据。
  - **事务边界：** 本组不涉及 DB 写入，DB 事务不适用。需求文档检查点位于目录移动之前；文档检查、生成或对齐失败不回滚整个 archive。
  - **不适用层：** 本组无前端、API 或 DB 实现；执行层使用 `[后端]（archive/Markdown 状态层）`。
  - Spec Ref: spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 用户跳过且文档缺失时不补生成
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 用户跳过但文档已存在时对齐
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 生成失败状态不静默重试
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 已生成状态但文档缺失不重建
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 状态读取重试一次后失败不落入兼容生成
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 历史变更无状态时兼容生成
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 文档存在时人工域受保护
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / archive 单独调用时读取持久状态
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 需求文档处理失败不阻断归档
  - Scenario Ref: workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更 / archive 状态分支避免静默覆盖
  - Spec Ref: spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 完整单元序列
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 归档时生成需求文档
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 已存在的需求文档就地增量对齐
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 用户跳过后不补生成
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 生成失败或已生成状态不重试
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 生成失败不中止批次
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 探索记忆同步跳过
  - Spec Ref: template-generation / 归档阶段需求文档行为
  - Scenario Ref: template-generation / 归档阶段需求文档行为 / 归档时需求文档已存在则增量对齐
  - Scenario Ref: template-generation / 归档阶段需求文档行为 / 文档缺失时按状态分流
  - Scenario Ref: template-generation / 归档阶段需求文档行为 / 状态读取失败不落入兼容生成

## 2. Debug 决策与宿主阶段

- [x] 2.1 [代码] 合并高置信根因/缺陷链路的一次确认包；多候选仍先选根因再确认链路；在变更归属后增加多方案修复确认，唯一证据充分方案说明依据后直通，并保留数据库/schema 确认。[N25] [N26] [N27] [N28] [N29] [N30] [N31]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：不确认多方案时不实现；唯一性缺乏代码/项目约束证据时转入多方案分支；高置信根因与链路不要求两次独立确认；多候选顺序不变；诊断确认包被拒绝时终止修复并输出诊断报告（不自动推断继续）。
  - **D9 C 组顺序拆解（debug 复现、诊断与修复，N21–N32；与任务 2.3、4.3 衔接）：**
    1. **[后端]（debug 输入/复现模板）[N21][N22][N23]** N21 校验缺陷输入，确认后 N22 先复现；无法复现或判定非缺陷时 N23 报告诊断且不修改代码。异常路径：输入不明确时停留在澄清门；复现不成立不得修复；非缺陷循环项保留既有后续 bug 循环语义。
    2. **[后端]（debug 排查/CodeGraph 层）[N24][N25]** 复现成立后 N24 分层排查，再由 N25 判定根因置信度。异常路径：CodeGraph 不可用时按既有方式降级并记录 WARN；非缺陷转 N23；多候选/低置信转 N27。
    3. **[后端]（debug 根因/链路确认层）[N27][N26]** 多候选时 N27 先等待选择根因，再进入 N26 确认对应链路；单一高置信时 N26 一次呈现根因证据与链路。异常路径：未选择或未确认前不改代码；用户修改时更新后重呈；用户拒绝时终止修复并输出诊断报告（不自动按推断继续、不标记可归档）；非缺陷转 N23。
    4. **[后端]（debug 变更归属/方案判定层）[N28][N29][N30][N31]** N28 判定变更归属，N29 评估可行方案数量；多方案走 N30 等待选择，唯一且证据充分走 N31 说明依据后直通。异常路径：非缺陷转 N23；已归档来源新建修复变更、不改归档目录；唯一性证据不足按多方案处理；多方案被拒绝或要求修改时不实现；DB/schema 的既有独立确认仍保留。
    5. **[后端]（debug 修复/测试编排层）[N32]** 按已确认方案或唯一方案实施修复，委派 `iagent_test` 并验收修复前 FAIL、修复后 PASS 及异常/根因节点覆盖。异常路径：设计问题或测试失败时暂停修复或按既有路径报告，不伪报完成。
  - **事务边界：** 本变更不新增 DB 操作或数据库事务。N31 保留既有数据库/schema 用户确认，但不定义运行时 DB 提交、回滚或事务语义。
  - **不适用层：** 本变更实现的是 debug 模板和宿主编排，无前端、API 或 DB 实现；执行层使用 `[后端]（debug 模板/确认流程）`。
  - Spec Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 高置信根因与链路一次确认
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 多候选根因先选择再确认链路
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 多个可行修复方案须等待选择
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 唯一方案凭证据直通
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 数据库/schema 确认仍保留
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 诊断确认包被拒绝

- [x] 2.2 [代码] 将 debug host phases 拆为 `investigate` → `fix` → `verify-close`；条件化多方案 gate，分离修复/回归测试 handoff 与编译、同步、验证/复查/文档桥收束，并保留一个 debug SKILL。[N26] [N30] [N32] [N33] [N34] [N35] [N37] [N41]
  - 文件：`src/core/host-orchestration/protocol.ts`、`src/core/host-orchestration/workflows.ts`、`src/core/host-orchestration/transition.ts`、`src/core/host-orchestration/index.ts`、`src/core/templates/workflows/debug.ts`
  - 验证：多方案未确认阻塞，唯一方案不触发静态阻塞；`GateSpec.condition` 与 `PhaseTransitionInput.gateConditions` 按契约落地——未声明 `condition` 的旧门保持静态行为；`gateConditions[condition] === false` 时门不适用并跳过门确认（即使 `gateConfirmed=false`）；`=== true` 或未提供时按 `gateConfirmed` 要求确认（fail-safe）；`fix` 门绑定 `'multiple-fix-options'`（多方案置 true、唯一证据充分置 false）；`investigate` handoff 含 `rootCause` / `defectChain` / `changeName`，缺失时 `fix` 不启动；`verify-close` 消费 fix receipt；阶段能力缺失按 strict/degraded 协议处理。
  - **D9 D 组顺序拆解（debug 循环、验证收束与状态 handoff，N33–N41；与任务 1.2、3.1、4.3、4.4、4.5 衔接）：**
    1. **[后端]（debug 循环/收束层）[N33][N34]** N33 判定是否还有相关 bug；有则回 N22，无/收束则 N34 统一编译检查并同步 Markdown/诊断记录。异常路径：编译遗留失败时报告；制品校验失败时修正后再验证。
    2. **[后端]（提案验证修复层）[N35][N36]** N35 执行提案验证，FAIL 转 N36 自动修复并重验。异常路径：验证技能不可用时内联评分并 WARN；N36 重跑仍 FAIL 时呈现手动编辑/返回探索/查看差异选项，不跳过验证；不补设重试上限。
    3. **[后端]（深度复查层）[N37]** 验证 PASS 后执行 proposal-review。异常路径：技能不可用时内联只读复查并 WARN；未完成复查不进入 N38。
    4. **[后端]（debug 文档桥/状态层）[N38][N39][N40]** N38 展示生成/跳过桥；生成分支直接委派 N39（成功记 `generated`），跳过分支记录 N40 的 `skipped-by-user`。异常路径：验证或复查未通过不展示文档桥；N39 失败记录 `generation-failed`、WARN 并继续；N39/N40 状态写入失败时自动重试一次，仍失败则停止该桥（不委派生成、不收束为可归档）、输出 WARN 与恢复指引，不得报告持久化成功或阶段完成。
    5. **[后端]（debug 收束/宿主回执层）[N41]** 文档生成、跳过或失败后收束并标记可归档，debug 不自动 archive，状态供后续 archive 携带或读取。异常路径：receipt 缺失/无效或状态未持久化时不得伪报相应状态已交付。
  - **事务边界：** 本组不涉及 DB 写入，DB 事务不适用。状态写入、阶段回执与后续 archive 是独立操作，不定义为同一原子事务。
  - **不适用层：** 本组无前端、API 或 DB 实现；执行层使用 `[后端]（debug 模板/宿主协议/状态层）`。
  - Spec Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / debug 阶段顺序与单一技能保持
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / 多方案门阻止 fix 阶段推进
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / 唯一证据充分方案不被静态门阻塞
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / verify-close 消费 fix 结果
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / 缺少宿主委派能力时遵循 strict/degraded
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / investigate 交付 fix 所需输入

- [x] 2.3 [代码] 将 debug 回归测试编写职责统一为委派 `iagent_test`；debug 提供复现与缺陷链路上下文，并验收修复前 FAIL、修复后 PASS 和异常/根因节点覆盖。移除重复的内联框架/测试规则。[N32]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：正文和 Guardrails 一致；debug 不再拥有与 `iagent_test` 冲突的框架/用例生成规则；Phase 1 内联临时测试不替代正式回归测试（正式回归测试须由 `iagent_test` 生成或改造落库）；strict 缺少委派能力时阻断而非"自写 + WARN"，仅显式 degraded 允许本地编写并透明记录。
  - **D9 测试执行顺序（C 组 N32 子流程）：**
    1. **[后端]（debug 模板/测试技能调用）** 向 `iagent_test` 提供已确认的复现与缺陷链路上下文。异常路径：strict 缺少委派能力时阻断；只有显式协商 degraded 时才能透明报告降级。
    2. **[后端]（测试验收层）** 确认修复前测试 FAIL、修复后测试 PASS，并覆盖异常节点与根因节点。异常路径：缺少前置失败证据、修复后仍失败或覆盖不足时，不报告测试验收通过。
  - **事务边界：** 不适用数据库事务；本任务规定测试委派与验收，不规定业务 DB 操作。
  - Spec Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 回归测试委派并由 debug 验收
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / Phase 1 内联测试不替代回归测试
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / strict 缺委派能力不降级自写

## 3. 授权与宿主调用

- [x] 3.1 [代码] 将入口意图/已确认 `nextAllowed` 映射为下一技能直接调用；更新 debug 实际委派清单，增加 requirement-doc 与 test，并核对 proposal-review、verify-proposal 与 OpenCode V2 资源权限；不扩大权限或跳过 strict/degraded 检查。[N1] [N2] [N3] [N9] [N14] [N17] [N18] [N20] [N39]
  - 文件：`src/core/host-orchestration/render.ts`、`src/core/host-orchestration/index.ts`、`src/core/opencode-v2.ts`、`src/core/templates/workflows/debug.ts`、`src/core/templates/workflows/spec-propose.ts`、`src/core/profiles.ts`、`src/core/pi-native.ts`
  - 验证：`ORCHESTRATION_DELEGATIONS.debug` 与实际调用一致；debug 白名单使用共享常量的精确裸名条目；`DEPS.debug` 含 `requirement-doc`（无条件委派随装）；Pi 编排阶段 agent 生成 `allowed_subagents` 且未安装目标记入 `nestingGaps`，并按委派性质区分：无条件必需委派缺口按能力阻断，条件委派缺口按正文已声明的 fallback/degraded 路径执行并 WARN（`test` 仅在显式协商 degraded 时允许本地编写）且不得一律阻断；`spec-propose` 白名单移除 `Skill(requirement_doc)`；宿主工具权限拒绝仍有效；不出现业务调用二次确认。
  - Spec Ref: workflow-suite-skills / 确认后的下一技能直接调用
  - Scenario Ref: workflow-suite-skills / 确认后的下一技能直接调用 / 工作流启动授权首个技能
  - Scenario Ref: workflow-suite-skills / 确认后的下一技能直接调用 / 业务确认授权唯一后继技能
  - Scenario Ref: workflow-suite-skills / 确认后的下一技能直接调用 / 宿主权限或 strict 能力不足
  - Spec Ref: host-orchestration / 已授权技能推进不增加重复业务确认
  - Scenario Ref: host-orchestration / 已授权技能推进不增加重复业务确认 / 已授权的下一技能直接调用
  - Scenario Ref: host-orchestration / 已授权技能推进不增加重复业务确认 / 宿主权限拒绝仍然有效
  - Scenario Ref: host-orchestration / 已授权技能推进不增加重复业务确认 / 非法回执或未确认的其他门阻止推进
  - Spec Ref: tool-call-whitelist / debug 文档与回归测试委派授权齐备
  - Scenario Ref: tool-call-whitelist / debug 文档与回归测试委派授权齐备 / debug 正文真实委派获得精确条目
  - Scenario Ref: tool-call-whitelist / debug 文档与回归测试委派授权齐备 / debug 授权与宿主委派表一致
  - Spec Ref: host-orchestration / Pi 编排阶段 agent 的嵌套委派授予
  - Scenario Ref: host-orchestration / Pi 编排阶段 agent 的嵌套委派授予 / 编排阶段 agent 可嵌套委派
  - Scenario Ref: host-orchestration / Pi 编排阶段 agent 的嵌套委派授予 / 委派目标未安装时不伪装严格可用

## 4. 回归测试

- [x] [测试][单元][P0] 4.1 覆盖 workflow / auto-workflow / debug 的文档桥时机、直接委派、失败/skip 状态、FAIL 不出桥及独立 verifier 不生成文档，并验证提案生成/修订重验与 guided 修改/拒绝分支。[N4] [N5] [N6] [N7] [N8] [N9] [N10] [N13] [N38] [N39] [N40]
  - 依赖：1.1
  - 文件：`test/templates.test.ts`、`test/template-derivation.test.ts`、`test/template-consistency.test.ts`、`test/profiles.test.ts`、`test/artifact-dataflow.test.ts`、`test/command-reference-refs.test.ts`
  - 验证：断言 N4 制品生成后进入验证，N5 FAIL 转 N6 修订重验，未 PASS 不进入实现或文档桥；N13 修改/拒绝时不得调用 apply；仅 PASS 与深度复查收束后展示一次文档桥；SKILL/command 派生内容一致；`spec-propose` 独立调用无生成动作且白名单无 `Skill(requirement_doc)`；`DEPS.debug` 注入 `requirement-doc` 且 `resolveWorkflows(['debug'])` 断言随之反转。
  - **P0-4 旧断言改写（MUST NOT 删除）**：`test/artifact-dataflow.test.ts` 的 A3「debug MUST NOT … requirement_doc」同句禁令、A4 `WITHOUT_REQUIREMENT_DOC=['iagent_debug']`、A5「debug 仅注入 spec-verify-proposal」，以及 `test/profiles.test.ts` 的同类断言 MUST 改写为新语义；`test/command-reference-refs.test.ts` 的条件委派表 MUST 为 `iagent_debug` 增列 `test` 并移除 `iagent_spec_propose` 的 `requirement-doc`。禁止以删除断言使测试通过。
  - Spec Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动
  - Scenario Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动 / PASS 与深度复查后由父编排器询问文档选择
  - Scenario Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动 / 用户确认生成后直接委派
  - Scenario Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动 / 用户跳过后继续原流程
  - Scenario Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动 / 验证失败时不展示需求文档桥
  - Spec Ref: workflow-suite-skills / 编排技能的委派与派发白名单齐备性
  - Scenario Ref: workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / auto-workflow 委派与派发条目齐备
  - Scenario Ref: workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / workflow 委派条目齐备
  - Scenario Ref: workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / debug 委派条目齐备且无幽灵项
  - Scenario Ref: workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / auto-migration 委派条目齐备
  - Scenario Ref: workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / 调用 CodeGraph 的编排技能含 MCP 条目
  - Scenario Ref: workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / 白名单无幽灵条目
  - Spec Ref: workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更
  - Scenario Ref: workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更 / 独立指令仍可手工调用
  - Scenario Ref: workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更 / 三个父工作流可在生成分支调用
  - Scenario Ref: workflow-suite-skills / 需求文档技能的手工调用保留与自动调用方变更 / spec-propose 独立调用不自动生成
  - Spec Ref: skill-profile / 依赖注入
  - Scenario Ref: skill-profile / 依赖注入 / 漏选归档前验证
  - Scenario Ref: skill-profile / 依赖注入 / 漏选归档需求文档技能
  - Scenario Ref: skill-profile / 依赖注入 / 批量归档同时补两依赖
  - Scenario Ref: skill-profile / 依赖注入 / 默认集安装 9 项
  - Scenario Ref: skill-profile / 依赖注入 / 漏选提案评分门
  - Scenario Ref: skill-profile / 依赖注入 / 漏选迁移子技能
  - Scenario Ref: skill-profile / 依赖注入 / 仅补缺失项
  - Scenario Ref: skill-profile / 依赖注入 / debug 注入需求文档技能
  - Scenario Ref: skill-profile / 依赖注入 / debug 注入结果稳定
  - Scenario Ref: skill-profile / 依赖注入 / workflow 阶段技能传递注入
  - Scenario Ref: skill-profile / 依赖注入 / 编排器委派探索技能随装
  - Scenario Ref: skill-profile / 依赖注入 / 编排器委派提案技能随装
  - Scenario Ref: skill-profile / 依赖注入 / apply 不触发注入

- [x] 4.2 [测试][单元][P0] 覆盖 archive 的 skip 缺失、skip 已有文档、generation-failed 不重试、generated 缺失不重建、历史无状态兼容生成、跨会话状态恢复、状态读取重试一次后失败与人工域保护。[N42] [N43] [N44] [N45] [N46] [N47]
  - 依赖：1.3
  - 文件：`test/templates.test.ts`、`test/template-derivation.test.ts`、`test/artifact-dataflow.test.ts`
  - 验证：状态矩阵逐支断言（含 `generated` 缺失与读取失败不落入兼容生成）；已有文件分支不调用静默覆盖生成器；单变更与批量归档同义。
  - Spec Ref: spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 用户跳过且文档缺失时不补生成
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 用户跳过但文档已存在时对齐
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 生成失败状态不静默重试
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 已生成状态但文档缺失不重建
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 状态读取重试一次后失败不落入兼容生成
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 历史变更无状态时兼容生成
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 文档存在时人工域受保护
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / archive 单独调用时读取持久状态
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 需求文档处理失败不阻断归档
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 探索记忆同步
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / delta spec 智能合并
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / CodeGraph 同步非阻塞
  - Spec Ref: spec-bulk-archive-skill / 归档单元执行序列
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 完整单元序列
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 归档时生成需求文档
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 已存在的需求文档就地增量对齐
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 用户跳过后不补生成
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 生成失败或已生成状态不重试
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 生成失败不中止批次
  - Scenario Ref: spec-bulk-archive-skill / 归档单元执行序列 / 探索记忆同步跳过
  - Spec Ref: template-generation / 归档阶段需求文档行为
  - Scenario Ref: template-generation / 归档阶段需求文档行为 / 归档时需求文档已存在则增量对齐
  - Scenario Ref: template-generation / 归档阶段需求文档行为 / 文档缺失时按状态分流
  - Scenario Ref: template-generation / 归档阶段需求文档行为 / 状态读取失败不落入兼容生成

- [x] [测试][单元][P0] 4.3 覆盖 debug 输入校验、复现/非缺陷分支、CodeGraph 降级、根因/链路确认、多方案阻塞、唯一证据方案直通、iagent_test 委派、强制回归验收及 N36 验证失败修复重验。[N21] [N22] [N23] [N24] [N25] [N26] [N27] [N29] [N30] [N31] [N32] [N36]
  - 依赖：2.1、2.3
  - 文件：`test/templates.test.ts`、`test/template-derivation.test.ts`、`test/template-consistency.test.ts`
  - 验证：断言无法复现/非缺陷时不修改代码、CodeGraph 不可用时显式降级；N36 重验仍 FAIL 时不得跳过；正文不残留冲突的 inline/delegate 规则（含 Phase 1 临时测试与正式回归测试的边界）；拒绝诊断确认包时终止修复；command 派生同步包含防护语句。
  - Spec Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 高置信根因与链路一次确认
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 多候选根因先选择再确认链路
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 多个可行修复方案须等待选择
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 唯一方案凭证据直通
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 回归测试委派并由 debug 验收
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 数据库/schema 确认仍保留
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 诊断确认包被拒绝

- [x] [测试][单元][P0] 4.4 覆盖 verify → apply → archive 的状态 handoff、跨会话恢复、N15 实现验证、N19 测试门与实现验证、debug 三阶段序列、条件 gate、receipt/能力校验与确认后的直接推进。[N10] [N14] [N15] [N17] [N19] [N20] [N30] [N35] [N41] [N42]
  - 依赖：1.2、2.2、3.1
  - 文件：`test/host-orchestration.test.ts`、`test/claude-host-adapter.test.ts`、`test/opencode-v2.test.ts`、`test/pi-native.test.ts`
  - 验证：断言 N15 失败返回修复、N19 失败按既有预算处理；旧静态 gate 和 receipt 行为不回退；新阶段/条件 gate 在各宿主语义一致，并断言条件门矩阵：`condition` 未声明 → 旧静态行为不变；`gateConditions[condition]=false` → 门不适用（不因 `gateConfirmed=false` 阻塞）；`=true`/未提供 → 按 `gateConfirmed` 阻塞（fail-safe）；`fix` 门绑定 `'multiple-fix-options'`；`investigate` → `fix` handoff 字段齐备；Pi 阶段 agent 的 `allowed_subagents` 与 `nestingGaps` 生效，且断言缺口分流（无条件委派按能力阻断；条件委派走正文降级路径并 WARN，`test` 仅显式 degraded 允许本地）；strict 缺能阻断且 degraded 显式。
  - Spec Ref: host-orchestration / 需求文档状态跨阶段 handoff
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / 桥写入四种结果
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / 状态写入重试一次后失败
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / 状态读取重试一次后失败
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / 状态穿过 guided apply 到 archive
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / auto-workflow 状态穿过自动 apply 到 archive
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / debug 后续独立 archive 恢复状态
  - Scenario Ref: host-orchestration / 需求文档状态跨阶段 handoff / 历史变更无状态保持兼容
  - Spec Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / debug 阶段顺序与单一技能保持
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / 多方案门阻止 fix 阶段推进
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / 唯一证据充分方案不被静态门阻塞
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / verify-close 消费 fix 结果
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / 缺少宿主委派能力时遵循 strict/degraded
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / investigate 交付 fix 所需输入
  - Scenario Ref: host-orchestration / debug host protocol 拆分 fix 与 verify-close / 条件门适用性与旧门默认行为
  - Spec Ref: host-orchestration / 已授权技能推进不增加重复业务确认
  - Scenario Ref: host-orchestration / 已授权技能推进不增加重复业务确认 / 已授权的下一技能直接调用
  - Scenario Ref: host-orchestration / 已授权技能推进不增加重复业务确认 / 宿主权限拒绝仍然有效
  - Scenario Ref: host-orchestration / 已授权技能推进不增加重复业务确认 / 非法回执或未确认的其他门阻止推进
  - Spec Ref: host-orchestration / Pi 编排阶段 agent 的嵌套委派授予
  - Scenario Ref: host-orchestration / Pi 编排阶段 agent 的嵌套委派授予 / 编排阶段 agent 可嵌套委派
  - Scenario Ref: host-orchestration / Pi 编排阶段 agent 的嵌套委派授予 / 委派目标未安装时不伪装严格可用

- [x] 4.5 [测试][单元][P0] 覆盖 debug `Skill(requirement_doc)` / `Skill(test)` 精确授权、宿主 delegation 与项目权限同步、无幽灵条目且写类/Bash 授权面不扩张。[N9] [N32] [N39]
  - 依赖：3.1
  - 文件：`test/tool-whitelist-constants.test.ts`、`test/allowed-tools.test.ts`、`test/opencode-v2.test.ts`
  - 验证：使用共享 `skillDelegation`；无通配、死条目或权限扩大。
  - Spec Ref: tool-call-whitelist / debug 文档与回归测试委派授权齐备
  - Scenario Ref: tool-call-whitelist / debug 文档与回归测试委派授权齐备 / debug 正文真实委派获得精确条目
  - Scenario Ref: tool-call-whitelist / debug 文档与回归测试委派授权齐备 / debug 授权与宿主委派表一致
  - Scenario Ref: tool-call-whitelist / debug 文档与回归测试委派授权齐备 / 最小权限保持
  - Spec Ref: tool-call-whitelist / 归档技能的需求文档委派条目
  - Scenario Ref: tool-call-whitelist / 归档技能的需求文档委派条目 / spec-archive 具备需求文档委派条目
  - Scenario Ref: tool-call-whitelist / 归档技能的需求文档委派条目 / spec-bulk-archive 具备需求文档委派条目
  - Scenario Ref: tool-call-whitelist / 归档技能的需求文档委派条目 / 指令侧白名单同步派生
  - Scenario Ref: tool-call-whitelist / 归档技能的需求文档委派条目 / 嵌套委派不使外层白名单虚增
  - Scenario Ref: tool-call-whitelist / 归档技能的需求文档委派条目 / 未使用条目被剔除

## 5. 生成产物与交付记录

- [x] 5.1 [代码] 运行构建并重新生成模板快照，使 `skills/` 与模板字节级一致。[N9] [N39]
  - 依赖：1.1、1.3、2.1、2.3、3.1
  - 文件：`skills/`
  - 验证：`pnpm build && pnpm generate:skills`；`test/skills-parity.test.ts` 通过。
  - Spec Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动
  - Scenario Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动 / 用户确认生成后直接委派
  - Spec Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / 回归测试委派并由 debug 验收
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / Phase 1 内联测试不替代回归测试
  - Scenario Ref: workflow-suite-skills / debug 修复方案确认与回归测试职责 / strict 缺委派能力不降级自写

- [x] 5.2 [代码] 按 AGENTS 项目规则将 `package.json` 版本号递增 minor（模板行为变更），并检查所有版本示例保持一致。[N42]
  - 依赖：1.1、1.2、1.3、2.1、2.2、2.3、3.1
  - 文件：`package.json`、`README.md`（如包含当前版本示例）
  - 验证：包版本与新模板产物生成器版本一致。
  - Spec Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动
  - Scenario Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动 / 用户跳过后继续原流程

- [x] 5.3 [使用说明] 将 `[Unreleased]` 累积条目归档到本次 minor 版本的 changelog 小节并更新 compare 链接。
  - 产出: `CHANGELOG.md`
  - 流程节点：[N42]
  - 依赖：5.2
  - 验证：保留空的 `[Unreleased]` 小节，版本日期与链接定义有效。
  - Spec Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动
  - Scenario Ref: workflow-suite-skills / workflow 自动验证门与深度复查联动 / 用户跳过后继续原流程
