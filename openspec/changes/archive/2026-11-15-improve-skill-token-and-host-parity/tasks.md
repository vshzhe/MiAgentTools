# Tasks

## 1. 模板与测试实现

- [x] [代码] 1.1 扩展 `test/skill-size-budget.test.ts`：新增 20,000 字符预算断言（`fileContent.length`，含 frontmatter），保留 500 行断言 [N4]
  - 产出: test/skill-size-budget.test.ts
  - Spec Ref: template-generation / SKILL.md 渐进披露与尺寸预算
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 主文件双重预算
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 字符预算测量口径固定

- [x] [代码] 1.2 收敛 `iagent-debug` 主 SKILL 至双预算：压缩重复 Guardrails，将参考性细则下沉 `references/investigation-protocol.md` / `references/gates-and-rules.md`，保留控制流与确认门 [N1][N3]
  - 产出: src/core/templates/workflows/debug.ts
  - Spec Ref: template-generation / SKILL.md 渐进披露与尺寸预算
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 控制流内容保留主文件
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 语义零变化
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 尺寸预算对最终形态生效

- [x] [代码] 1.3 收敛 `iagent-spec-apply` 主 SKILL 至双预算：压缩 §8 编译门 / §9 测试门摘要，细则留在 `references/compile-check.md`，不改变门语义 [N1][N3]
  - 产出: src/core/templates/workflows/spec-apply.ts
  - Spec Ref: template-generation / SKILL.md 渐进披露与尺寸预算
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 控制流内容保留主文件
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 语义零变化
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 尺寸预算对最终形态生效

- [x] [代码] 1.4 收敛 `iagent-workflow` 主 SKILL 至双预算：删除重复检查点日志示例、压缩 Guardrails，验证细则留在 `references/verification-protocol.md` [N1][N3]
  - 产出: src/core/templates/workflows/workflow.ts
  - Spec Ref: template-generation / SKILL.md 渐进披露与尺寸预算
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 控制流内容保留主文件
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 语义零变化
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 尺寸预算对最终形态生效

- [x] [代码] 1.5 收敛 `iagent-spec-bulk-archive` 主 SKILL 至双预算：压缩批量校验 / 冲突裁决的参考性细则，保留阶段与门 [N1][N3]
  - 产出: src/core/templates/workflows/spec-bulk-archive.ts
  - Spec Ref: template-generation / SKILL.md 渐进披露与尺寸预算
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 控制流内容保留主文件
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 语义零变化
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 尺寸预算对最终形态生效

- [x] [代码] 1.6 收敛 `iagent-auto-workflow`：删除对测试门 / 一致性门 / review / 归档索引与清理协议的复述，合并重复 Guardrails；仅保留阶段顺序、门承载、回执字段与证据就绪判定 [N1][N3]
  - 产出: src/core/templates/workflows/auto-workflow.ts
  - Spec Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 子技能协议单一源
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / Guardrails 不复述阶段正文
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 归档阶段门与协议声明一致

- [x] [代码] 1.7 宿主工具词中立化：`TodoWrite` 改为「宿主待办工具（可用时）」；`mcp__codegraph__*` / `mcp__plugin_semgrep_*` 改为 `codegraph_*` / `semgrep_scan` 等中立名或「宿主暴露的 MCP 工具」表述 [N1][N3]
  - 产出: src/core/templates/workflows/spec-explore.ts, debug.ts, migration-check.ts, spec-propose.ts, workflow.ts, auto-workflow.ts
  - Spec Ref: template-generation / Template bodies are host-neutral
  - Scenario Ref: template-generation / Template bodies are host-neutral / 模板正文无宿主工具名
  - Scenario Ref: template-generation / Template bodies are host-neutral / 生成期注入宿主机制
  - Spec Ref: codegraph-call-protocol / CodeGraph primary channel and optional channels
  - Scenario Ref: codegraph-call-protocol / CodeGraph primary channel and optional channels / 模板正文工具名宿主中立
  - Scenario Ref: codegraph-call-protocol / CodeGraph primary channel and optional channels / Semgrep 可选增强

- [x] [代码] 1.8 同步文档与注释：22→23 计数（`AGENTS.md`、`docs/project/**`）；修正 `workflows.ts` 归档门注释、`prompt-gate.ts` 技能数注释；清理 `spec-explore` 重复分隔线 [N1][N2]
  - Spec Ref: workflow-suite-skills / Documentation counts reflect actual project state
  - Scenario Ref: workflow-suite-skills / Documentation counts reflect actual project state / 技能模板计数与实测一致
  - Scenario Ref: workflow-suite-skills / Documentation counts reflect actual project state / 文档计数与实测一致
  - Spec Ref: template-generation / 技能命名与注释一致性
  - Scenario Ref: template-generation / 技能命名与注释一致性 / 门协议导言使用集合与注释一致
  - Scenario Ref: template-generation / 技能命名与注释一致性 / 注释不重复计数
  - Scenario Ref: template-generation / 技能命名与注释一致性 / Phase 编号连续
  - 产出: AGENTS.md, docs/project/architecture/技术框架.md, docs/project/modules/模块与功能点.md, src/core/host-orchestration/workflows.ts, src/core/templates/prompt-gate.ts

- [x] [代码] 1.9 刷新本机 `.opencode` dogfood 产物（gitignored、不提交）：运行 `iagent update` 或等价生成，使 auto-workflow 含归档门且补齐 `spec-update`；失败仅 WARN [N5]
  - 产出: .opencode/skills/** (gitignored)
  - Spec Ref: template-generation / SKILL.md 渐进披露与尺寸预算
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / references 随 update 同步无残留

## 2. 测试与验证

- [x] [测试][单元][P0] 2.1 新增/更新回归锁：字符预算、宿主工具词扫描（`TodoWrite` / `mcp__*` 白名单例外）、文档计数 23 [N4]
  - Spec Ref: template-generation / SKILL.md 渐进披露与尺寸预算
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 主文件双重预算
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 字符预算测量口径固定
  - Spec Ref: template-generation / Template bodies are host-neutral
  - Scenario Ref: template-generation / Template bodies are host-neutral / 宿主工具词回归锁
  - Spec Ref: workflow-suite-skills / Documentation counts reflect actual project state
  - Scenario Ref: workflow-suite-skills / Documentation counts reflect actual project state / 技能模板计数与实测一致
  - Scenario Ref: template-generation / Template bodies are host-neutral / 模板正文无宿主工具名
  - Scenario Ref: template-generation / Template bodies are host-neutral / 生成期注入宿主机制
  - Scenario Ref: template-generation / 技能命名与注释一致性 / 注释不重复计数
  - Scenario Ref: template-generation / 技能命名与注释一致性 / 门协议导言使用集合与注释一致
  - Scenario Ref: template-generation / 技能命名与注释一致性 / Phase 编号连续
  - Scenario Ref: codegraph-call-protocol / CodeGraph primary channel and optional channels / Semgrep 可选增强
  - Scenario Ref: workflow-suite-skills / Documentation counts reflect actual project state / 文档计数与实测一致

- [x] [测试][单元][P0] 2.2 auto-workflow 回归：Phase 4/5 内联、测试门继承、门账本兜底、两者皆缺时设计门照常触发、单一源与 Guardrails 不复述 [N4]
  - Spec Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / Phase 4 内联而非子代理
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / Phase 5 内联而非子代理
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 测试执行门继承
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 门账本兜底
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 两者皆缺时设计门照常触发
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 子技能协议单一源
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / Guardrails 不复述阶段正文
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 归档阶段门与协议声明一致

- [x] [测试][单元][P0] 2.3 全量回归与生成一致性：`pnpm build && pnpm generate:skills`、`pnpm test`；核对 references 引用存在、CodeGraph 三通道降级、`iagent update` 同步无残留 [N4][N5][N6][N7][N7R][N8][N9]
  - Spec Ref: template-generation / SKILL.md 渐进披露与尺寸预算
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / references 引用存在
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / references 随 update 同步无残留
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 尺寸预算对最终形态生效
  - Spec Ref: codegraph-call-protocol / CodeGraph primary channel and optional channels
  - Scenario Ref: codegraph-call-protocol / CodeGraph primary channel and optional channels / 宿主仅暴露主通道时扫描仍完成
  - Scenario Ref: codegraph-call-protocol / CodeGraph primary channel and optional channels / 可选通道存在时增强而非替代
  - Scenario Ref: codegraph-call-protocol / CodeGraph primary channel and optional channels / 探测失败才降级内置工具

- [x] [测试][单元][P0] 2.4 硬约束验证：主 SKILL ≤20,000 字符且 ≤500 行；确认门 / 阶段顺序 / allowedTools 不变；子技能协议单一源；生成产物由源重建；`.opencode` 刷新不进入提交面 [N4][N10]
  - Spec Ref: template-generation / SKILL.md 渐进披露与尺寸预算
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 控制流内容保留主文件
  - Scenario Ref: template-generation / SKILL.md 渐进披露与尺寸预算 / 语义零变化
  - Spec Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议 / 子技能协议单一源
  - Spec Ref: codegraph-call-protocol / CodeGraph primary channel and optional channels
  - Scenario Ref: codegraph-call-protocol / CodeGraph primary channel and optional channels / 模板正文工具名宿主中立
