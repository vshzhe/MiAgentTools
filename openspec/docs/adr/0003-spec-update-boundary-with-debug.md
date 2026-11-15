# ADR-0003: `spec-update` 与 `iagent_debug` 的职责边界（双轨根因定位）

- **状态**：已接受（2026-11-14，变更 `2026-11-14-add-spec-update-capability`，裁决 D4）
- **背景**：仓库既有 `iagent_debug`（`src/core/templates/workflows/debug.ts:214`）的正文已声明「复现 → 用 CodeGraph 与能力记忆调查根因 → 变更关联 → 带强制回归测试的修复 → 编译检查 → **同步提案** → 验证」，即已存在一条完整的缺陷修复闭环。本次新增的 `spec-update`（`iagent-spec-update`）诉求同样是「实现完成并测试后出问题 → 探索分析 → 更新提案 → 再实现优化 → 能力测试对比」，二者表面高度重叠；若不显式划界，将出现两套并行修复闭环，委派白名单与 skill description 的 `NOT for` 排歧也将互相矛盾（两个技能都声称覆盖「修 bug」）。差异点有三：① 起点不同（debug 以孤立 bug 报告为起点，spec-update 以**已实现的变更**为起点）；② 提案处理不同（debug 的「同步提案」是修复后的**附属同步**，spec-update 的「更新提案」是**主体动作**，且载体为原地改写既有制品 + 修订痕迹）；③ 验证口径不同（debug/verify 比「实现 vs 制品」，spec-update 比「修复前 vs 修复后」的能力表现）。
- **决策**：采用**双轨**根因定位——`spec-update` 默认执行**轻量三方差异定位**（变更制品 ↔ 实际实现 ↔ 用户测试现象），仅当轻量定位无法给出结论时**降级委派** `iagent_debug` 做深度根因分析；两者皆无结论时输出「根因未定位」报告并不改任何制品，停在探索阶段出口。边界同时写入 `spec-update` 的 skill `description` 排歧（`NOT for 根因排查` 指向 `iagent_debug`）与 `iagent_debug` 的对向排歧。
- **理由**：复用 `iagent_debug` 的既有 6 维根因深度分析（CodeGraph 爆炸半径 + 跨模块判定）可避免重复建设，同时用「轻量优先」控制绝大多数「测试发现问题」场景的耗时；但**完全委派 debug** 会让最常见的「现象与规格对不上」场景付出全量排查代价，**完全自建**则复制既有能力并制造第二个真相源。双轨在「常见路径轻量、疑难路径复用」之间取得平衡，且降级路径是显式的，不会把本地执行伪装为委派完成（符合 `backend-design.md` 的 fail-safe 委派约定）。
- **影响**：
  - `spec-update` 的 `allowedTools` MUST 同时持 `Skill(iagent-spec-debug)` 精确条目与 CodeGraph 只读检索条目；MUST NOT 使用 `Skill(*)`。
  - `spec-update` 的 `description` MUST 含对 `iagent_debug` 的 `NOT for` 排歧句；`iagent_debug` 的 description 是否补对向排歧列为可选后续（避免改动既有技能 description 触发 `skills-parity` 之外的额外回归面），默认不动。
  - 「能力测试对比」是 `spec-update` 的独占能力（对比制品 `capability-comparison.md`），不复用 `spec-verify` 的三维度口径，避免与既有验证语义混淆。
  - 不引入新的跨变更索引能力（ADR-0002 已退役跨变更索引），「定位受影响变更」只依赖 `openspec/changes/` 目录遍历与 `iagent spec status`。
- **备选方案**（否决）：① 完全委派 `iagent_debug` —— 常见场景付出全量根因排查代价，且提案修订与能力对比仍无处安放；② 完全自建根因分析 —— 复制 `iagent_debug` 的 6 维分析能力，形成第二真相源，违反单一真源约定；③ 不新增技能、直接扩展 `iagent_debug` 增加「更新提案 + 能力对比」阶段 —— 与 D1（新增独立技能）冲突，且 `iagent_debug` 的起点语义（孤立 bug）无法自然覆盖「变更已实现后的系统性修订」。
- **恢复方式**：若轻量差异定位在实际使用中反复失败（降级率过高），可将默认路径切换为委派 `iagent_debug`，仅需调整 `spec-update` 正文与 `allowedTools`，不影响制品载体与对比口径。
