## Context

- **模板双写现状**：`src/core/templates/workflows/spec-*.ts` 共 7 个文件（explore / propose / apply / archive / bulk-archive / verify / verify-proposal），每个导出 `getSpecXxxSkillTemplate()`（instructions 全文）与 `getSpecXxxCommandTemplate()`（content 压缩版）两份字符串，由 `registry.ts` 的 WORKFLOW_PAIRS 成对注册（[registry.ts:116-119](src/core/templates/registry.ts#L116-L119)）。实测 4 处漂移（见 exploration.md Codebase Findings）。
- **tr-*.ts 同为双模板结构**（如 tr-init.ts 同样导出 Skill + Command 两个函数），但探索阶段仅对 spec-*.ts 采集了漂移证据，且 CLI 能力变更仅服务 spec 工作流——本次范围限定 spec-*.ts。
- **CLI 现状**：`src/commands/spec.ts` 实现四命令（new / status / instructions / archive），内置 spec-driven 依赖图常量（proposal → specs ∥ design → tasks；apply.requires = [tasks]），Kahn 拓扑排序，不读外部 schema（ADR-0001，保持有效）。
- **command-generation 基础设施**：`src/core/command-generation/` 已有 generator / yaml / adapters（claude.ts）派生体系，command 文件由 generateCommand 从 CommandTemplate 生成——本次重构发生在 CommandTemplate.content 的**生产侧**，不触碰该模块的下游。
- **测试基线**：`test/skills-parity.test.ts` 已有"模板 ↔ skills/ 快照"一致性先例，可仿照建立"skill instructions ↔ command content"派生一致性测试。

## Goals / Non-Goals

**Goals**:
- spec-*.ts 单一 prompt 源：正文仅维护 skill instructions 一份，command content 由代码派生
- 消除 4 处历史漂移（含 archive 步骤 6.5 错序重排）
- 回填 v1.1.20 防护语句到唯一源（apply 判定标准与 scope-creep 防护、propose Planning Boundary、explore 写入确认门、re-read from disk、材料性歧义划分、required set 传递闭包）
- CLI `venus spec instructions apply --change <name> --json`（contextFiles / progress / task list / 动态 instruction）
- CLI 支持 `skip_specs` 声明（skipped 状态语义）
- AGENTS.md 修改守则第 7 条更新为"已落地"状态

**Non-Goals**:
- 多 schema 支持（用户裁决暂不做；ADR-0001"依赖图硬编码、不读外部 schema.yaml"保持有效）
- store 多仓库机制（OpenSpec 特有，Venus 无此概念）
- archive"零确认 + sync 失败不阻断"策略调整（已确认为服务 auto-workflow 的刻意设计，保持现状）
- tr-*.ts 模板的单一源化（同为双模板结构但无漂移证据采集，如需可另立变更）
- context / operationGuidance 的项目配置注入机制（v1.1.20 的运行时指导注入，本次仅预留 instructions apply 的字段位置，不实现配置读取——避免与 `.venus/config.yaml` 的规则注入体系耦合扩大范围）

## Decisions

### D1: 唯一源载体——TS 内嵌字符串保留，CommandTemplate.content 改派生
- **选择**: spec-*.ts 保留 `getSpecXxxSkillTemplate()` 导出作为唯一源（instructions 全文）；`getSpecXxxCommandTemplate()` 内部改为调用统一派生函数，不再持有独立维护的字符串。
- **理由**: 与现有模板体系（registry + command-generation）改动最小；skills-parity 测试链不变；无构建链变更。
- **备选**: ①外置 `.md` prompt 文件 + TS 导入（利于非代码编辑与 diff，但改构建与打包链，收益不成比例）；②CommandTemplate 完全删除、生成侧直接从 SkillTemplate 派生（改动 registry 消费方，波及 generate/update/uninstall 多命令）。

### D2: command 压缩版派生策略——段落标记裁剪，默认保留
- **选择**: 唯一源正文中以成对 HTML 注释标记可裁剪段落（`<!-- CMD:SKIP -->` 起始、`<!-- /CMD:SKIP -->` 结束），派生函数剥离标记段落得到 command content。**未标记段落默认保留**（fail-safe）。
- **理由**: command 版历史上是"去示例留核心"的压缩，标记法保留人工裁剪意图、确定性强、可单测；**默认保留是漂移教训的直接应用**——propose 蓝图确认句之所以在 command 版缺失，正是人工裁剪时漏掉了防护语句；标记策略下漏标段落只会进入 command（更长），不会缺失（防护缺口）。HTML 注释在 markdown 渲染中不可见，不污染正文可读性。
- **备选**: ①全量截断（command = 全文，prompt 膨胀 2-3 倍，apply 场景每次命令调用多消耗数百行上下文）；②模板变量替换引擎（引入新语法与转义复杂度，不成比例）。

### D3: 派生函数位置——新文件 `src/core/templates/derive-command.ts`
- **选择**: 纯函数 `deriveCommandContent(instructions: string): string`，输入唯一源正文，输出 command content；由各 `getSpecXxxCommandTemplate()` 调用。
- **理由**: 与 registry.ts 同层（模板层），不与 command-generation（产物生成层）职责混淆；纯函数易于对 7 个工作流做参数化测试。
- **备选**: ①并入 types.ts（接口文件不该承载逻辑）；②扩展 command-generation/generator.ts（职责越界：那是"模板→文件"的产物生成，非"模板→模板"的派生）。

### D4: instructions apply 的实现——复用内置依赖图与 tasks 解析
- **选择**: `src/commands/spec.ts` 的 instructions 命令新增 `apply` artifact 分支：contextFiles 按 artifactPaths 既有解析生成（proposal/specs/design/tasks → 具体路径）；progress 复用 tasks.md 勾选统计逻辑；动态 instruction 按状态机输出三态指导（blocked → 提示补齐 artifact、ready → 核心实现指导、all_done → 归档建议）。JSON 响应包含 `contextFiles` / `progress` / `taskList` / `instruction` 四字段（`context` / `operationGuidance` 字段本次不实现，见 Non-Goals）。
- **理由**: 完全复用现有解析与依赖图基础设施，无新数据源；apply 模板正文从"直接读文件"改回"CLI 获取"的标准化路径。
- **备选**: 独立 `venus spec apply-instructions` 新命令（命令表膨胀，且 instructions 语义上就是 artifact 级分发）。

### D5: skip_specs 语义——布尔声明，对齐源项目
- **选择**: `.openspec.yaml` 新增可选布尔字段 `skip_specs`。声明时：status 将 specs artifact 报告为 `skipped`（视为满足，非缺失）；instructions 对 specs 返回跳过指导；apply 的 required set 将 skipped 计为满足。未声明（缺省）行为完全不变。
- **理由**: 对齐 OpenSpec v1.1.20 的声明式语义（"the change declares skip_specs in .openspec.yaml"）；布尔最简且覆盖"纯代码/纯文档变更无 delta spec"的主场景。
- **备选**: capability 列表（跳过部分 capability）——源项目亦未支持，无真实需求，留待有需要时扩展。

### D6: apply 模板版本兼容——命令失败回退直接读文件
- **选择**: apply 模板正文改为"优先 `venus spec instructions apply --change <name> --json`；命令不可用或非零退出（旧版 CLI）时，回退直接读变更目录 artifact 文件（保留现有路径作为兼容分支）"。
- **理由**: venus 技能安装到目标项目 `.claude/`，与目标项目的 venus CLI 版本独立演进，无法强制同步；回退分支是模板既有模式（CodeGraph 不可用回退 Glob/Grep 同款）。
- **备选**: 声明最低 CLI 版本并在技能 frontmatter 检查（引入版本协商机制，复杂度不成比例）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 标记语法破坏唯一源正文可读性 | HTML 注释形式对 markdown 渲染不可见；标记仅段落级，不引入行内语法 |
| 防护语句回填改变技能行为（确认门更严格） | 属预期增强；确认门已有 auto-mode 跳过设计，auto-workflow 全自动路径不受影响 |
| 技能新版 + 目标项目旧版 CLI 组合下 instructions apply 不可用 | D6 回退分支：命令失败回退直接读文件，与 CodeGraph 回退同款模式 |
| 派生函数 bug 导致 command 内容静默缺失 | 强制派生一致性测试：7 个工作流逐一断言 `command.content === deriveCommandContent(skill.instructions)`；并保留 skills-parity 快照测试双保险 |
| skip_specs 声明但 specs 文件仍被手动创建（声明与文件冲突） | status 输出 WARN 提示冲突（"声明 skip_specs 但 specs 文件存在"），不做强制删除——删除需用户显式操作 |
| skip_specs 变更归档时主 spec 不会同步 | archive 模板 guardrail 明确：遇 skip_specs 声明的变更，归档摘要注明"主规格未同步（skip_specs 声明）"，避免误以为遗漏 |
| 重构后 command 版内容整体变化（历史压缩段落被标记保留） | `venus update` 的 generatedBy 手改保护机制不受影响；skills/ 快照重新生成属预期变更，提交前 diff 审查 |
