# Delta Spec：tr-commit-push-skill

## ADDED Requirements

### Requirement: 显式触发与四环节强制确认

技能 venus_tr_commit_push SHALL 仅由显式指令 /venus:tr-commit-push 触发（普通文本提交请求不触发），且 MUST 按四环节强制确认推进：环节 1 提交范围确定 → 环节 2 提交内容清单与功能描述确认 → 环节 3 知识库推送询问 → 环节 4 最终确认。任何环节未经用户确认不得推进，最终确认通过前绝不执行提交；用户明确终止时立即停止不执行任何提交。

#### Scenario: 普通文本提交请求不触发
- **WHEN** 用户以普通对话文本请求"帮我提交代码"而未调用 /venus:tr-commit-push
- **THEN** 技能不触发，不进入任何环节

#### Scenario: 环节未确认不得推进
- **WHEN** 环节 2 展示清单与功能描述后用户尚未答复
- **THEN** 不进入环节 3，不生成知识库推送询问，不执行任何提交动作

### Requirement: 提交范围确定（四场景）

技能 SHALL 按四种场景确定提交候选集：场景 1 指定 SVN changelist（校验列表存在，候选集 = 列表成员，不存在时列出可用列表供选）；场景 2 均未指定（询问是否提交全部变更，不提交全部时请用户指定列表或文件，仍无法确定则终止）；场景 3 直接点名文件（候选集 = 点名文件）；场景 4 提案点名（读取点名提案后进入提案分类提交流程）。候选集 MUST 先经「提交范围排除」过滤再进入环节 2。

#### Scenario: 指定的变更列表不存在
- **WHEN** 用户执行 /venus:tr-commit-push 提交 not-exist-list 列表且该列表不存在
- **THEN** 列出 svn status 中当前可用的变更列表供用户选择

#### Scenario: 场景 4 提案点名
- **WHEN** 用户执行 /venus:tr-commit-push 提交 add-audit-alert 提案且该提案存在于 openspec/changes/
- **THEN** 技能读取该提案的 proposal/design/tasks，进入提案分类提交流程

### Requirement: 提交范围排除（最高优先级）

技能 SHALL 将 target 目录（含 classes、test-classes、surefire-reports、generated-sources）、*.class 编译产物、surefire-reports、*.log、.idea、docs、本地脚本等未纳管非源码文件排除出提交范围（不进入清单、不参与注释提炼、永不 svn add），本排除规则优先级高于「被引用则 add」。src/test/java 测试源码不在排除范围。排除项按状态处理：?（未纳管）直接忽略；A（已被 svn add）为危险项——不提交、不 revert、改用过滤后显式路径提交并提示用户手动 revert；M（已版本化）不提交、不改动、汇报中建议 svn delete。用户明确点名要求提交排除项时以用户指令为准。

#### Scenario: 排除项被提交集内文件引用
- **WHEN** 提交集内文件引用了 target/classes 下某 *.class 文件
- **THEN** 该文件不被自动纳入（排除优先于「被引用则 add」），不计为引用缺漏

#### Scenario: 排除项已被 svn add 调度
- **WHEN** 候选集内存在处于 A 状态的 target/ 下文件
- **THEN** 不提交该文件、不 revert，改用过滤后的显式路径提交，汇报中提示用户手动 svn revert

#### Scenario: 全部变更均被排除
- **WHEN** 过滤后无剩余变更
- **THEN** 不生成注释、不执行提交，说明全部变更均被排除并统计排除数量

### Requirement: 提交前缀规范与菜单归属

技能生成功能描述（提交注释）MUST 遵循十类前缀规范（feat/fix/docs/style/perf/test/build/chore/revert/refactor），一次变更只选一个 type 前缀。改动关联页面菜单时 MUST 采用【前缀: 一级菜单-二级菜单: 业务描述】格式，菜单名取真实菜单（优先 Controller 的 @SystemLogAnn(opmodule=…) 注解，其次页面标题/导航），禁止编造简写；涉及多个二级菜单时分别罗列（同一行分号分隔）。页面未改但改动属某菜单后台逻辑时同样标注菜单。纯后台接口（无页面引用、无菜单归属）才使用【前缀: 业务描述】。无法确定归属时询问用户确认。

#### Scenario: 多菜单变更分别罗列
- **WHEN** 一次变更同时修复审计管理下告警展示与日志导出两个菜单的缺陷
- **THEN** 功能描述为 `fix: 审计管理-告警展示: 修复分页异常；审计管理-日志导出: 修复导出乱码`（同一行分号分隔，不合并精简）

#### Scenario: 菜单归属无法确定
- **WHEN** 改动文件无法定位到任何真实菜单
- **THEN** 询问用户确认归属后再生成描述，不编造菜单名

### Requirement: 提案分类提交（三类自动分类）

提案场景 4 下技能 SHALL 将过滤后的工作区变更自动归类为三类：测试代码（src/test/**、test/** 下任何文件含 *.md 测试说明，及独立测试文件 *Test.java、*Tests.java、*.test.*）；文档（已纳管版本化的 docs/** 下任何文件，其余位置 *.md，已版本化纳管的 openspec/ 变更制品）；功能代码（其余产出：源码、页面、SQL 脚本、配置文件）。分类规则 MUST 路径优先——目录语义覆盖扩展名判定；提案 tasks.md 任务类型标签作为交叉校验辅助。技能 MUST 生成 N 笔分类提交计划（每笔一个类别、一个前缀：功能代码类按变更性质判定 feat/fix/refactor/perf 等，测试代码固定 test，文档固定 docs），某类为空时跳过该笔并在计划中说明。

#### Scenario: 测试目录下文档随测试类
- **WHEN** 变更含 src/test/java/.../AlertTest.java 与 src/test/resources/测试说明.md
- **THEN** 两个文件均归入测试代码类，同笔以 test 前缀提交

#### Scenario: 某类为空跳过该笔
- **WHEN** 提案场景下归类结果为功能代码 3 个文件、测试代码 0 个、文档 1 个
- **THEN** 生成 2 笔提交计划（功能代码笔 + 文档笔），计划中说明测试代码类为空已跳过

#### Scenario: 提案产出命中排除规则
- **WHEN** 提案 tasks 列出的产出文件命中提交范围排除规则（如编译产物）
- **THEN** 排除规则优先——该文件不提交，汇报中说明

#### Scenario: openspec 制品未纳管
- **WHEN** 提案场景下 openspec/changes/&lt;提案名&gt;/ 的制品（proposal/design/tasks 等）处于 ? 未纳管状态
- **THEN** 该文件默认不提交（遵循提交范围排除规则，不自动 svn add），用户明确点名要求提交时以用户指令为准纳入并归文档类

### Requirement: 提案溯源标注

提案分类提交的每笔提交信息 MUST 保持主体单行源 SKILL 前缀格式，另起尾行以 `提案: <变更名>` 标注来源提案。非提案场景（场景 1/2/3 及场景 4 退化）MUST 不附加溯源标注。

#### Scenario: 每笔独立标注
- **WHEN** 提案 add-audit-alert 产出三笔分类提交（功能/测试/文档）
- **THEN** 三笔提交信息各自尾行均带 `提案: add-audit-alert`

### Requirement: 提案关联校验（辅助检查，不阻断）

提案场景 4 下技能 SHALL 对每个候选变更文件与提案内容（proposal/design/tasks）做关联校验：无关联的变更不纳入分类提交计划，在环节 2 清单单独列出「与提案无关的变更」由用户逐项裁决纳入或排除。校验为辅助检查项 MUST NOT 阻断流程。

#### Scenario: 发现无关变更待裁决
- **WHEN** 候选集中存在与点名提案内容无关联的其他工作遗留变更
- **THEN** 该变更不进入分类提交计划，环节 2 清单单独列出并请用户逐项决定纳入或排除

### Requirement: 分类提交执行与失败即停

分类提交 N 笔 SHALL 依次执行（建议顺序：功能代码 → 测试代码 → 文档），每笔提交前 MUST 经环节 4 最终确认，每笔提交后执行双验证（svn status 无本笔残留 + svn log -r --xml 无乱码）再进下一笔。任一笔失败 MUST 即停：不继续后续类别、不自动回滚已成功笔，汇报已完成笔/未执行笔及失败原因，由用户决定后续。

#### Scenario: 中途失败即停
- **WHEN** 三笔提交计划中第 2 笔（测试代码）提交失败
- **THEN** 第 3 笔（文档）不执行，第 1 笔不回滚，汇报第 1 笔成功、第 2 笔失败原因、第 3 笔未执行

### Requirement: 提案状态边界处理

技能 MUST 按以下边界处理提案状态：未点名提案时自动检测 openspec/changes/ 活跃变更——唯一时直接采用并提示，多个时列出供选，无活跃变更时退化为场景 2（询问是否提交全部，无溯源标注）；点名的提案不存在于 changes/ 时列出活跃变更供选；点名提案已归档（在 archive/ 不在 changes/）时报错提示已归档并列出活跃变更供选。

#### Scenario: 未点名且无活跃变更退化
- **WHEN** 用户执行 /venus:tr-commit-push 且 openspec/changes/ 无活跃变更
- **THEN** 退化为场景 2 询问是否提交全部变更，提交不带溯源标注

#### Scenario: 点名已归档提案
- **WHEN** 用户点名的提案存在于 openspec/changes/archive/ 而非 changes/
- **THEN** 报错提示该提案已归档，并列出当前活跃变更供用户选择

### Requirement: 提交执行（编码安全与凭据处理）

执行提交时技能 MUST：先做提交集完整性检查（? 状态源码文件被提交集内文件 import/引用时必须一并 svn add 纳入，自动纳入须先在环节 2 清单中确认）；提交注释以 UTF-8 无 BOM 落盘并读回校验中文完好，提交必须 --encoding UTF-8 -F &lt;文件&gt; 禁止裸 -m 传中文；全程 --non-interactive；遇 E230001 加 --trust-server-cert-failures，遇 E215004 从 Subversion auth 缓存按 realmstring 取用户名、DPAPI 解密密码经 stdin 传入（密码只进内存与 stdin，禁止显示、进命令行或写日志，失败一次即停）；提交路径与最终确认清单一致（显式路径或 --changelist，禁止裸目录提交带上被排除的 A 调度）；提交后双验证。

#### Scenario: 被引用新文件自动纳入
- **WHEN** 提交集内已版本化文件 import 了一个 ? 状态的新源码文件
- **THEN** 该新文件先经环节 2 清单确认后 svn add 纳入提交，防止他人 checkout 编译断裂

#### Scenario: 中文注释编码安全
- **WHEN** 提交注释含中文
- **THEN** 注释以 UTF-8 无 BOM 文件落盘、读回校验，svn commit 携带 --encoding UTF-8 -F，svn log -r --xml 验证存储无乱码

### Requirement: 知识库推送（可选环节）

环节 3 中用户确认推送时技能 SHALL 由提交人列出推送文件并逐项确认形成「知识库推送清单」（未经确认的文件不得推送），清单随环节 4 最终确认，实际提交在 SVN 提交成功后执行：调用 llm-wiki MCP（llm_wiki_status 确认可达 → llm_wiki_import_sources 提交，单次最多 5 个文件超出分批 → 返回 submission_id 即已提交待审核，llm_wiki_submission_status 查询状态）。SVN 提交失败时不执行知识库推送。MCP 工具不可用或提交失败时 MUST 如实说明，不影响 SVN 提交结果汇报。

#### Scenario: MCP 不可用
- **WHEN** 环节 3 用户确认推送知识库但 llm-wiki MCP 工具不可用
- **THEN** 如实说明 MCP 不可用无法推送，SVN 提交结果正常汇报不受影响

### Requirement: 提交汇报

提交流程结束后技能 MUST 汇报：版本号、作者、路径数（M/A/D 分项）、使用的变更列表名（如有）、双验证结论、排除的本地文件清单（含数量统计）、知识库提交结果（如有：submission_id 与审核状态）。提案分类提交场景 MUST 额外汇报：各笔分类明细（类别、前缀、文件数、溯源标注）、失败笔与未执行笔（如有）。

#### Scenario: 提案分类提交完整汇报
- **WHEN** 提案场景三笔提交全部成功
- **THEN** 汇报含每笔的类别/前缀/文件数/`提案: <变更名>`标注、各笔版本号、双验证结论、排除清单
