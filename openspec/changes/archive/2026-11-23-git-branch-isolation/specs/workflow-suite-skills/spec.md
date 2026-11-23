## ADDED Requirements

### Requirement: debug 与 spec-update 的验证后自动合并

`iagent_debug` 的 Phase 7（verify-close）与 `iagent_spec_update` 的 Step 8 SHALL 在验证 PASS 后自动合并工作分支：

- **授权来源**：本阶段验证 PASS 结论；回执 SHALL 携带 `mergeAuthorized: true` 与 `mergeResult`
- **账本边界**：合并授权 MUST NOT 写入 handoff 包 `## 已确认门`（该段取值域收敛到 `GATE_SKIP_IDS`）；SHALL 以回执字段表达
- 冲突 → 暂停 + 冲突清单，MUST NOT abort，MUST NOT 声明验证失败
- 成功 → 删除工作分支（失败仅 WARN）
- `branchMode=none` → 跳过合并并记日志
- 正文 SHALL 显式声明非目标：不覆盖 SVN、不自动解决冲突

#### Scenario: debug 自动合并后回执字段完整

- **WHEN** debug Phase 7 验证 PASS 且 `branchMode=work-branch`
- **THEN** 回执 SHALL 含 `mergeAuthorized: true` 与 `mergeResult`，且 `## 已确认门` 段 MUST NOT 出现域外 id

#### Scenario: 自动合并不新增用户停点

- **WHEN** debug / update 走到验证 PASS 后的合并动作
- **THEN** 技能 MUST NOT 请求额外确认（授权已由验证 PASS 承载）
