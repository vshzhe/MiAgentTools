## Why

`venus_spec_apply` 的批次调度（每 dispatch unit 派发一个子代理）与 `venus_tr_impl_auto_workflow` / `venus_tr_impl_workflow` 的多项目 CodeGraph 扫描，都存在**派发多子代理时 token 消耗随派发单元数成倍放大**的问题。实测锚点（探索阶段证据，见 `exploration.md`）：

1. **每个子代理重复读同一批制品**：调度指令 MUST 内联「每任务全量细节 + context 文件列表 + ai-coding 规范摘要」（`spec-apply.ts:170-176`），子代理再各自去读同一批 proposal/specs/design → N 个单元读 N 遍。
2. **跨批次零信息共享**：无产出登记表，下一批子代理无从知道前序单元产出了什么文件与接口，只能重扫代码库。
3. **回执未约束**：仅要求「报告完成状态 + 产出文件列表」（`spec-apply.ts:176`），未禁止粘贴代码正文，回执把协调者侧上下文再次撑大。
4. **多项目扫描顺序 spawn N 个子代理**（`tr-impl-auto-workflow.ts:312-315`、`tr-impl-workflow.ts:363-383` 明文 "sequentially"）：**无并行收益却有 N 次冷启动** —— 纯浪费。
5. **debug 调试循环逐轮重跑同一区域的 CodeGraph 查询**：诊断记录仅实时记录、Phase 6 才落盘（`tr-impl-debug.ts:339`），循环回边「Re-enter Phase 1 … independent investigation」使 2.2.1–2.2.3 查询被逐轮重复。
6. **auto-migration 的规范要点内联注入**（`tr-impl-auto-migration.ts:56`）是同一类冗余：每单元重复内联规范块。

同时发现**规格缺口**：`spec-workflow-skills` 的 spec-apply 需求只覆盖「呈现统一批次计划」，派发单元 / 子代理派发 / 并发上限 / 调度指令内容 / 临时工作区协议**全部无规格覆盖**；`tr-workflow-suite-skills` 的 auto-workflow 需求也只说「执行 apply 的 Step 6+ 批次调度行为」。本次一并补齐。

## What Changes

引入**共享资源协议**（四载体），并把同类冗余一处不留地收敛：

1. **共享上下文包（context pack）**：协调者在首次派发前**一次性**产出 `context-pack.md` 于流程级临时工作区，含六节 —— `## 变更摘要` / `## 契约`（接口签名 · 数据结构 · 表字段）/ `## 规范要点`（`openspec/rules/ai-coding.md` 蒸馏一次）/ `## 文件归属表`（单元→允许改动文件）/ `## Codebase 摘要`（协调者预扫描结论）/ `## 已产出（跨单元可见）`。子代理的**唯一必读制品**。
2. **产出登记表（output ledger）**：包内 `## 已产出` 节，每批完成后协调者**追加**该批产出文件与公开签名，使后续批次无需重扫代码。
3. **回执最小化**：子代理回执固定四列 `<任务 id> | <状态> | <产出文件> | <公开签名>`，**MUST NOT 粘贴代码正文**；失败任务仍须含失败原因摘要。
4. **共享指令前缀**：调度指令固定为「共享前缀（包路径 / 规范要点引用 / 回执格式 / 禁止项）→ 单元差异（本单元任务清单）」，同流程内前缀字节一致。
5. **调度指令瘦身**：Step 6.5 必含清单改为「包路径 + 本单元任务清单 + 回执格式 + 禁止项」；**移出**内联规范摘要（改引用包 `## 规范要点`）。任务的**细节**仍在指令内联，保证子代理无需读 tasks.md。
6. **禁止项 + 包缺口回执**：子代理 MUST NOT 重读 proposal/specs/design、MUST NOT 重跑包已覆盖的 CodeGraph 查询；MAY 查包未覆盖内容，但回执 MUST 附**包缺口回执**（缺什么、补查了什么），协调者据以回填包。
7. **多项目扫描单代理化**：`auto-workflow` 与 `workflow` 的 1.2.1.5 由「每项目一个子代理」改为「**单个子代理内串行扫描全部待查项目**」；失败/超时降级**按项目粒度**保留。
8. **debug 探查摘要共享**：新增 `.openspec-tmp/debug-<keyword>/investigation-digest.md`；Phase 2 起始先读（存在时）→ 同范围命中结论直接复用、MUST NOT 重跑已覆盖的 2.2.1–2.2.3 查询；2.2.1–2.2.4 每步结论**增量写入**（与既有实时写诊断记录并行，不替代）；调试循环回边同样先读；Phase 7 收尾统一清理（非缺陷退出路径亦适用）。
9. **auto-migration 规范要点改写入包**：Phase 3 的「子代理指令注入目标项目规范要点」改为「写入包的 `## 规范要点` 节（作为附加来源合并）」，消除同类重复内联。
10. **fail-safe 降级**：工作区不可写 / 包产出失败 / 项目无 `openspec/rules/ai-coding.md` → **退化为既有内联注入行为 + WARN，绝不阻断实现**。`auto-mode=true` 只跳过 Step 5.5 确认门，**包机制照常生效**。单任务批次（<2 派发单元）由协调者直接实现，**不产出包**。

**不在本次范围（已知落差）**：`venus_spec_propose`（每 capability 一子代理生成 delta spec）与 `venus_spec_bulk_archive`（每变更一子代理）的派发同样存在同类冗余，但采用不同的派发粒度，**本次不同步**；`venus_tr_impl_genfull` 无派发、无 1.2.1.5、无实现阶段，**零改动**。

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

- `spec-workflow-skills`: spec-apply 新增「派发协议与共享资源协议」需求（补齐既有规格缺口）—— 定义派发单元 / 并发上限 / 上下文包六节 / 产出登记表 / 回执最小化 / 共享指令前缀 / 禁止项与缺口回执 / fail-safe 降级 / 单任务批次不产出包 / auto-mode 不豁免。
- `tr-workflow-suite-skills`: 三处需求变化 —— ① auto-workflow Phase 4 显式声明继承 apply 共享资源协议（MUST NOT 另立派发指令格式）；② auto-workflow 与 workflow 的 1.2.1.5 多项目扫描改为单子代理串行扫描；③ debug 新增流程级探查摘要共享协议（先读复用 + 增量写入 + 收尾清理）。
- `tr-migration-skills`: auto-migration Phase 3 的规范要点注入改为写入包的 `## 规范要点` 节（作为附加来源合并），消除同类重复内联。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/spec-apply.ts`: 单一源正文 —— 新增共享资源协议段（包六节 / 产出登记表 / 回执格式 / 共享指令前缀 / 禁止项与缺口回执 / fail-safe 降级），改造 Step 6.5 必含清单（移出内联规范摘要）。command 版由 `deriveCommandContent` 自动派生，**单改 skill 正文**。
- `src/core/templates/workflows/tr-impl-auto-workflow.ts`: **双处同步**（skill 正文 + 手写 command 正文）—— §4.1 新增继承声明句；1.2.1.5 改为单子代理串行扫描。
- `src/core/templates/workflows/tr-impl-workflow.ts`: **双处同步** —— 1.2.1.5 改为单子代理串行扫描（与 auto-workflow 保持同构一致）。
- `src/core/templates/workflows/tr-impl-debug.ts`: **双处同步** —— 新增探查摘要共享协议段（2.1.5 节 + 各 2.2.x 步的增量写入 + Phase 7 收尾清理步）。
- `src/core/templates/workflows/tr-impl-auto-migration.ts`: **双处同步** —— Phase 3 规范要点注入改为写入包的 `## 规范要点` 节。
- `test/`: 新增结构指标断言（A1–A7）+ 既有测试面核对（`templates.test.ts` 的 debug 断言不得含 `| 异常路径 |` 列头）。
- `skills/`: 静态快照，改动后 `pnpm build && pnpm generate:skills` 重生成（否则 `skills-parity.test.ts` 失败）。
- `package.json` / `CHANGELOG.md`: 按 AGENTS.md 守则 8 递增版本号（本类改动 minor）并归档 `[Unreleased]`。
- `openspec/CONTEXT.md`: 归档时补充 7 个新术语（派发单元 / 共享上下文包 / 产出登记表 / 回执最小化 / 共享指令前缀 / 包缺口回执 / 探查摘要）。

**不修改**：`derive-command.ts`（`deriveCommandContent` 仅覆盖 7 个 `spec-*.ts`，自动继承新正文）、`prompt-gate.ts` / `flowchart-gate.ts`（共享内联源，爆炸半径大且与本需求无关）、`registry.ts` / `profiles.ts`（注册结构与技能总数 27 不变）、三个技能的 `allowedTools`（不新增任何命令）、`tr-impl-genfull.ts`。

### 向后兼容

无破坏性变更。共享资源协议是**派发层行为增强**，全部新增机制均带 fail-safe 降级路径（工作区不可写 / 规范文件缺失 / 无子代理能力 → 退化为既有行为 + WARN）。单任务批次与 auto-mode 的运行语义不变。目标项目中已安装的旧版技能产物由 `venus update` 按内容指纹正常升级。
