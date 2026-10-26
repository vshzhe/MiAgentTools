# tool-call-whitelist Specification (Delta)

> 新增：归档类技能（`venus_spec_archive` / `venus_spec_bulk_archive`）的**需求文档委派条目**要求——两技能正文新增经 Skill 工具委派 `venus_tr_docs_requirement_doc`，白名单 MUST 同步；并明确**嵌套委派由会话级权限载体覆盖**，从而授权编排技能剔除已不再直接委派的条目。

## ADDED Requirements

### Requirement: 归档技能的需求文档委派条目

归档类技能（`venus_spec_archive` / `venus_spec_bulk_archive`）的 `allowedTools` SHALL 覆盖其**预归档需求文档生成检查点**的实际调用面：两者正文均经 Skill 工具非交互委派 `venus_tr_docs_requirement_doc`（不存在分支）与就地增量对齐（已存在分支，不调用技能），故两者的 `allowedTools` MUST 含精确条目 `Skill(venus_tr_docs_requirement_doc)`，MUST NOT 使用 `Skill(*)` 通配。

**嵌套委派的权限归属**：编排技能（如 `venus_tr_impl_genfull`）经 Skill 工具委派归档技能、归档技能再委派需求文档技能时，**内层委派的放行归属会话级权限载体**——`permissions.allow` 由 `venus_spec_archive` 自身的白名单聚合而来（`buildPermissionEntries` 接收全部已安装技能的 `allowedTools`），故外层编排技能的 `allowedTools` MUST NOT 为其非本轮实际委派的技能写入条目。

配套约束：归档技能正文新增委派后，其**配对斜杠指令**的 `allowed-tools` MUST 经既有派生链继承同一取值（`spec-*.ts` 走 `deriveCommandContent` 派生；MUST NOT 手工维护指令侧白名单），且正文 ↔ 白名单一致性测试 SHALL 覆盖该新增委派。

#### Scenario: spec-archive 具备需求文档委派条目

- **WHEN** 检查 `venus_spec_archive` 的 `allowedTools`
- **THEN** 含 `Skill(venus_tr_docs_requirement_doc)`，与其预归档需求文档生成检查点（不存在分支委派该技能）一致

#### Scenario: spec-bulk-archive 具备需求文档委派条目

- **WHEN** 检查 `venus_spec_bulk_archive` 的 `allowedTools`
- **THEN** 含 `Skill(venus_tr_docs_requirement_doc)`，与其 a.6 需求文档生成步骤一致

#### Scenario: 指令侧白名单同步派生

- **WHEN** 重新生成 `venus_spec_archive` / `venus_spec_bulk_archive` 的配对斜杠指令
- **THEN** 其 frontmatter `allowed-tools` 与配对技能模板的 `allowedTools` 完全一致（含新增的 `Skill(venus_tr_docs_requirement_doc)` 条目），无需手工维护指令侧

#### Scenario: 嵌套委派不使外层白名单虚增

- **WHEN** `venus_tr_impl_genfull` 的 `allowedTools` 在其 Stage 4 委派 `venus_spec_archive`（后者将再委派需求文档技能）后被检查
- **THEN** `venus_tr_impl_genfull` MUST NOT 因该嵌套链路写入 `Skill(venus_tr_docs_requirement_doc)`；内层委派由会话级 `permissions.allow` 放行

#### Scenario: 未使用条目被剔除

- **WHEN** 某编排技能正文不再委派某技能（如 `venus_tr_impl_workflow` 移除 §3.5 需求文档生成、`venus_tr_impl_debug` 移除 Phase 7.3 分支）
- **THEN** 其 `allowedTools` MUST NOT 继续保留该技能的 `Skill(...)` 条目（最小权限；条目存在但正文不调用属授权面虚增）
