## REMOVED Requirements

### Requirement: 归档技能的需求文档委派条目

**Reason**: 归档侧已删除需求文档的生成 / 就地增量对齐 / 迁出分支（改为只读存在性报告，见 `spec-workflow-skills / spec-archive 归档技能` 与 `spec-bulk-archive-skill / 归档单元执行序列`），两个归档技能正文不再经 Skill 工具委派 `iagent_requirement_doc`。继续保留 `Skill(iagent-requirement-doc)` 条目属授权面虚增，违反最小权限与「正文 ↔ 白名单一致性」原则。

**Migration**: 从 `iagent_spec_archive` 与 `iagent_spec_bulk_archive` 的 `allowedTools` 移除 `skillDelegation(['requirement_doc'])` 条目，并移除模板中因此不再使用的 `skillDelegation` 导入；需求文档的生成职责仍由父编排的文档桥（workflow / auto-workflow / debug）与用户手工调用 `iagent_requirement_doc` 承担。已安装项目无需手工操作——`iagent update` 会按新白名单重新生成产物并重算会话级权限载体。

## ADDED Requirements

### Requirement: 归档技能不委派需求文档技能（授权面收敛）

归档类技能（`iagent_spec_archive` / `iagent_spec_bulk_archive`）的 `allowedTools` MUST NOT 含 `Skill(iagent-requirement-doc)` 条目：两者正文已不再委派该技能，仅做需求文档存在性报告。`iagent_spec_archive` 因删除 `需求文档.md` 迁出步骤（原 Step 6）而不再调用 `ls`，其 `allowedTools` 亦 MUST NOT 保留 `Bash(ls:*)`（最小权限；条目存在但正文不调用属授权面虚增）。两个归档技能因新增「归档收尾清理流程级工作区」而真实调用 `node`，SHALL 保留 `Bash(node:*)`，MUST NOT 以 `Bash(rm:*)` / `Bash(rmdir:*)` 等更宽条目替代。

白名单与其正文的一致性 SHALL 双向校验：正文出现 `iagent_requirement_doc` 委派语句 ⇔ `allowedTools` 含对应 `Skill(...)` 条目；任一侧单独存在即视为缺陷（缺条目 = 委派被宿主权限拦截；多条目 = 授权面虚增）。对 `Bash(...)` 条目同样 SHALL 满足「正文确有该命令调用」的准入条件。

**嵌套委派的权限归属**：编排技能（如 `iagent_workflow`）经 Skill 工具委派归档技能时，内层委派的放行归属会话级权限载体（`permissions.allow` 由各已安装技能自身白名单聚合），外层编排技能 MUST NOT 为归档技能的非本轮委派写入条目。

配套约束：归档技能的配对斜杠指令 `allowed-tools` MUST 经既有派生链继承同一取值（`spec-*.ts` 走 `deriveCommandContent` 派生；MUST NOT 手工维护指令侧白名单）。

#### Scenario: spec-archive 无需求文档委派条目

- **WHEN** 检查 `iagent_spec_archive` 的 `allowedTools`
- **THEN** MUST NOT 含 `Skill(iagent-requirement-doc)`；其正文 MUST NOT 出现委派 `iagent_requirement_doc` 的语句

#### Scenario: spec-bulk-archive 无需求文档委派条目

- **WHEN** 检查 `iagent_spec_bulk_archive` 的 `allowedTools`
- **THEN** MUST NOT 含 `Skill(iagent-requirement-doc)`；其正文 MUST NOT 出现委派 `iagent_requirement_doc` 的语句，且批量并行所需的 `SUBAGENT_DISPATCH` 条目保留

#### Scenario: 指令侧白名单同步派生

- **WHEN** 重新生成 `iagent_spec_archive` / `iagent_spec_bulk_archive` 的配对斜杠指令
- **THEN** 其 frontmatter `allowed-tools` 与配对技能模板的 `allowedTools` 完全一致（同样不含需求文档委派条目），无需手工维护指令侧

#### Scenario: 编排技能不为归档侧内层委派虚增条目

- **WHEN** 检查 `iagent_workflow` 的 `allowedTools`
- **THEN** 其 `Skill(iagent-requirement-doc)` 条目仅来自自身 Phase 3 文档桥的实际委派，MUST NOT 因「委派归档技能、归档技能曾再委派」而增生；归档侧内层委派由会话级 `permissions.allow` 放行

#### Scenario: 测试拦截残留条目

- **WHEN** 运行 `test/allowed-tools.test.ts`
- **THEN** 两个归档技能的白名单与正文一致性断言 SHALL 覆盖「无 `Skill(iagent-requirement-doc)`」与「`allowedTools` 可由共享常量产出」两项，残留条目导致测试失败
