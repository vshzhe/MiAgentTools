## MODIFIED Requirements

### Requirement: 项目初始化扫描协议

`iagent_project_init` SHALL 按「读扫描基线 → 技术框架语义扫描 → 五类文档 → AGENTS.md → context 回写 → 规则蒸馏 → 技能蒸馏」的顺序执行，全程非阻断（任一步失败记 WARN 并继续）。

**前置环境检查（新增 Step 0）**：在上述步骤**之前** SHALL 执行 Git 前置检查（检测 → 可选安装确认门 → 幂等初始化），详见 `project-init-git` 能力。Step 0 全程非阻断，MUST NOT 因 Git 不可用或用户拒绝而中断后续扫描。

#### Scenario: Step 0 先于扫描

- **WHEN** 用户执行 `/iagent:project-init`
- **THEN** 技能 SHALL 先执行 Git 前置检查，再进入扫描基线读取

#### Scenario: Git 不可用时不阻断

- **WHEN** Git 未安装且用户拒绝安装
- **THEN** 后续扫描与文档落盘 MUST 照常完成
- **AND** 报告 SHALL 含「Git 能力已跳过」的 WARN
