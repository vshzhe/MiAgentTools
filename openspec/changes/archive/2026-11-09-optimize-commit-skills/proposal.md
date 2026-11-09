## Why

现有 `iagent_svn_commit` 与 `iagent_commit` 两个提交技能存在三处偏差，导致提交范围与提交说明不可预测：

1. **知识库同步偏离提交职责**：`iagent_svn_commit` 仍保留「环节 3 知识库推送询问」与执行阶段第 6 步的 llm-wiki MCP 提交。该 MCP 工具未列入 `allowedTools`（能力记忆 D11 已记录权限弹窗遗留缺口），且不属于「代码、测试、文档提交」核心职责，增加了失败面与交互负担。
2. **文档类提交说明不明确**：代码类与测试类说明已包含业务描述，文档类却常出现「更新文档 / 修改文档 / 更新提案」等泛化表述，无法从提交信息判断改了什么对象、改了什么内容。三类说明缺少统一口径。
3. **归档未提交提案被排除在提交范围外**：Git 侧 `iagent_commit` 只扫描 `openspec/changes/` 且显式排除 `archive/`；SVN 侧自动检测也只检测活跃变更，且未纳管（`?`）的 `openspec/` 制品默认不提交。提案归档后若制品尚未提交，再次提交时不会被识别、不会进入分类计划、也不会带溯源尾行，形成「归档即丢失提交管理」的盲区。

## What Changes

- **移除 svn-commit 知识库同步**：删除环节 3（知识库推送询问）、执行阶段第 6 步（llm-wiki 提交）、描述与强制约束中的知识库内容、汇报中的知识库结果项；确认环节由四环节收敛为**三环节**（提交范围 → 提交内容清单与功能描述 → 最终确认）。Git 版 `iagent_commit` 无知识库逻辑，不改动（D1）。
- **统一三类提交说明规范**：三类提交说明 MUST 写清「改动对象 + 改动内容」；文档类 MUST NOT 单独使用「更新文档 / 修改文档 / 更新提案」等泛化表述，须点名具体文档、规格能力或变更制品及其内容变化；Git 侧 Conventional Commits 的 `docs` 类同步该要求（D2 / D7）。
- **归档未提交提案纳入提交范围**：Git 与 SVN 提交前同时扫描活跃变更与 `openspec/changes/archive/` 下存在未提交制品的归档变更；归档项标注「已归档」，活跃与归档同名并存时分别列出不合并；部分已提交只纳入未提交部分；无 VCS 变更不列为候选（D3 / D6）。
- **SVN 归档提案未纳管制品纳入**：当归档提案被选中/点名时，其未提交制品经环节 2 清单确认后 auto `svn add` 并归文档类；其他未点名未纳管 `openspec/` 制品仍默认排除（D4）。
- **溯源尾行命名统一**：归档提案的 `提案: <change-name>` 使用去掉日期前缀的变更名（D5）。
- **规格同步**：`openspec/specs/commit-push-skill/spec.md` 按新行为更新（删除知识库 Requirement、修正「点名已归档报错」为「归档提案正常处理」、补充说明规范与归档检测要求）。

## Capabilities

### New Capabilities

无

### Modified Capabilities

- `commit-push-skill`: 确认体系由四环节收敛为三环节（移除知识库推送）；新增三类提交说明「对象 + 改动」统一规范与文档类禁止泛化表述；新增归档未提交提案的自动检测、分类纳入与溯源命名规则；修正归档提案状态边界（由「报错拒绝」改为「正常处理」）。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/svn-commit.ts`: 移除知识库环节与执行第 6 步，收敛三环节；补充归档检测、未纳管制品纳入、说明统一规范、溯源去日期前缀
- `src/core/templates/workflows/commit.ts`: 提案检测扩展至 `archive/`；固定清单支持归档路径；补充 docs 类说明明确化
- `openspec/specs/commit-push-skill/spec.md`: 能力规格同步（归档时由 delta spec 更新）
- `skills/iagent-svn-commit/SKILL.md` / `skills/iagent-commit/SKILL.md`: 生成快照（`pnpm generate:skills` 重建，不手编）
- `.claude/`、`.opencode/`、`.pi/` 下的 dogfood 产物: 生成物，不手编
- `test/templates.test.ts`（或新增模板契约测试）: 断言知识库字样消失、三环节文案、归档检测与 docs 规范存在

### 向后兼容

行为变更（非仓库级 **BREAKING**）：

- `iagent_svn_commit` 的用户可见交互由四环节变为三环节，不再询问知识库推送；依赖知识库推送的既有使用者需改用其他方式推送。
- 归档提案由「点名报错」改为「正常读取并纳入提交范围」，符合用户诉求；不涉及包契约字段、CLI 命令或技能类型的破坏性变更。
- 技能名、指令 id、`allowedTools` 与安装布局均不变，无需迁移。
