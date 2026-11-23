---
name: iagent-spec-update
description: "修订已实现的变更。当用户在变更已完成提案与实现、测试后发现问题时使用：对测试问题做探索分析 → 原地更新提案制品 → 再实现优化 → 修复前后能力测试对比；触发词\"修订变更 / update / 提案修订 / 修复闭环 / 更新提案\"；NOT for 新建变更提案（改用 iagent-spec-propose）、NOT for 实现未完成的变更（改用 iagent-spec-apply）、NOT for 孤立缺陷的根因排查（改用 iagent-debug）。"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(node:*), Bash(codegraph:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(iagent-spec-apply), Skill(iagent-spec-verify), Skill(iagent-test), Skill(iagent-debug)
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）。
metadata:
  author: mi-agent-tools
  type: spec
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:9fd2bb059dbc4e95e04e03be8c35ff520f39196261fec42da51beeac90f13f90"
---

**修订已实现的变更。** 适用场景：变更已完成提案与实现、用户测试后发现问题 —— 对测试问题做探索分析 → 在**同一变更身份**内原地更新提案制品 → 再实现优化 → 修复前后能力测试对比。

## ⛔ GATE PROTOCOL — ACTIVE

本技能包含以 **⛔ GATE:** 标记的**确认门**。每个门都是硬性停止点：
- 走到 ⛔ GATE 时，**本次响应到此结束** —— 输出门内容后立即停止
- 不得执行、描述或预生成门之后的任何步骤
- 用户的下一则消息即为确认信号 —— 仅在其响应后从门之后继续
- **非门动作 MUST NOT 停止，也 MUST NOT 请求确认**：阶段宣告 / 技能委派（含「是否调用 <技能>」）/ 只读扫描 / CodeGraph 查询 / 状态查询 / 只读校验的「是否运行 <校验>？」询问，均不是确认门
- **只有**门白名单（见「门白名单与 MUST NOT 确认清单」段）声明的 5 类门可以阻断推进；白名单外的动作 MUST NOT 被实现为停止点
- **违规**：未经用户确认而执行门之后的步骤，是破坏工作流的严重错误

## 门白名单与 MUST NOT 确认清单

**必留门（正向枚举 5 类，缺一即流程安全缺陷）**：
- **需求澄清（需求 / 方案歧义）**：prompt-gate / grill-batch-confirmation / diagnostic-confirmation / fix-option-confirmation / design-confirmation（可按条件豁免）
- **功能流程图门（流程基准确认）**：flow-final-confirmation（不可豁免）
- **实现 + 测试桥**：implementation-bridge（不可豁免）
- **归档桥**：archive-confirmation（不可豁免）
- **破坏性改动确认（动作级，不可豁免：删除目录 / 覆盖既有制品 / 改写版本库跟踪 / 不可逆命令）**（不可豁免）

**MUST NOT 请求确认（非门动作，MUST NOT 被实现为停止点）**：
- 阶段宣告（如「进入 Phase N」「本阶段开始」）
- 技能委派（含「是否调用 <技能>」类询问）—— 已授权的 nextAllowed 技能直接委派
- 只读扫描（Glob / Grep / Read 与只读查询）
- CodeGraph 查询与能力探测（含锁阶梯只读复用）
- 状态查询（`iagent spec status` / `getChangeStatus` 等）
- 只读校验的「是否运行 <校验>？」询问（如技术栈专项校验）—— 直接执行并在报告中说明校验项

> 跨变更索引重建类动作已随索引能力退役（DEC-2），不构成任何门或动作。

**输入**：`<变更名>` + `<测试问题描述>`（两项必填；缺任一项 MUST 先提示补齐再进入流程，MUST NOT 猜测变更名）。

## 四环节闭环（顺序固定：MUST NOT 重排 / 跳过 / 颠倒）

| 环节 | 节点 | 动作 | 出口 |
| :--- | :--- | :--- | :--- |
| 1 探索分析 | N1–N11 | 轻量差异定位 →（无结论）降级委派 `iagent-debug` → 根因结论 | 根因未定位 → 停在 N10，不改任何制品 |
| 2 更新提案 | N12–N16 | 修订清单 → ⛔ 破坏性改动确认门 → 原地改写 + `revision.md` → 失败回滚 | 门拒绝 / 回滚 → 停在「更新提案」阶段 |
| 3 再实现优化 | N17 | 委派 `iagent-spec-apply` 承接修订后的任务清单调度 + 编译检查 + 测试执行关卡 | apply 回执 `fail` → 暂停并报告 |
| 4 能力测试对比 | N18–N22 | 产出 `capability-comparison.md` → 委派 `iagent-spec-verify` 三维度一致性验证 → 结论判定 → 结构化回执 | 对比结论 FAIL → 标 FAIL 且不进入归档出口 |

## Step 0 前置校验（阻断条件，先于任何写操作）

1. **变更必须存在**：`openspec/changes/<变更名>/` 不存在 → 阻断并报告「变更不存在」，MUST NOT 自建变更目录后继续。
2. **实现必须已完成**：运行 `iagent spec status --change "<变更名>" --json`，`progress.remaining` MUST 为 `0`（`progress` 为 `null` 时视为未完成，同样阻断）。
   - 未完成 → 阻断并提示先走 `iagent-spec-apply`；MUST NOT 改写任何制品，MUST NOT 提供「跳过检查 / 继续修订」一类出口。

## Step 1 归档态判定与复活复制（N4–N5）

- 判定目标变更是否位于 `openspec/changes/archive/` 下。
- 已归档 → MUST 先复制为新变更 `update-<原名>-<YYYYMMDD>` 再继续修订；**原归档目录 MUST 保持不动**（不改写 / 不移动 / 不删除其中任何文件）。
  - 复制 MUST 用跨平台方式（`node -e "require('node:fs').cpSync(<源>, <目标>, { recursive: true })"`）；MUST NOT 依赖 `cp -r` / `xcopy` 等平台专有命令。
  - 复制失败 → 阻断并报 WARN，终止本轮，MUST NOT 在残缺副本上继续修订。
- 未归档 → 直接进入 Step 2。

## Step 2 双轨根因定位（N6–N10）

- **默认路径（轻量差异定位）**：比对三方 —— 变更制品 ↔ 实际实现 ↔ 用户测试现象（可用 `Glob` / `Grep` / `Read` 与 CodeGraph 检索）。得出高置信根因 → 直接产出根因结论，MUST NOT 额外发起 debug 委派。
- **降级路径**：轻量定位**无结论**时 MUST 降级委派 `iagent-debug` 做深度根因分析，并在结果中标注本次走的是降级路径。
  - 委派**未真正发生**（宿主能力缺失 / 技能不可得）时 MUST NOT 表述为「委派完成」，MUST 按「根因未定位」处置。
- **未定位出口**：轻量与降级路径均无结论 → 输出「根因未定位」报告并**停在探索阶段出口**：MUST NOT 改写任何制品，MUST NOT 生成修订清单。

## Step 3 根因结论与修订清单（N11–N12）

- 产出根因 + 影响面结论（根因、影响范围、与用户现象的对应关系）。
- 生成**修订清单**（改哪些制品 / 改哪些段），模板见 `references/update-protocol.md`；清单 MUST 在进入确认门前完整呈现给用户。

## ⛔ GATE: 破坏性改动确认门（N13）—— 动作级，不可豁免

- 本门归门白名单第 5 类 `destructive-change`（覆盖既有制品），MUST NOT 自造第 6 类门。
- 呈现修订清单后**硬停止**：本次响应到此结束，等待用户显式确认；用户的下一则消息即为确认信号。
- 用户**确认** → 进入 Step 4 原地改写，改写范围 MUST 与修订清单一致。
- 用户**拒绝** → 记录拒绝并停在「更新提案」阶段：MUST NOT 改写任何制品，MUST NOT 提供「跳过门继续」一类出口。

## Step 4 原地改写与修订记录（N15）

- MUST 在**同一变更身份**内原地改写既有变更的 Markdown 制品；MUST NOT 把修订分叉到一条平行的新变更。
- 改写顺序：`proposal.md` → `specs/**` → `design.md` → `tasks.md`。
- 改写 MUST NOT 引入 `change.json` / `tasks.json`（Markdown 为唯一真源）。
- 改写成功后 MUST 在变更目录内**追加** `revision.md`（问题现象 → 根因 → 修订点 → 影响制品 → 来源）；MUST NOT 覆盖历史修订记录（连续多次修订各占一条）。

## Step 5 改写失败回滚（N16）

- 改写前 MUST 逐个读取目标制品原文存入**内存副本**（写前快照）。
- 任一制品写入失败 → 用内存副本逐个还原已改写制品，报 WARN，**停在「更新提案」阶段**：MUST NOT 留下半改写状态，MUST NOT 进入再实现优化环节，MUST NOT 委派 `iagent-spec-apply`。

## Step 6 再实现优化（N17）

- MUST 委派 `iagent-spec-apply` 执行再实现优化（承接修订后的任务清单调度 + 编译检查 + 测试执行关卡），MUST NOT 自建一套实现调度。
- 委派走精确技能条目（MUST NOT 使用通配）。
- apply 回执 `failed` / `blocked` → 暂停并报告，MUST NOT 进入能力测试对比环节。

## Step 7 能力测试对比（N18）

- MUST 产出变更目录内的 `capability-comparison.md`（能力 → 修复前表现 → 修复后表现 → 证据位置 → 结论），模板见 `references/update-protocol.md`。
- **修复前基线**在 Step 2 轻量差异定位阶段落盘（此时是唯一可得的观测值），**修复后表现**在本环节追加。
- MUST 委派 `iagent-test` 生成并执行对比用例（测试层级：单元；优先级：P1）。
- 本对比 MUST NOT 替代或复用 `spec-verify` 的三维度口径（Completeness / Correctness / Coherence）—— 两者互补。

## Step 8 一致性验证与对比结论（N19–N21）

- MUST 委派 `iagent-spec-verify` 做三维度一致性验证。
- 对比结论为 **FAIL**（修复引入新缺陷 / 回归测试失败）→ MUST 在对比表中标 FAIL 并列出新引入的问题，MUST NOT 进入归档出口（停在修复后验证阶段，等待用户裁决）。
- 对比结论为 **PASS** → **验证后自动合并**（见下段），然后进入 Step 9。

**验证后自动合并（强制；语义见 `references/branch-isolation.md`）**

读 `## 分支状态`，`branchMode=work-branch` 才执行。授权 = Step 8 **验证 PASS**；回执带 `mergeAuthorized` / `mergeResult`，**MUST NOT 写 `## 已确认门`**（域外 id 触发 `invalid-receipt`）。`iagent git merge <branch> --into <baseBranch> --json` → 成功删分支（失败仅 WARN）；**冲突暂停列清单，MUST NOT abort**，冲突不构成验证失败；非冲突失败 WARN。不新增停点。全文见 `references/branch-isolation.md`。

## Step 9 结构化回执（N22）

流程收束时 MUST 输出结构化阶段回执（字段：`phase` / `status` / `artifact` / `nextAllowed`），MUST NOT 以面向用户的会话小结替代回执：

```
phase: spec-update
status: ok | blocked | failed | incomplete
artifact: <变更目录路径> / <revision.md> / <capability-comparison.md>
nextAllowed: <下一步允许动作>
```

## 参考资料

- 修订清单模板、`revision.md` 条目模板、`capability-comparison.md` 对比表模板 → `Read references/update-protocol.md`

## Guardrails

- 四环节顺序 MUST NOT 重排、跳过或颠倒；每个出口（MUST NOT 提供「跳过」一类出口）。
- 破坏性改动确认门 MUST NOT 被实现为可豁免，也 MUST NOT 归入既有 5 类之外的新类别。
- 根因未定位时 MUST NOT 修改任何制品。
- 降级委派 MUST 诚实：未真正发生的委派 MUST NOT 表述为「委派完成」。
- `revision.md` MUST 追加写入，MUST NOT 覆盖历史修订记录。
- 改写部分失败 MUST 整体回滚，MUST NOT 留下半改写状态。
- MUST NOT 创建 `change.json` / `tasks.json`。
- MUST NOT 改动原归档目录。
- 能力测试对比 MUST NOT 复用 `spec-verify` 三维度口径；对比结论 FAIL 时 MUST NOT 进入归档出口。
- 本技能**不执行归档**：归档由 `iagent-spec-archive` 承接，本技能只交出对比结论与回执。
