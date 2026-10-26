# 设计：add-tr-commit-push

## Context

- **venus 技能装配链路**：`src/core/templates/workflows/*.ts` 导出成对工厂函数（SkillTemplate + CommandTemplate）→ `registry.ts` 的 WORKFLOW_PAIRS 注册（25 对现状）→ init/update 按 `.venus/config.yaml` workflows 勾选安装到目标项目 `.claude/`；指令 id 由 `deriveCommandId`（venus_&lt;type&gt;_&lt;name&gt; → &lt;type&gt;-&lt;name&gt;）派生。
- **现有提交技能**：`venus_tr_commit_change`（[tr-commit.ts](../../../src/core/templates/workflows/tr-commit.ts)），Git 版简单四步（status/diff → Conventional Commits → 精确暂存 → 提交），无提案关联、无交互确认体系。
- **源 SKILL**：`tr-commit-push`（SVN 交互式提交助手），四环节强制确认、changelist 三场景、范围排除（最高优先级）、十前缀+菜单归属、UTF-8 落盘、凭据处理（E230001/E215004、DPAPI）、双验证、llm-wiki 知识库推送、汇报。
- **目标项目场景**：Venus4A 等 SVN 项目也有 openspec/changes/ 提案结构（自动打包技能第 3 部分已从提案抽取信息，见 CONTEXT.md「提案」术语），提案分类提交在 SVN 场景有真实数据可用。
- **Impact 分析结论**（CodeGraph）：WORKFLOW_PAIRS 上游仅 registry.ts 内部消费（getSkillTemplates/getCommandTemplates 过滤器），新增条目对命令管线自动流转，无代码级波及；波及面集中在测试断言与 skills/ 快照。
- **测试基线**：validate-update.test.ts 与 config-command.test.ts 硬编码技能总数 25；skills-parity.test.ts 校验 skills/ 目录与模板快照一致（需 pnpm build && pnpm generate:skills）。
- **allowedTools 格式先例**：MCP 工具（mcp__ 前缀）不显式列入白名单（tr-impl-workflow 引用 codegraph MCP 但白名单仅 Read/Write/Edit/Glob/Grep/Bash），MCP 工具经 MCP 权限体系控制。

## Goals / Non-Goals

**Goals**:

- 源 SKILL tr-commit-push 功能完整迁移为 venus 技能模板 venus_tr_commit_push（type=tr_commit），经 registry 注册、workflows 勾选分发。
- 新增提案分类提交：点名提案 → 三类自动归类（路径优先）→ N 笔分类提交计划 → 四环节确认 → 依次执行，每笔尾行溯源标注 `提案: <变更名>`。
- 提案关联校验作为提交前辅助检查（无关联变更列出待裁决，不阻断）。
- 测试与快照同步（总数 26、skills/ 再生成）。

**Non-Goals**:

- 不修改现有 venus_tr_commit_change（Git 版）的任何行为——两技能按 VCS 划分职责。
- 不给 Git 项目提供提案分类提交能力（如后续需要，另立变更）。
- 不新增 SKILL_TYPES 类型定义（复用 tr_commit）。
- 不修改 venus CLI 核心管线（registry 消费方无需感知）。
- 不做提案任务标签驱动的自动分类（仅作交叉校验辅助）。

## Decisions

### D1: 迁移策略——新建独立技能，现有 Git 技能不动
- **选择**: 新建 venus_tr_commit_push（type=tr_commit，指令 /venus:tr-commit-push），完整迁移源 SKILL 并承载提案分类提交；venus_tr_commit_change 保持零变更。
- **理由**: 最小改动、不破坏已分发技能行为；源 SKILL 自成体系（SVN 专属细节多：changelist、凭据、UTF-8 落盘）；命名满足硬约束 venus_&lt;type&gt;_ 前缀 + tr- 前缀（能力记忆命名裁决）且派生指令 id 恰与源 SKILL 名称 tr-commit-push 一致。
- **备选**: ①融合进 venus_tr_commit_change（否决：已安装项目行为变化大，Git/SVN 双轨正文臃肿）；②双技能各获新功能（否决：改动面最大，Git 侧需求未确认）。

### D2: 核心行为——分类提交为主，校验为辅助检查
- **选择**: 提案场景自动归类三类分批提交 + 尾行溯源；提案关联校验为辅助检查项（无关联变更列出由用户裁决，不阻断）。
- **理由**: 用户核心诉求即分类分批提交与溯源（L1 确认）；校验阻断会与源 SKILL「用户逐环节确认」文化重复设卡。
- **备选**: 校验为强制门（否决：交互过重，校验发现的"无关变更"本就交由用户裁决）。

### D3: 流程形态——提案点名为场景 4，融入四环节
- **选择**: 场景 4 = 点名提案 → 读提案 → 归类 → N 笔分类提交计划 → 仍按四环节确认 → 依次执行；未点名时自动检测活跃变更（唯一直接采用并提示，多个列出供选，无活跃退化为场景 2）。
- **理由**: 复用源 SKILL 确认体系，新场景是范围确定环节的自然扩展；"自动"体现在归类与计划生成，提交执行仍受最终确认门约束。
- **备选**: 分类后置到环节 2（否决：候选集与分类计划脱节）；拆独立技能（否决：两套确认体系割裂）。

### D4: 分类规则——路径优先 + 扩展名兜底 + tasks 标签交叉校验
- **选择**: 测试=src/test/**、test/** 全量文件 + 独立测试文件名（*Test.java、*Tests.java、*.test.*）；文档=docs/** 全量 + 其余 *.md + openspec/ 变更制品；功能代码=其余产出。目录语义覆盖扩展名；tasks.md 任务类型标签作辅助参考。
- **理由**: 目录语义最贴近交付物归属（L5 确认 src/test/ 下的 *.md 归测试）；规则可静态判定、实现简单可靠。
- **备选**: ①扩展名优先（否决：测试辅助文档脱离测试类）；②任务标签驱动（否决：文件-任务匹配失败时无分类依据，复杂度高）。

### D5: 溯源标注——提交信息尾行 `提案: <变更名>`
- **选择**: 主体保持源 SKILL 单行前缀格式，另起尾行标注提案名。
- **理由**: 不破坏菜单格式【前缀: 菜单-菜单: 描述】；SVN/Git 通用；grep 尾行即可批量提取提案归属。
- **备选**: ①行内 scope（否决：与菜单格式占位冲突）；②首行标记（否决：破坏"前缀必须开头"规范）。

### D6: 分类提交失败策略——失败即停+汇报，不自动回滚
- **选择**: N 笔依次执行（功能→测试→文档顺序），每笔提交后双验证再进下一笔；任一笔失败即停，汇报已完成/未执行笔。
- **理由**: SVN 已提交无法本地回滚，自动回滚需新提交反而引入噪音；失败原因（凭据/网络）常影响后续笔，止损优于推进。
- **备选**: 失败跳过继续（否决：留下分类不一致风险）。

### D7: 提案状态边界——无活跃退化、归档拒绝、不存在列选
- **选择**: 未点名+无活跃变更 → 退化为场景 2 普通提交（无溯源）；点名已归档提案 → 报错并列活跃变更供选；点名不存在 → 列出活跃变更供选（对齐源 SKILL 列表不存在时模式）。
- **理由**: 归档变更产出理论上已提交过，补交易图存在语义矛盾；退化保证 SVN 项目普通提交始终可用。
- **备选**: ①严格提案模式（否决：SVN 项目普通提交无技能可用）；②归档提案可用（否决：语义矛盾）。

### D8: 知识库推送——完整保留环节 3
- **选择**: 完整迁移环节 3（逐项确认清单 → 环节 4 确认 → SVN 提交成功后 llm_wiki_import_sources → submission_status 查询），MCP 不可用如实说明跳过。
- **理由**: "完整迁移"语义默认保留；源 SKILL 已有完善的不可用降级处理，零新增风险。
- **备选**: 剥离知识库环节（否决：功能裁剪超出迁移范围，用户未要求）。

### D9: 测试同步与快照——机械性改动清单
- **选择**: validate-update.test.ts / config-command.test.ts 总数断言 25→26；skills/ 经 pnpm generate:skills 再生成新增 venus_tr_commit_push/。
- **理由**: 注册表驱动的既有校验机制，新增技能的固定配套。
- **备选**: 无（机制即如此）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 凭据处理（DPAPI 解密、stdin 传参）迁移失真导致密码泄露面扩大 | 技能正文逐字保留源 SKILL 防护约束：密码只进内存与 stdin、禁止显示/进命令行/写日志、失败一次即停；tasks 中将"防护约束逐条核对"列为独立验收任务 |
| 提案关联校验误判（提案描述未直接提及但确属实施产出的文件被列为"无关"） | 校验为辅助检查不阻断：无关清单由用户逐项裁决，技能不自动排除；清单中展示校验依据（文件与提案任务/描述的匹配情况） |
| 分类规则对非 Java 项目（无 src/test 结构）不适用 | 规则含通配兜底（test/**、*.test.*、docs/**、*.md）；无法归类时明确归功能代码类（非测试非文档即功能交付物），不产生第四类 |
| 源 SKILL 双模板手工维护与 venus 派生机制（derive-command）不一致 | tr-commit 类模板现状即手工双写（tr-commit.ts 先例），本变更沿用现状不引入派生改造；快照测试兜底一致性 |
| 新技能不入默认集导致用户不知如何安装 | 技能 description 写明适用场景；venus list/config 展示可选 workflows；reconcile 扫描提示新增可选项 |
