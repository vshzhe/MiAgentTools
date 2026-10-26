## ADDED Requirements

### Requirement: SKILL.md 渐进披露与尺寸预算

技能主 `SKILL.md` SHALL 遵循渐进披露：主文件行数 MUST ≤ **500 行**（软预算）；超出预算的技能 MUST 将明细内容下沉至 `references/*.md`（经 `SkillTemplate.references`），主文件以一行 `Read references/<topic>.md` 引导按需加载。本要求把既有 `SKILL 模板 references 机制启用`（原仅约束 spec-*、阈值 50 行段、无预算）推广到**全部技能**。

主文件 MUST 保留"看到即需执行"的**控制流内容**：触发条件、阶段骨架、确认门、委派清单、Guardrails、CLI 契约要点。参考性内容 MUST 下沉：评分维度细则与检查矩阵、评分示例、L1-L5 问句库、长代码/模板示例、字段级表格。

下沉 MUST 复用既有 `references` 机制（`writeSkillReferences` / `syncReferences`），MUST NOT 引入新语法或改 `SkillReference` 契约。本要求 MUST NOT 改变任何技能的行为语义（确认门、阶段、委派面、`allowedTools` 白名单）。

#### Scenario: 主文件尺寸预算

- **WHEN** 生成或检查任一技能的主 `SKILL.md`
- **THEN** 其行数 MUST ≤ 500；超出预算的技能 MUST 将参考性内容下沉 `references/` 直至满足预算

#### Scenario: 控制流内容保留主文件

- **WHEN** 拆分某超预算技能
- **THEN** 其触发条件、阶段骨架、确认门、委派清单、Guardrails MUST 仍在主文件；被下沉的 MUST 仅为参考性内容（评分细则/矩阵/示例/问句库/长样例）

#### Scenario: references 引用存在

- **WHEN** 主 `SKILL.md` 正文引用 `Read references/<topic>.md`
- **THEN** 该 `<topic>.md` MUST 存在于 `SkillTemplate.references`（并经生成写入技能目录），测试 MUST 断言引用与文件一一对应

#### Scenario: 语义零变化

- **WHEN** 审阅内容分层后的技能
- **THEN** 其 `allowedTools`、确认门关键词、阶段编号与委派面 MUST 与分层前一致；仅文本位置发生移动（主文件缩短 + `references/` 新增）

#### Scenario: references 随 update 同步无残留

- **WHEN** `iagent update` 刷新含 references 的技能
- **THEN** `syncReferences` 先删除旧 `references/` 再写入新文件，无旧文件残留（既有行为回归）

#### Scenario: 尺寸预算对被重写技能的最终形态生效

- **WHEN** 对 `workflow` / `auto-workflow` / `spec-explore` 等由 B / B2 委派化重写的技能执行内容下沉
- **THEN** 下沉 SHALL 以 B / B2 落地后的最终正文为基线（次序 A→B→B2→C），尺寸预算测试对最终形态生效；MUST NOT 对将被重写的旧正文先行下沉再返工
