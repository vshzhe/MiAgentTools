# Design: add-spec-workflow

## Context

- **现有架构**（影响链，来自 Phase 2 影响分析）：`SKILL_TYPES`（[config.ts](../../../src/core/config.ts)）→ `WORKFLOW_PAIRS`（[registry.ts](../../../src/core/templates/registry.ts)）→ `runInit`/`runUpdate`/`runList`/`runValidate` → `buildProgram`（[cli/index.ts](../../../src/cli/index.ts)）
- **源项目参考**：OpenSpec 自定义分支 = 模板生成器（`src/core/templates/workflows/*.ts`）+ CLI 状态机（`src/commands/workflow/` + `src/core/artifact-graph/`）双层结构
- **关键决策已确认**（见 exploration.md Decisions 1-10 与 ADR-0001）：venus CLI 自研 spec 命令组，零 openspec CLI 依赖；沿用 openspec/ 目录约定；依赖图内置硬编码；CLI 移动 + AI 合并；.openspec.yaml 兼容元数据

## Goals / Non-Goals

**Goals**：
- 6 个 spec 技能融入模板体系（venus init 安装、list 分组、validate 校验、update 刷新）
- venus CLI 新增 `spec` 子命令组（new / status / instructions / archive），提供确定性状态校验
- 技能正文调用 `venus spec` 命令驱动流程（替代源项目的 `openspec` 命令调用）

**Non-Goals**（明确不迁移）：
- 源项目的 workflow / auto-workflow / debug / auto-migration / feature-doc-generator / migration-checker / create-requirement-doc 等衍生技能（用户未要求）
- openspec 的 store 多仓机制、schema.yaml 三级解析（用户决策：依赖图硬编码）
- CLI 降级模式（venus 自身即 CLI，天然可用，无需降级）
- openspec validate 的完整规则集（归档校验仅检查 tasks 勾选完成度）

## Decisions

### D1: 新增 `src/core/spec/` 独立模块承载状态机
- **选择**：spec 命令核心逻辑放 `src/core/spec/`（schema.ts 依赖图常量 / status.ts 状态校验 / instructions.ts 模板分发 / new-change.ts 骨架创建 / archive.ts 归档移动 / templates/ 四个 artifact 模板），命令入口在 `src/commands/spec.ts`
- **理由**：状态机是确定性纯逻辑（文件存在性 + 拓扑排序），与模板体系（SkillTemplate）职责不同，独立模块避免 registry 膨胀
- **备选**：并入 `src/core/templates/`（否决：技能模板与变更状态机语义不同，混放增加耦合）

### D2: 依赖图硬编码为共享常量
- **选择**：`SPEC_DRIVEN_SCHEMA` 常量（artifacts[].requires + apply.requires + apply.tracks），new/status/instructions/archive 四命令共享引用
- **理由**：单一事实源；不读外部 schema.yaml（ADR-0001）
- **实现要点**：Kahn 拓扑排序按声明序（同 v1120 `ArtifactGraph.getBuildOrder` 语义）；status 判定 done（文件/glob 存在）/ ready（依赖满足且未完成）/ blocked（missingDeps）

### D3: 技能模板遵循 tr-* 文件组织模式
- **选择**：`src/core/templates/workflows/` 下新增 6 文件：spec-explore.ts / spec-propose.ts / spec-apply.ts / spec-archive.ts / spec-verify.ts / spec-verify-proposal.ts，每文件导出 `getSpec<Name>SkillTemplate()` + `getSpec<Name>CommandTemplate()` 两个工厂
- **理由**：与现有 7 个 tr-*.ts 完全同构，registry.ts 只需追加 6 个 import + WORKFLOW_PAIRS 条目

### D4: CLI 用 commander 嵌套子命令
- **选择**：`program.addCommand(specCommand)`，specCommand 下挂 new/status/instructions/archive 四个 `.command()`（用法 `venus spec new "<name>"`），而非平铺 spec-new
- **理由**：命令组语义自然（源项目 openspec new change 同模式）；现有平铺命令不受影响
- **风险**：`venus completion` 补全脚本需覆盖二级命令（现有 completion.ts 生成逻辑基于命令清单，需确认嵌套支持）

### D5: status/instructions 的 JSON 契约对齐源项目字段名
- **选择**：字段名与源项目保持一致（changeName / changeRoot / artifacts[].{id,status,requires,missingDeps} / applyRequires / progress.{total,complete,remaining} / template / outputPath / resolvedOutputPath / dependencies / unlocks）
- **理由**：技能正文从源项目迁移时只需替换命令名（openspec → venus spec），语义零转换，降低迁移错误率

### D6: archive 归档目录与移动策略
- **选择**：目标 `openspec/changes/archive/YYYY-MM-DD-<name>/`（名称已含日期前缀则不叠加，同源项目）；Node `fs.renameSync` 移动，Windows EPERM/EXDEV 时回退 copy+delete
- **理由**：与 openspec CLI 互认的目录约定；源项目已有 Windows 回退先例（copyDirRecursive）

### D7: .openspec.yaml 元数据写入格式
- **选择**：`schema: spec-driven` + `created: <YYYY-MM-DD>` + 可选 `goal`，YAML 手写序列化（简单字段，不引入 yaml 依赖）
- **理由**：与 openspec CLI 互认；读取侧仅解析这三个标量字段（容忍未知字段），无完整 YAML 解析需求

### D8: 技能 allowedTools 白名单
- **选择**：spec 技能统一 `Bash(venus:*)` + `Bash(codegraph:*)` + Read/Write/Edit/Glob/Grep（探索与合并需要），各技能按正文实际命令微调
- **理由**：权限白名单必须覆盖正文实际调用的命令（venus spec 子命令、codegraph sync 等），否则 Claude Code 权限拦截

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 技能正文极长（源项目单技能正文数百行），模板字符串难维护 | 分节模板字符串 + 复用公共片段常量（如 CodeGraph 首动作守卫文本抽为共享常量） |
| .openspec.yaml 兼容格式假设可能与 openspec CLI 实际解析不一致 | tasks 中含对源项目实际文件的比对验证任务；写入手动 YAML 转义校验测试 |
| completion.ts 对嵌套子命令的补全支持未验证 | tasks 中含补全适配验证任务（失败则 spec 命令暂时从补全清单排除并 WARN） |
| D1-D9 评分逻辑内嵌技能正文（纯提示词），无可执行代码 | 源项目同此模式（AI 驱动评分）；spec-verify-proposal 正文给出评分表与计算规则，验证阶段以场景覆盖测试评估 |

## Migration Plan

无破坏性变更，增量交付：
1. 先实现 `src/core/spec/` 状态机 + CLI 注册（可独立验证：venus spec new/status/archive 全链路）
2. 再实现 6 个技能模板 + registry 注册（venus init/install 联动）
3. 最后适配 validate/list/update（类型扩展自动生效，仅需测试覆盖）

## Open Questions

（无 —— 全部决策已在探索阶段经用户确认，见 exploration.md Questions Q1-Q9）
