## Context

VenusAgentTools 现有生成链路（来自探索阶段分析，见 `openspec/explorations/profile-config.md`）：

```
registry.ts → WORKFLOW_PAIRS（硬编码 14 对，无 workflowId 标识）
              ↓ getSkillTemplates() / getCommandTemplates()
              （仅支持按 SkillType 过滤，init/update 路径未使用过滤）
init.ts / update.ts → 全量安装/刷新 14 个（纯加法，无 reconcile）
```

- `.venus/config.yaml` 仅含 `context` + `rules`（管规则注入，不管装哪些）
- 参考实现 OpenSpec v1.12 的 profile 架构：全局 config.json 的 `profile`/`workflows` → `getProfileWorkflows()` 依赖注入（archive⇒sync）→ `getSkillTemplates(workflowFilter)` 过滤 → init 双向 reconcile。本变更借鉴其依赖注入与过滤模式，但配置层级定为项目级、不引入 core/custom 标签。

影响链：模板注册表（workflowId 挂载）→ profile 解析（默认集+依赖注入）→ 项目配置（workflows 字段）→ init/update（过滤+reconcile）→ config 命令（交互入口）→ onboarding（按默认集过滤）。

## Goals / Non-Goals

**Goals**:
- 用户可通过 `.venus/config.yaml` 的 `workflows` 字段声明本项目需要哪些 workflow
- `init`/`update` 按声明集过滤生成，默认集覆盖最常见的规格驱动闭环（7 项）
- 依赖注入自动补全语义依赖（propose⇒verify-proposal, archive⇒verify），用户少操心隐藏依赖
- 提供 `venus config` 交互式入口与非交互 `--set`，覆盖人工与脚本场景
- 已安装产物永不被自动删除，配置缩小时仅提示

**Non-Goals**:
- 不做全局/机器级配置（VenusAgentTools 不同项目需求差异大，项目级足够）
- 不引入 `core`/`custom` profile 标签（扁平 workflows 列表更简单）
- 不做 `delivery` 维度（skills/commands/both，VenusAgentTools 当前只支持 claude，无需）
- 不做自动 reconcile 删除（保留+提示，用户数据安全优先）
- 不重构现有 tr_* 技能内容，仅调整其是否被安装

## Decisions

### D1: 配置层级=项目级
- **选择**: 配置放 `.venus/config.yaml`（与现有 context/rules 同处），不引入全局配置层
- **理由**: VenusAgentTools 不同项目对指令集需求差异大（小工具 vs spec 工作流项目），项目级语义"这个项目要什么"最清晰；与现有 context/rules 字段同处一个文件，认知负担低
- **备选**: 全局 `~/.config/venus/config.json`（OpenSpec 模式）—— 否决，因项目差异大，全局默认会被频繁覆盖；且 VenusAgentTools 已有 `.venus/` 项目配置基础设施

### D2: 默认集=tr-init-project + spec 全 6（共 7 项）
- **选择**: `DEFAULT_WORKFLOWS = [tr-init-project, spec-explore, spec-propose, spec-apply, spec-archive, spec-verify, spec-verify-proposal]`
- **理由**: `tr-init-project` 是任何项目起步必需；spec 全 6 个构成"探索→提案→评分门→实现→验证→归档"完整规格驱动闭环，覆盖最常见开发路径
- **备选**: (a) tr 全部默认 —— 否决，tr 类会持续膨胀，且 impl/test/commit/review/release 非每项目必需；(b) 仅 spec 核心 4 个（explore/propose/apply/archive）不含 verify —— 否决，verify-proposal 是提案质量门、verify 是归档前验证，属闭环必需，去掉会破坏工作流完整性

### D3: 依赖注入规则=propose⇒verify-proposal, archive⇒verify, apply不注入
- **选择**: 两条注入规则，apply 不触发注入
- **理由**: 从规则文件（"提案实现前必须通过 venus_spec_verify_proposal 评分门"）与 SKILL.md（propose 提到 PASS≥90% 后才内联复查；verify 职责为"实现完成后、归档前验证"）推断的语义依赖
- **备选**: (a) apply⇒verify-proposal —— 否决，apply 时假设 propose 阶段已过评分门，重复注入冗余；(b) 不做注入，全靠用户手选 —— 否决，隐藏依赖易漏选导致工作流断裂

### D4: workflows 字段语义=扁平列表，缺失即默认，不引入标签
- **选择**: `.venus/config.yaml` 新增 `workflows: [id, ...]` 平铺列表；字段缺失→DEFAULT_WORKFLOWS；字段存在→用户配置覆盖；不引入 core/custom 标签
- **理由**: 比 OpenSpec 的 `profile: core|custom` + `workflows[]` 双层更扁平；VenusAgentTools 无需"语义化默认集标签"概念，列表本身即配置
- **备选**: core/custom 双层标签（OpenSpec 模式）—— 否决，对当前规模过度设计；deriveProfileFromWorkflowSelection 的"勾选等于 core 集则识别为 core"逻辑增加复杂度，无收益
- **补充决策**: `venus config` 交互确认后 SHALL 总是写入显式列表（无论是否等于默认集），保证配置可见可复现，而非"等于默认就不写"

### D5: init/update 过滤生成 + reconcile 保留不删
- **选择**: init/update 按生效集过滤生成；扫描到"已安装但不在集中"的产物时保留不删，仅输出提示
- **理由**: 自动删除用户已安装产物风险高（用户可能手改/依赖），保留+提示让用户显式决定（venus uninstall 或手动删）
- **备选**: OpenSpec 式自动 reconcile 删除（removeSkillDirs 双向收敛）—— 否决，VenusAgentTools 现有 init/update 是纯加法、无删除路径，引入自动删除破坏最小改动原则且风险高

### D6: venus config 命令三模式=交互/show/--set
- **选择**: `venus config`（@inquirer/prompts 交互勾选）、`venus config show`（打印）、`venus config --set <list>`（非交互写回）
- **理由**: 交互给人用、--set 给脚本/CI 用、show 给查看用，覆盖全场景；现有命令均支持脚本化（--yes/--json），config 需对齐
- **备选**: 仅交互式 —— 否决，CI/自动化场景无法用；仅 --set 非交互 —— 否决，人工配置体验差

### D7: 交互库=@inquirer/prompts
- **选择**: 引入 `@inquirer/prompts` 运行依赖（OpenSpec 同款）
- **理由**: checkbox 多选组件成熟、跨平台（Windows bash/powershell 兼容）、维护活跃；与 OpenSpec 选型一致降低学习成本
- **备选**: Node 内置 readline 手搓多选 —— 否决，零依赖但体验粗糙（无光标勾选 UI），Windows 终端兼容性差

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| BREAKING：init 默认行为从全量 14 变为默认集 7，老用户升级后 init 只装 7 个 | 已装产物不删；迁移策略：`venus config --set <全量>` 可恢复；README/CHANGELOG 显式标注 |
| 新增 `@inquirer/prompts` 运行依赖，影响打包体积与零依赖偏好 | 依赖轻量（无原生编译），build.js 打包已支持 ESM；CHANGELOG 标注 |
| 依赖注入规则未来扩展（新增 spec-* 技能时可能需新规则） | 注入规则表数据化（`DEPS: Record<workflowId, workflowId[]>`），新增规则只改表不改逻辑 |
| workflowId 复用 `deriveCommandId` 派生结果，与技能名耦合 | 派生函数已有单测覆盖；registry 挂 workflowId 时复用同一派生，保证一致 |
| `venus config` 交互式在非 TTY 环境（CI/管道）行为 | 非交互 `--set` 覆盖脚本场景；交互式检测非 TTY 时降级为提示用 `--set` |
