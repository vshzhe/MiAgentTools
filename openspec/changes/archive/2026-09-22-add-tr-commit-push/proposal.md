# 提案：add-tr-commit-push —— 迁移 SVN 提交推送技能并新增提案分类提交

## Why

源项目已有成熟的 SVN 交互式提交助手 SKILL（`tr-commit-push`，位于 `C:\Users\venus\Downloads\tr-commit-push\tr-commit-push\SKILL.md`），包含四环节强制确认、提交范围排除、UTF-8 编码落盘、SVN 证书/凭据处理、提交后双验证、知识库推送等完整能力，但以独立 SKILL 形态存在，未纳入 venus 工具链统一管理与分发。

当前 venus 工具链的提交技能 `venus_tr_commit_change` 是 Git 版简单四步流程，存在两个缺口：

1. **SVN 场景无技能可用**——Venus4A 等 SVN 项目无法经 venus 技能获得规范的交互式提交能力（四环节确认、范围排除、凭据处理等）。
2. **提案与提交脱节**——venus 规格驱动工作流（spec-propose/spec-apply）产出活跃提案（openspec/changes/&lt;name&gt;/）后，实施产出提交时无法按提案自动归类（功能代码/测试代码/文档），提交信息也不携带提案溯源，事后难以批量回答"这笔提交来自哪个提案"。

因此需要：把源 SKILL 功能迁移为 venus 技能模板，并在其上新增根据提案的自动分类提交能力。

## What Changes

### 1. 新增技能 venus_tr_commit_push（完整迁移源 SKILL）

- **技能定义**：name=`venus_tr_commit_push`，type=`tr_commit`（复用现有类型），指令 id 派生为 `tr-commit-push`（/venus:tr-commit-push）。
- **完整迁移源 SKILL 能力**：
  - 四环节强制确认：范围确定（changelist/点名文件/全部三场景）→ 提交清单与功能描述确认 → 知识库推送询问 → 最终确认。
  - 提交范围排除（最高优先级）：target/、*.class、surefire-reports、*.log、.idea、docs、本地脚本等；?/A/M 状态分策略处理。
  - 提交前缀规范：feat/fix/docs/style/perf/test/build/chore/revert/refactor 十类 + 菜单归属标注（【前缀: 一级菜单-二级菜单: 业务描述】，取 @SystemLogAnn 真实菜单，无法确定时询问用户）。
  - 提交执行：完整性检查（被引用 ? 文件自动纳入并确认）→ UTF-8 无 BOM 注释落盘 → 证书/凭据处理（E230001/E215004、密码仅内存与 stdin）→ commit --encoding UTF-8 -F → 双验证（svn status + svn log --xml）。
  - 知识库推送：llm-wiki MCP 逐项确认推送，submission_id 与审核状态纳入汇报；MCP 不可用时如实说明跳过。
  - 汇报：版本号、作者、路径数（M/A/D 分项）、变更列表名、双验证结论、排除清单、知识库结果。
- **触发约束**：仅显式 /venus:tr-commit-push 触发；普通文本提交请求不触发。

### 2. 新增提案分类提交能力（本变更核心增量）

- **场景 4（提案点名）**：`/venus:tr-commit-push 提交 <提案名> 提案` → 读取 openspec/changes/&lt;提案名&gt;/（proposal/design/tasks）→ 工作区变更自动归类三类 → 生成 N 笔分类提交计划（各带前缀+溯源标注）→ 按四环节确认后依次执行 → 汇报。
- **未点名提案时**：自动检测 openspec/changes/ 活跃变更，唯一时直接采用并提示，多个时列出供选；无活跃变更退化为源 SKILL 场景 2（询问是否提交全部，无溯源标注）。
- **三类自动分类规则（路径优先）**：
  - 测试代码：`src/test/**`、`test/**` 下任何文件（含 *.md 测试说明），或独立测试文件（*Test.java、*Tests.java、*.test.*）。
  - 文档：已纳管版本化的 `docs/**` 下任何文件；其余位置 `*.md`；已版本化纳管的 openspec/ 变更制品（proposal/design/tasks 等）归文档类。未纳管（?）的 docs/openspec/ 文件遵循提交范围排除规则默认不提交，用户明确点名要求时以用户指令为准。
  - 功能代码：其余产出（源码、页面、SQL 脚本、配置文件）。
  - 交叉校验：提案 tasks.md 任务类型标签（[代码]/[测试] 等）作为辅助参考。
- **前缀映射**：功能代码类按实际变更性质判定（feat/fix/refactor/perf 等）；测试代码固定 `test`；文档固定 `docs`。
- **溯源标注**：每笔提交信息主体保持源 SKILL 单行格式，另起尾行 `提案: <变更名>`。
- **提案关联校验（辅助检查，不阻断）**：分类时对每个变更文件与提案内容（tasks/proposal/design）做关联校验，无关联变更不纳入分类提交计划，在环节 2 清单单独列出「与提案无关的变更」由用户逐项裁决纳入或排除。
- **失败即停**：N 笔依次执行，任一笔失败即停——不继续后续类别、不自动回滚已成功笔（SVN 已提交无法本地回滚），汇报已完成笔/未执行笔及失败原因，由用户决定后续；每笔提交后执行源 SKILL 双验证再进下一笔。
- **边界处理**：
  - 点名的提案不存在 → 列出活跃变更供选（对齐源 SKILL 环节 1 模式）。
  - 点名的提案已归档（在 archive/ 不在 changes/）→ 报错提示已归档并列出活跃变更供选。
  - 某类为空 → 跳过该笔，计划与汇报中说明。
  - 提案产出的文件命中范围排除规则（编译产物等）→ 排除规则优先级最高，不提交并在汇报中说明。

### 3. 注册与分发

- registry.ts WORKFLOW_PAIRS 新增注册项（tr_commit 类型段）。
- 不入默认集（DEFAULT_WORKFLOWS 不变），经 `.venus/config.yaml` workflows 字段勾选安装。
- skills/ 快照目录新增 venus_tr_commit_push/（pnpm generate:skills 产物）。

### 4. 测试同步

- 技能总数断言 25 → 26（validate-update.test.ts、config-command.test.ts）。
- skills-parity.test.ts 经 `pnpm build && pnpm generate:skills` 后自动通过。

### 不变项

- 现有技能 `venus_tr_commit_change`（Git 版）**保持不动，行为零变更**——两技能按 VCS 划分职责（tr-commit-push → SVN 项目；tr-commit-change → Git 项目）。
- tr_commit 类型定义（config.ts SKILL_TYPES）不变。

## Capabilities

### New Capabilities

- `tr-commit-push-skill`: SVN 交互式提交技能 venus_tr_commit_push——源 SKILL tr-commit-push 完整迁移（四环节确认/范围排除/凭据处理/双验证/知识库推送/汇报）+ 提案分类提交（三类自动分类、N 笔分类分批提交、尾行溯源标注、提案关联校验、失败即停）

### Modified Capabilities

（无——现有能力 spec 级行为均不变）

## Impact

### 直接影响的文件

- `src/core/templates/workflows/tr-commit-push.ts`（新增）：技能模板与指令模板工厂函数（getTrCommitPushSkillTemplate / getTrCommitPushCommandTemplate）。
- `src/core/templates/registry.ts`（修改）：import 新模板 + WORKFLOW_PAIRS 新增条目（tr_commit 类型段）。
- `skills/venus_tr_commit_push/SKILL.md`（新增）：generate:skills 快照产物。
- `test/validate-update.test.ts`（修改）：技能总数断言 25 → 26。
- `test/config-command.test.ts`（修改）："全部 25 个 workflow id" 断言 25 → 26。

### 向后兼容

无破坏性变更：

- 纯新增技能，不入默认集——未勾选 tr-commit-push 的既有项目 `venus init/update` 后无任何变化（reconcile 扫描仅提示新增可选项，不自动安装）。
- 现有 venus_tr_commit_change 行为零变更，已安装该技能的项目不受影响。
- 源 SKILL 原文件不动（迁移为复制语义，非移动）。
