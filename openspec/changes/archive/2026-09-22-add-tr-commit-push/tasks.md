# Tasks: add-tr-commit-push

## 1. 技能模板实现

- [x] 1.1 [代码] 新建 src/core/templates/workflows/tr-commit-push.ts，实现 getTrCommitPushSkillTemplate——技能正文完整迁移源 SKILL（C:\Users\venus\Downloads\tr-commit-push\tr-commit-push\SKILL.md）：强制约束（仅显式触发/四环节确认/执行中白名单/密码只进内存与 stdin 失败一次即停）、交互流程（四环节逐环节确认）、提交范围排除（最高优先级与 ?/A/M 分策略）、十前缀规范与菜单归属标注、提交执行阶段（完整性检查/UTF-8 无 BOM 落盘/证书与凭据处理/提交/双验证/知识库推送/汇报）
  - 文件：`src/core/templates/workflows/tr-commit-push.ts`
  - 验证：源 SKILL 逐章节对照，防护约束（凭据/编码/白名单）逐条核对无遗漏；name=venus_tr_commit_push、type=tr_commit、指令派生 id=tr-commit-push；allowedTools 含 Bash(svn:*)、Bash(powershell:*)（源 SKILL 的 UTF-8 落盘与凭据解密为 PowerShell 命令）、Read、Write、Glob、Grep（MCP 工具不显式列入，对齐 tr-impl-workflow 先例）

- [x] 1.2 [代码] 技能正文新增提案分类提交段：场景 4 提案点名（点名提案 → 读 proposal/design/tasks → 变更自动归类 → N 笔分类提交计划 → 四环节确认 → 依次执行）；未点名自动检测活跃变更（唯一采用提示/多个列出供选/无活跃退化为场景 2 无溯源）；三类规则路径优先（src/test/**、test/** 全量 + *Test.java、*Tests.java、*.test.*；已纳管 docs/** 全量 + 其余 *.md + 已版本化 openspec/ 制品归文档、未纳管遵循范围排除默认不提交；其余归功能代码）+ tasks.md 任务类型标签交叉校验；前缀映射（功能类按性质/测试固定 test/文档固定 docs）；尾行溯源标注 `提案: <变更名>`；提案关联校验辅助检查（无关联变更环节 2 单独列出待裁决不阻断）；失败即停不回滚；边界处理（提案不存在列活跃供选/已归档报错拒绝/某类为空跳过/提案产出命中排除规则以排除优先）
  - 文件：`src/core/templates/workflows/tr-commit-push.ts`
  - 验证：对照 specs/tr-commit-push-skill/spec.md 全部 12 条需求 22 个场景逐条核对覆盖

- [x] 1.3 [代码] 同文件实现 getTrCommitPushCommandTemplate——指令压缩版（四环节+场景速览+提案分类提交要点+约束），对齐 tr-commit.ts 现有手工双写模式（不引入 derive-command 派生改造）
  - 文件：`src/core/templates/workflows/tr-commit-push.ts`
  - 验证：command content 覆盖 skill 正文关键约束（显式触发/四环节/范围排除优先级/溯源标注格式），与 skill 版无内容矛盾

- [x] 1.4 [代码] registry.ts 注册：import getTrCommitPushSkillTemplate/getTrCommitPushCommandTemplate，WORKFLOW_PAIRS 在 tr_commit 类型段（tr-commit-change 之后）新增条目
  - 文件：`src/core/templates/registry.ts`
  - 验证：venus list 显示技能总数 26；venus_tr_commit_change 位置与顺序不变

## 2. 测试与快照同步

- [x] 2.1 [代码] 更新技能总数断言 25 → 26：test/validate-update.test.ts（result.total、passed）与 test/config-command.test.ts（全部 workflow id 数量断言）
  - 文件：`test/validate-update.test.ts`、`test/config-command.test.ts`（另发现并同步更新 4 个遗漏同类断言文件：`test/commands.test.ts` init/list/reconcile 断言、`test/uninstall-show.test.ts` removedSkills/removedCommands、`test/templates.test.ts` 内置技能数、`test/skills-parity.test.ts` workflow id 数——探索阶段检索截断所致，均为同一机械改动 25→26）
  - 验证：pnpm test 中两测试文件通过

- [x] 2.2 [代码] 生成 skills/ 快照：pnpm build && pnpm generate:skills，产出 skills/venus_tr_commit_push/SKILL.md
  - 文件：`skills/venus_tr_commit_push/SKILL.md`（生成产物）
  - 验证：skills-parity.test.ts 通过（skills/ 与模板一致）

- [x] 2.3 [代码] 全量测试回归：pnpm test 全绿（重点 validate-update/config-command/skills-parity/template-derivation）
  - 文件：无新增（验证性任务）
  - 验证：178/179 通过；唯一失败 spec-commands.test.ts:124 跨 CLI 兼容测试为环境性超时（外部 openspec CLI 并发下超 15s 硬超时，单跑 4.1s 通过，与本变更零关联）——经用户裁决视为环境例外继续

## 3. 防护与行为验收

- [x] 3.1 [代码] 凭据与编码防护约束核对：对照源 SKILL「强制约束」与「提交执行阶段」第 2/3 步逐条核对新模板正文——密码只进内存与 stdin、禁止显示/进命令行/写日志、失败一次即停、UTF-8 无 BOM 落盘读回校验、--encoding UTF-8 -F 禁止裸 -m、--non-interactive 全程
  - 文件：`src/core/templates/workflows/tr-commit-push.ts`
  - 验证：核对清单逐项确认，发现遗漏立即补齐（design.md 风险表第 1 条缓解措施）

- [x] 3.2 [代码] 提案分类提交行为核对：模拟走查四类典型输入（点名活跃提案/未点名唯一活跃/未点名多活跃/点名已归档）+ 三类归类样例（src/test 下 md、docs 下 java、openspec 制品已纳管与未纳管两种状态）+ 失败即停路径，确认正文描述与 spec 场景一一对应
  - 文件：`src/core/templates/workflows/tr-commit-push.ts`、`openspec/changes/add-tr-commit-push/specs/tr-commit-push-skill/spec.md`
  - 验证：走查记录无行为歧义（每个场景正文均有明确处理指令）

## 4. 文档同步

- [x] 4.1 [使用说明] 更新技能使用文档：docs/skills-manual.md 新增 venus_tr_commit_push 章节（适用场景 SVN 项目、四环节确认流程、提案分类提交用法示例、与 venus_tr_commit_change 的 VCS 职责边界、workflows 勾选安装方式）；CHANGELOG.md 追加本变更条目
  - 产出: `docs/skills-manual.md`、`CHANGELOG.md`
  - 验证：文档示例可被用户直接照用（/venus:tr-commit-push 提交 <提案名> 提案 等三场景样例）；与技能正文行为一致
