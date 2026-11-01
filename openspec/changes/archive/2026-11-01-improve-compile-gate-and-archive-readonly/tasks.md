# Tasks: improve-compile-gate-and-archive-readonly

> 任务类型标签：[代码] 实现 / [测试] 测试代码。
> 测试任务带**层级**（[单元]）与**优先级**（[P0]/[P1]/[P2]）。
> 节点标注（`[N3]` / `[M8]`）对应探索文件「功能流程图」的已确认节点 id —— 任务与流程基准逐节点可核对。
> **追溯约定**：`Spec Ref` 每行一个（`<capability> / <Requirement>`），`Scenario Ref` 每行一个（`<Scenario 名>`）；测试任务按需求分组并逐条枚举其覆盖的全部 Scenario。

## 1. 配置层：`compileCheck` 单一源（N3）

- [x] 1.1 [代码] 在 `project-config.ts` 新增 `CompileCheckConfig` 接口与 `DEFAULT_COMPILE_CHECK` 常量（`enabled=true` / `command=''` / `timeoutMs=600000` / `incremental=true` / `autoFix=true` / `maxRetries=3`）[N3]
  - 文件：`src/core/project-config.ts`
  - Spec Ref：compile-check-gate / compileCheck 配置契约与默认值单一源
  - 验证：`pnpm build`；常量被解析层与 `config show` 共同引用，全仓无第二份默认值

- [x] 1.2 [代码] 实现 `parseCompileCheck(raw)` 与 `resolveCompileCheck(...)`：解析 `compileCheck` 段（缺段/缺字段取默认；布尔/正整数/字符串非法值回退默认并收集 WARN；未知字段忽略并 WARN），并在 `ResolvedProjectConfig` 暴露 `compileCheck`、段级 `compileCheckSource`（`config` / `default`）与 `compileCheckWarnings`；`ProjectConfig.compileCheck` 仅承载**原始解析结果**（字段可选、缺失即 undefined），不得提前填默认值 [N3]
  - 文件：`src/core/project-config.ts`
  - Spec Ref：compile-check-gate / compileCheck 配置契约与默认值单一源
  - 验证：1.5 单元测试覆盖缺省、显式禁用、非法值回退；`readProjectConfig` 返回的 `compileCheck` 已补默认且 `compileCheckSource` 与段存在性一致，`compileCheckWarnings` 含逐字段回退项

- [x] 1.3 [代码] 扩展 `defaultConfigFileContent()`：在 `tools` 段后追加带注释的 `compileCheck` 注释示例（缺省启用、`command` 留空=自动探测）；并修正同函数上方「默认集（7 项）」的过期注释 —— 未配置时默认集是 `DEFAULT_WORKFLOWS` 的 8 项（含 `test`），写回的默认内容仍是 7 项显式（`test` 由 `spec-apply ⇒ test` 注入）[N3]
  - 文件：`src/core/project-config.ts`
  - Spec Ref：compile-check-gate / compileCheck 配置契约与默认值单一源
  - 验证：新建项目 `iagent init` 生成的 `config.yaml` 含该段，解析结果等于默认值

- [x] 1.4 [代码] `runConfigShow` 输出生效 `compileCheck` 六项取值与段级来源标注（用户配置 / 默认值），并输出 `compileCheckWarnings`（非法字段：字段名 + 回退值）；`.iagent/config.yaml` 不存在时按默认值展示且不误报为用户配置 [N3]
  - 文件：`src/commands/config.ts`
  - Spec Ref：skill-profile / iagent config show
  - Spec Ref：compile-check-gate / iagent config show 展示生效编译检查配置
  - 验证：8.2 测试断言默认值、用户覆盖值与非法回退 WARN 三类输出

- [x] 1.5 [测试][单元][P0] 新增配置解析测试：缺段即启用、显式 `enabled: false`、非法 `maxRetries` / 非法布尔回退并 WARN、`command` 空白视为自动探测、默认配置内容含 `compileCheck` 段
  - 文件：`test/project-config-compile-check.test.ts`（新增）、`test/completion-config.test.ts`（默认配置内容与解析断言回归）
  - Spec Ref：compile-check-gate / compileCheck 配置契约与默认值单一源
  - Scenario Ref：缺省即启用
  - Scenario Ref：项目级显式禁用
  - Scenario Ref：非法取值回退默认并告警
  - 验证：`pnpm vitest run test/project-config-compile-check.test.ts`

## 2. 模板层：`spec-apply` 编译硬门（N3–N12）

- [x] 2.1 [代码] 重写 Step 8 骨架：8.1 读 `.iagent/config.yaml` 的 `compileCheck`（段/字段缺失时经 `iagent config show` 取生效默认值；`openspec/config.yaml` 旧位置仅 WARN）→ 8.2 判定启用（`disabled` **仍须写 disabled 证据**再进 Step 9，不得直接跳过证据）→ 8.3 变更范围降级链 → 8.4 命令三级判定 → 8.5 执行与退出码捕获 → 8.6 失败判定（含 `autoFix=false` 直接 fail）→ 8.7 自动修复循环（`autoFix=true`）→ 8.8 写证据 → 8.9 硬失败暂停；lint / 前端校验保留为辅助项（失败仅 WARN，不参与终态）[N3][N4][N5][N6][N7][N8][N9][N10]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref：spec-workflow-skills / spec-apply 实现技能
  - Spec Ref：compile-check-gate / 编译检查硬门与终态模型
  - Spec Ref：compile-check-gate / 编译命令的运行时判定
  - Spec Ref：compile-check-gate / compileCheck 配置契约与默认值单一源
  - 验证：2.10 / 2.11 模板断言

- [x] 2.2 [代码] 新建 `references/compile-check.md`（`SkillTemplate.references` 机制），下沉构建描述符探测矩阵、命令构造细则、monorepo 归组去重算法、证据文件模板与终态判定表；Step 8 正文改为「执行前 MUST 先 Read 该文件」，并保留内联摘要兜底 [N4][N5][N6][N9]
  - 文件：`src/core/templates/workflows/spec-apply.ts`（新增 `COMPILE_CHECK_DETAIL` 常量 + `references` 数组项）
  - Spec Ref：compile-check-gate / 编译检查细则的 references 下沉与预算约束
  - 验证：8.5 行数预算 + 9.1 快照断言

- [x] 2.3 [代码] 重写 8.3 变更范围识别为降级链（`tasks.md` 产出与 `Spec Ref` → `git diff` 含未跟踪 → 状态 JSON 的 `contextFiles` / `changeRoot`），三源皆不可得时以项目根为范围并在证据 `scope` 记 `project-root`；去掉 `allowedEditRoots` 依赖；每次降级记 WARN **同时清理 Step 2 的 workspace 护栏**：该段不得把 `allowedEditRoots` / `actionContext` 作为必需字段（`getChangeStatus` 不返回它们），缺失时以 `changeRoot` / `contextFiles` 继续并记 WARN [N5]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref：spec-workflow-skills / spec-apply 实现技能
  - Spec Ref：compile-check-gate / 编译命令的运行时判定
  - 验证：2.10 断言正文不再把 `allowedEditRoots` 作为必需字段（含 Step 2 与 Step 8 两处）

- [x] 2.4 [代码] 在 Step 6 批调度循环末尾挂载批后增量检查：`compileCheck.incremental=true` 时每批完成后**复用收尾全量的同一条命令**（显式 `command` 或描述符探测结果）对本次改动模块执行检查，失败进自动修复循环（与收尾全量同一重试预算），耗尽即写 `fail` 证据并暂停；`false` 时跳过并说明；**同时替换 `BATCH_SCHEDULING_FULL` 中「从 `openspec/config.yaml` 读取 `apply.incrementalCheck`」的旧段落**（否则旧配置仍是第二真源）[N2]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref：spec-workflow-skills / spec-apply 实现技能
  - Spec Ref：compile-check-gate / 编译检查硬门与终态模型
  - 验证：2.10 断言 Step 6 / references 不再出现 `apply.incrementalCheck`，且存在 `compileCheck.incremental` 段

- [x] 2.5 [代码] 8.8 实现证据写入：`.openspec-tmp/pipeline-<change-name>/compile-report.md` 九字段表格 + `**summary**:` 汇总行（任一 fail → fail；否则全 pass → pass；零命令时仅 not-applicable / disabled）；非执行终态的 `command` / `exitCode` / `scope` 记 `-`、`errorCount` / `fixedCount` 记 `0`；向 handoff 包 `## 阶段结论` 追加 `compile` 行（包缺失时先按六节协议产出一次），该行 status 使用编译四值而非回执状态 [N9]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref：compile-check-gate / 编译证据契约
  - Spec Ref：compile-check-gate / 编译证据生命周期
  - 验证：2.11 断言九字段名、`**summary**:`、`-` 占位约定与 `## 阶段结论` 追加语句均出现在正文

- [x] 2.6 [代码] 8.9 删除 `[3] 跳过并记录警告`，改为「暂停 + 报告剩余错误（含 `file:line`）」；`autoFix=false` 时首次失败直接进入本步；Output 模板删除「跳过检查并归档（记录警告）」，并按 `pass` / `not-applicable` / `disabled` 三种放行终态给出不同措辞（后两者显式写「未执行编译检查」类措辞，MUST NOT 写成「通过」）[N7][N8][N10]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref：spec-workflow-skills / spec-apply 实现技能
  - Spec Ref：compile-check-gate / 编译检查硬门与终态模型
  - 验证：2.10 断言正文与 Output 均不含「跳过检查」「跳过并记录警告」；2.11 断言 `disabled` / `not-applicable` 的差异化措辞

- [x] 2.7 [代码] Step 10 清理范围收敛为「临时脚本与草稿」，显式声明保留 `compile-report.md` 与 `handoff-pack.md` 至父流程归档收尾；**独立调用时保留证据并在摘要报告路径（清理责任移交用户）**；父流程调用时由归档收尾清理（不在 apply 内删除）[N12]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref：compile-check-gate / 编译证据生命周期
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - 验证：2.11 断言 Step 10 段落含保留语句与「归档收尾清理」指向

- [x] 2.8 [代码] 同步 Guardrails：把「给出归档建议前先解析编译错误并提供修复选项」等条目改为硬门口径；补「MUST NOT 伪造 `not-applicable` / `disabled`」「证据文件必须保留至归档收尾」两条 [N12][N14]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref：spec-workflow-skills / spec-apply 实现技能
  - 验证：2.10 断言 Guardrails 含新增两条

- [x] 2.9 [代码] 核对 `allowedTools` 与正文实际调用一致：描述符矩阵新增的 `yarn build`（`yarn.lock`）需真实授权 → **增列 `Bash(yarn:*)`**（既有条目覆盖 npm / pnpm / node / tsc / mvn / ant / gradle / go / cargo）；MUST NOT 新增未使用条目 [N6]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref：spec-workflow-skills / spec-apply 实现技能
  - 验证：`test/templates.test.ts` 2.10 的「描述符矩阵 ↔ allowedTools」一致性断言 + `test/allowed-tools.test.ts` 通过

- [x] 2.10 [测试][单元][P0] 模板断言（apply 编译段）：硬门无跳过出口、终态四值、配置载体为 `.iagent/config.yaml`（缺段经 `iagent config show` 取默认值）、`allowedEditRoots` 在 Step 2 与 Step 8 均不再必需、`compileCheck.incremental` 批后步骤存在且不再读 `apply.incrementalCheck`、旧配置位置仅 WARN、命令探测不固化本项目命令、`autoFix=false` 直接 fail、lint/前端辅助项仍在、Output 无「跳过检查并归档」
  - 文件：`test/templates.test.ts`（扩展）
  - Spec Ref：spec-workflow-skills / spec-apply 实现技能
  - Spec Ref：compile-check-gate / 编译命令的运行时判定
  - Spec Ref：compile-check-gate / 编译检查硬门与终态模型
  - Spec Ref：compile-check-gate / compileCheck 配置契约与默认值单一源
  - Spec Ref：compile-check-gate / 旧配置来源弃用（不双源）
  - Scenario Ref：编译检查读取新配置载体
  - Scenario Ref：编译命令按目标项目探测
  - Scenario Ref：编译检查硬门无跳过出口
  - Scenario Ref：无可编译产物记不适用
  - Scenario Ref：项目级显式禁用
  - Scenario Ref：变更范围来源降级
  - Scenario Ref：Step 2 护栏不依赖不存在的字段
  - Scenario Ref：批后增量检查
  - Scenario Ref：显式命令优先
  - Scenario Ref：按描述符探测（非本仓库项目）
  - Scenario Ref：monorepo 多描述符逐条执行并记录
  - Scenario Ref：失败后自动修复再重跑
  - Scenario Ref：显式关闭自动修复
  - Scenario Ref：批后增量检查复用同一命令
  - Scenario Ref：重试耗尽后暂停
  - Scenario Ref：无会话级跳过出口
  - Scenario Ref：超时与缺依赖计为失败
  - Scenario Ref：旧位置配置只告警不生效
  - Scenario Ref：incrementalCheck 收敛
  - 验证：`pnpm vitest run test/templates.test.ts`

- [x] 2.11 [测试][单元][P0] 模板断言（证据）：九个证据字段名齐全、`**summary**:` 汇总行与「任一 fail → fail」优先级、非执行终态 `-` 占位、`## 阶段结论` 追加 `compile` 行（编译四值而非回执状态）、Step 10 保留证据与 handoff 包、四终态均写证据
  - 文件：`test/templates.test.ts`（扩展，与 2.10 同文件不同用例）
  - Spec Ref：compile-check-gate / 编译证据契约
  - Spec Ref：compile-check-gate / 编译证据生命周期
  - Scenario Ref：编译证据产出与保留
  - Scenario Ref：成功时写证据
  - Scenario Ref：失败时仍写证据
  - Scenario Ref：不适用与禁用同样留痕
  - Scenario Ref：多命令按汇总行判定
  - Scenario Ref：收尾清理保留证据
  - Scenario Ref：独立调用保留证据并报告路径
  - 验证：`pnpm vitest run test/templates.test.ts`

- [x] 2.12 [测试][单元][P2] 回归核查（apply 既有行为）：设计门、任务上下文、勾选推进、scope-creep、`[测试]` 委派与路由、测试执行关卡、完成段精确暂存、派发协议与共享资源协议（handoff 包 / 回执 / 并发 / 降级）、**既有「编译检查阶段 / 最多 3 次」措辞断言按新正文更新** —— 确认本次改动未破坏这些既有断言（必要时仅更新措辞断言）
  - 文件：`test/templates.test.ts`（既有用例核对）、`test/spec-instructions-apply.test.ts`、`test/spec-workflow-contract.test.ts`
  - Spec Ref：spec-workflow-skills / spec-apply 实现技能
  - Scenario Ref：设计确认门
  - Scenario Ref：任务上下文获取
  - Scenario Ref：任务勾选推进
  - Scenario Ref：scope-creep 防护
  - Scenario Ref：[测试] 任务委派测试生成技能
  - Scenario Ref：[测试] 任务不按补充文档路由
  - Scenario Ref：未标注任务仍按代码实现处理
  - Scenario Ref：测试执行关卡运行变更范围
  - Scenario Ref：存量失败测试不阻塞
  - Scenario Ref：变更范围测试失败处置
  - Scenario Ref：项目无测试框架时降级
  - Scenario Ref：测试任务与实现任务的依赖串行
  - Scenario Ref：完成段精确暂存提案制品
  - Scenario Ref：暂存不使用全量添加
  - Scenario Ref：暂存后不自动提交
  - Scenario Ref：暂存失败不阻断收尾
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref：跨阶段复用 propose 产出的包
  - Scenario Ref：独立调用时按同一协议产出包
  - Scenario Ref：上下文包一次性产出
  - Scenario Ref：流程级工作区收尾清理
  - Scenario Ref：独立调用 apply 保留证据不强制清理
  - Scenario Ref：指纹不一致时重建
  - Scenario Ref：阶段结论只追加
  - Scenario Ref：调度指令瘦身与唯一必读制品
  - Scenario Ref：产出登记表跨批共享
  - Scenario Ref：回执最小化
  - Scenario Ref：共享指令前缀字节一致
  - Scenario Ref：禁止重读与禁止重跑已覆盖查询
  - Scenario Ref：空值处置不留空不编造
  - Scenario Ref：包缺口回执与回填
  - Scenario Ref：包机制失效 fail-safe 降级
  - Scenario Ref：单任务批次不新产出包
  - Scenario Ref：auto-mode 不豁免共享资源协议
  - Scenario Ref：派发单元与并发上限
  - Scenario Ref：跨单元同文件拆出并发组
  - Scenario Ref：无子代理能力的运行时降级
  - Scenario Ref：任务勾选与失败重试由协调者集中管理
  - 验证：`pnpm vitest run test/templates.test.ts test/spec-instructions-apply.test.ts test/spec-workflow-contract.test.ts`

## 3. 模板层：父流程编译证据就绪检查（N13–N14）

- [x] 3.1 [代码] `workflow.ts` Phase 5.1 就绪检查加入「编译证据的 `**summary**:` 行 `status ∈ {pass, not-applicable, disabled}`」（证据缺失 / `fail` / 不可解析均阻断）；`not-applicable` / `disabled` 记 WARN 且 MUST NOT 写成「编译检查通过」；呈现项把「编译结果」改为「编译终态 + 证据路径」；Phase 5.2 归档描述删除「需求文档就地增量对齐（4.8）」「需求文档迁移 devdocs」，改为存在性报告；`requirementDocStatus` 描述为报告输入 [N13][N14][M8]
  - 文件：`src/core/templates/workflows/workflow.ts`
  - Spec Ref：workflow-suite-skills / 父流程编译证据就绪检查
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - 验证：3.3 模板断言

- [x] 3.2 [代码] `auto-workflow.ts` Phase 4.2 / 5.1 / 5.2 / 5.3 同步：就绪检查读证据 `**summary**:` 行（`missing` / `fail` / 不可解析阻断；`not-applicable` / `disabled` 放行并 WARN，MUST NOT 写成「编译检查通过」）、删除 4.8 / devdocs 描述、错误处理段把「需求文档生成或对齐失败」改为「需求文档报告缺失」；**不新增** `Bash(tsc:*)` 等编译权限 [N13][N14][M8]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - Spec Ref：workflow-suite-skills / 父流程编译证据就绪检查
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - 验证：3.3 断言正文不含「4.8」「迁移至 devdocs」且含证据路径与汇总行读取

- [x] 3.3 [测试][单元][P0] 模板断言（父流程）：两端均含证据文件路径与 `**summary**:` 行读取、放行/阻断判定、`not-applicable`/`disabled` 的 WARN 措辞（不得写成「通过」）、不可解析等同 missing、均不含已移除的归档写入描述、auto-workflow `allowedTools` 不含 `Bash(tsc:*)`
  - 文件：`test/templates.test.ts`（扩展）
  - Spec Ref：workflow-suite-skills / 父流程编译证据就绪检查
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref：workflow 归档桥读取证据
  - Scenario Ref：auto-workflow 自动归档前置读取证据
  - Scenario Ref：证据不可解析等同缺失
  - Scenario Ref：多命令按汇总行而非末行判定
  - Scenario Ref：编译终态与回执状态词汇不混用
  - Scenario Ref：父流程不执行编译也不扩权限
  - Scenario Ref：编译失败沿用既有暂停语义
  - Scenario Ref：Phase 4 委派而非内联
  - Scenario Ref：Phase 5 委派而非内联
  - Scenario Ref：Phase 5 正文无已移除分支残留
  - Scenario Ref：测试执行门继承
  - Scenario Ref：阶段门声明与协议一致
  - 验证：`pnpm vitest run test/templates.test.ts`

## 4. 模板层：`spec-archive` 归档只读（M1–M12）

- [x] 4.1 [代码] 删除 4.8 全段（就地增量对齐 / 四值分流 / 历史兼容生成 / I/O 重试语义），替换为「4.8 需求文档只读报告」：存在性检查 + 可选读取 `requirementDocStatus`，结果只进摘要；显式声明 MUST NOT 生成 / 对齐 / 迁出 / 委派 `iagent_requirement_doc` [M8]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - 验证：4.7 断言 4.8 写入分支消失且 `iagent_requirement_doc` 不再出现

- [x] 4.2 [代码] 删除 Step 6（把 `需求文档.md` 移入 `openspec/devdocs/`），并核对 6.5 / 7 的交叉引用仍可读 [M8]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - 验证：4.7 断言正文不含 `devdocs`

- [x] 4.3 [代码] 新增「归档只读」护栏（措辞对齐 `debug.ts:546`）：MUST NOT 修改 `openspec/changes/archive/` 既有内容；整目录移动不算改写；`ARCHIVE-INDEX.md` 追加为显式例外；流程末尾保留一步护栏自检 [M12]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - 验证：4.7 断言含「归档只读」与「整目录移动」

- [x] 4.4 [代码] Step 7 索引维护改为显式「纯追加」：结构损坏时保留原文 + 追加最小条目 + WARN 提示人工修复，MUST NOT 重建 [M10]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Spec Ref：spec-bulk-archive-skill / 批量索引单点更新
  - 验证：4.7 断言不含「重建」

- [x] 4.5 [代码] `allowedTools` 移除 `skillDelegation(['requirement_doc'])` 与不再使用的 `skillDelegation` 导入；**同时移除因删除 Step 6 而不再使用的 `Bash(ls:*)`**（原唯一用途是检查归档目录中的 `需求文档.md`）；**新增 `Bash(node:*)`**（4.8 清理步骤的真实调用，MUST NOT 用 `Bash(rm:*)` 替代）；保留 `CODEGRAPH_CLI` / `CODEGRAPH_MCP` [M12]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - Spec Ref：tool-call-whitelist / 归档技能不委派需求文档技能（授权面收敛）
  - 验证：6.4 断言 `allowedTools` 不含 `Skill(iagent-requirement-doc)`、不含 `Bash(ls:*)`，且含 `Bash(node:*)`

- [x] 4.6 [代码] 更新 Output / 摘要模板与 Guardrails：需求文档行改为「已存在（未改写）/ 缺失」，新增「归档只读」护栏条目与「流程级工作区清理结果（已清理 / 保留 / 失败 WARN）」行；删除旧 4.8 状态分流相关 Guardrails [M8][M12]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - 验证：4.7 断言摘要含两种需求文档措辞与清理结果

- [x] 4.7 [测试][单元][P0] 模板断言（archive）：4.8 写入分支与 Step 6 删除、只读报告存在、归档只读护栏存在、索引纯追加无重建；**同时更新 `test/templates.test.ts` 的 7.7 归档步骤序（`4.8 **归档前需求文档检查点` → 只读报告标题）与「需求文档状态四值」断言**（归档正文不再列举四值分流）
  - 文件：`test/templates.test.ts`（扩展，替换原 2.12 需求文档回归段）
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：需求文档存在时只报告不写入
  - Scenario Ref：需求文档缺失时只报告不生成
  - Scenario Ref：需求文档不迁出 devdocs
  - Scenario Ref：需求文档状态读取失败不阻断
  - Scenario Ref：已归档内容只读
  - Scenario Ref：索引纯追加不重建
  - Scenario Ref：归档收尾清理流程级工作区
  - Scenario Ref：探索记忆同步
  - Scenario Ref：delta spec 智能合并
  - Scenario Ref：MODIFIED 目标在主 spec 缺失
  - Scenario Ref：归档不含索引重建
  - Scenario Ref：daemon 活跃时不同步也不解锁
  - Scenario Ref：无 daemon 时按需同步一次
  - Scenario Ref：锁阶梯失败降级 Grep
  - Scenario Ref：CodeGraph 同步失败非阻塞
  - 验证：`pnpm vitest run test/templates.test.ts`

- [x] 4.8 [代码] 在归档收尾新增「清理流程级工作区」：归档成功并追加 `phase=archive` 后清理 `.openspec-tmp/pipeline-<change-name>/`（同时识别旧 `apply-` 前缀）；失败保留并记 WARN，不阻断归档 [M12]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - Spec Ref：compile-check-gate / 编译证据生命周期
  - Spec Ref：spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - 验证：4.7 断言正文含清理语句与「清理失败 WARN 不阻断」；2.11/9.2 回归

- [x] 4.9 [代码] 补遗（`iagent_test` 复核发现声明未实现）：delta 合并时 `MODIFIED` 目标需求标识在主 spec 中缺失 → 按 ADDED 追加该需求 + 摘要告警「MODIFIED 目标缺失（已追加）」+ 继续归档；单变更与批量同义（此前仅声明未落地）
  - 文件：`src/core/templates/workflows/spec-archive.ts`（Step 4 合并流程 + Guardrails）、`src/core/templates/workflows/spec-bulk-archive.ts`（a 步合并流程 + Guardrails）、`test/templates.test.ts`（4.7 / 5.6 断言）
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：MODIFIED 目标在主 spec 缺失
  - 验证：`pnpm vitest run test/templates.test.ts`（4.7 / 5.6 均断言追加 + 告警文本）

- [x] 4.10 [代码] 复核补遗（`iagent_spec_verify` 返回 fail）：对齐「归档写入面删除」后的余波语义 —— `iagent_requirement_doc` 调用方说明不再声明归档调用（两处）、`iagent_debug` 去除「归档就地增量对齐」旧语义并改接 `.iagent/config.yaml` 新契约（自身独立修复策略，不引用 apply 字段）、docs 两处归档生成 / 迁出描述改为只读报告、归档清理措辞去除平台相关删除命令字面量（消除 allowed-tools 扫描噪声）
  - 文件：`src/core/templates/workflows/requirement-doc.ts`、`src/core/templates/workflows/debug.ts`、`src/core/templates/workflows/spec-archive.ts`、`docs/skills-manual.md`、`docs/openspec-comparison.md`、`test/templates.test.ts`（4.7 补 delta 合并断言）
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：需求文档存在时只报告不写入
  - Scenario Ref：需求文档不迁出 devdocs
  - Scenario Ref：delta spec 智能合并
  - 验证：`pnpm test` 全量通过；`test/artifact-dataflow.test.ts` A6 人工域提及面断言仍成立

## 5. 模板层：`spec-bulk-archive` 归档只读（M1–M12）

- [x] 5.1 [代码] a.6 改为「需求文档只读报告」：只判定存在性 + 可读 `requirementDocStatus`，结果进该变更摘要；删除写入 / 对齐 / 生成 / I/O 重试全部分支与「由步骤 c 迁移到 devdocs」表述 [M8]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - 验证：5.6 断言 a.6 不含 `iagent_requirement_doc` 与 `in-place`

- [x] 5.2 [代码] b.5 删除「需求文档迁移」子段，仅保留探索记忆同步 [M8]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - 验证：5.6 断言 b.5 段落不含 `devdocs`

- [x] 5.3 [代码] 10.g 由「完全无法解析则重建」改为「保留原文 + 追加本批最小条目 + WARN 人工修复」；10.b 的标准结构创建保留（仅文件不存在时）[M10]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - Spec Ref：spec-bulk-archive-skill / 批量索引单点更新
  - 验证：5.6 断言 10.g 不含「重建该文件」

- [x] 5.4 [代码] 补「归档只读」护栏（对齐 `debug.ts:546`）与单元序列 c 步「归档只读校验」（越界 WARN 不中止批次）；**单元成功后清理该变更的流程级工作区**（失败/跳过单元保留，失败 WARN 不中止批次）；更新 9 摘要模板（需求文档行、只读校验结果、工作区清理结果）[M12]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Spec Ref：compile-check-gate / 编译证据生命周期
  - 验证：5.6 断言含护栏、c 步校验与清理语句

- [x] 5.5 [代码] `allowedTools` 移除 `skillDelegation(['requirement_doc'])` 与 `skillDelegation` 导入，**新增 `Bash(node:*)`**（单元清理的真实调用，MUST NOT 用 `Bash(rm:*)` 替代），保留 `SUBAGENT_DISPATCH` / `CODEGRAPH_*` [M12]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - Spec Ref：tool-call-whitelist / 归档技能不委派需求文档技能（授权面收敛）
  - 验证：6.4 断言 `allowedTools` 不含 `Skill(iagent-requirement-doc)` 且含 `Bash(node:*)`

- [x] 5.6 [测试][单元][P0] 模板断言（bulk）：a.6 / b.5 无写入分支、10.g 无重建、只读护栏与 c 步校验存在、单元成功后清理工作区且失败单元保留、`SUBAGENT_DISPATCH` 保留
  - 文件：`test/templates.test.ts`（扩展）
  - Spec Ref：spec-bulk-archive-skill / 归档单元执行序列
  - Spec Ref：spec-bulk-archive-skill / 批量索引单点更新
  - Spec Ref：compile-check-gate / 编译证据生命周期
  - Scenario Ref：完整单元序列
  - Scenario Ref：需求文档存在时只报告
  - Scenario Ref：需求文档缺失时不生成
  - Scenario Ref：不再迁出 devdocs
  - Scenario Ref：已归档内容只读
  - Scenario Ref：只读校验发现越界时告警
  - Scenario Ref：单元成功后清理流程级工作区
  - Scenario Ref：失败或跳过单元保留工作区
  - Scenario Ref：状态读取失败不中止批次
  - Scenario Ref：探索记忆同步跳过
  - Scenario Ref：索引追加与注记
  - Scenario Ref：失败变更不入索引
  - Scenario Ref：结构损坏时只追加不重建
  - 验证：`pnpm vitest run test/templates.test.ts`

## 6. 依赖注入与白名单（N13 前置安装面）

- [x] 6.1 [代码] `profiles.ts` 的 `DEPS`：`spec-archive` / `spec-bulk-archive` 收敛为 `['spec-verify']`；`workflow` / `auto-workflow` 显式加入 `'requirement-doc'`（防死引用）[N13]
  - 文件：`src/core/profiles.ts`
  - Spec Ref：skill-profile / 依赖注入
  - 验证：6.3 测试

- [x] 6.2 [代码] 同步 `DEPS` 与 `DEFAULT_WORKFLOWS` 上方注释：默认安装集 8 项无注入；说明 `workflow` / `auto-workflow` 显式声明 `requirement-doc` 的理由 [N13]
  - 文件：`src/core/profiles.ts`
  - Spec Ref：skill-profile / 依赖注入
  - 验证：注释与实际 `DEPS` 一致（人工核对）

- [x] 6.3 [测试][单元][P0] 更新依赖注入与安装集断言：`spec-archive` / `spec-bulk-archive` 不再注入 `requirement-doc`；默认集注入为空；`workflow` / `auto-workflow` / `debug` 仍含 `requirement-doc`
  - 文件：`test/profiles.test.ts`、`test/commands.test.ts`、`test/legacy-migration.test.ts`
  - Spec Ref：skill-profile / 依赖注入
  - Scenario Ref：漏选归档前验证
  - Scenario Ref：归档类不注入需求文档技能
  - Scenario Ref：批量归档仅补归档前验证
  - Scenario Ref：默认集安装 8 项
  - Scenario Ref：漏选提案评分门
  - Scenario Ref：漏选迁移子技能
  - Scenario Ref：仅补缺失项
  - Scenario Ref：debug 注入需求文档技能
  - Scenario Ref：debug 注入结果稳定
  - Scenario Ref：workflow 阶段技能传递注入
  - Scenario Ref：编排器委派探索技能随装
  - Scenario Ref：编排器委派提案技能随装
  - Scenario Ref：apply 不注入需求文档技能
  - 验证：`pnpm vitest run test/profiles.test.ts test/commands.test.ts test/legacy-migration.test.ts`

- [x] 6.4 [测试][单元][P0] 更新白名单断言：两个归档技能不含 `Skill(iagent-requirement-doc)`、正文不含 `iagent_requirement_doc` 委派、`allowedTools` 仍由共享常量产出；**更新「委派技能集合」回归锁（由 9 个降为 7 个：移除 `spec-archive` / `spec-bulk-archive`）**；`spec-archive` 的 `Bash(ls:*)` 随 Step 6 删除一并移除；两个归档技能均含 `Bash(node:*)`（清理调用）且不含 `Bash(rm:*)`；移除原「归档技能具备需求文档委派条目」期望
  - 文件：`test/allowed-tools.test.ts`
  - Spec Ref：tool-call-whitelist / 归档技能不委派需求文档技能（授权面收敛）
  - Scenario Ref：spec-archive 无需求文档委派条目
  - Scenario Ref：spec-bulk-archive 无需求文档委派条目
  - Scenario Ref：测试拦截残留条目
  - 验证：`pnpm vitest run test/allowed-tools.test.ts`

## 7. 模板层：`debug` 缺省语义对齐（N3）

- [x] 7.1 [代码] `debug.ts` Phase 5 仅改一行：编译检查载体改为 `.iagent/config.yaml` 的 `compileCheck`、缺省启用（删除「默认禁用」），并加一句作用域声明（`command` / `timeoutMs` / `maxRetries` / `autoFix` / `incremental` 仅约束 apply；debug 只共享 `enabled` 与缺省语义）；不扩大 debug 职责 [N3]
  - 文件：`src/core/templates/workflows/debug.ts`
  - Spec Ref：compile-check-gate / 旧配置来源弃用（不双源）
  - 验证：`test/templates.test.ts` 断言 debug 正文含 `.iagent/config.yaml`、不含「默认禁用」且含作用域声明

- [x] 7.2 [代码] 补遗（`iagent_spec_verify` 第二轮 fail）：修复 debug 需求文档桥的不可执行分支 —— 已有 `需求文档.md` 时**禁用生成分支**（`iagent_requirement_doc` 对已存在目标静默覆盖，与「MUST NOT 覆盖用户已有文档」冲突），仅提供「跳过 / 手工编辑」；生成分支只在文档不存在时可用；同步人工域护栏与 Output 摘要措辞
  - 文件：`src/core/templates/workflows/debug.ts`、`test/artifact-dataflow.test.ts`（A3 增断言）
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：需求文档存在时只报告不写入
  - 验证：`pnpm vitest run test/artifact-dataflow.test.ts`（文档已存在 → 禁用生成分支断言）

## 8. 横向测试与回归

- [x] 8.1 [测试][单元][P0] 改写 `artifact-dataflow.test.ts`：A2 归档需求文档检查点断言改为「只读报告 + 无委派」；**A4 的 `WITH_REQUIREMENT_DOC` 移除两个归档技能**；A5 DEPS 口径更新（默认集注入为空、归档类仅注入 `spec-verify`）；A6 去掉 4.8 / devdocs 引用并改断只读报告，**同步更新「状态感知检查点正文唯一」与「人工域章节提及面」的期望集合**；**A10 的「归档需求文档状态分流矩阵」整段删除或改写为只读报告断言**（原测试逐条锁定已删除的分流分支）
  - 文件：`test/artifact-dataflow.test.ts`
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Spec Ref：skill-profile / 依赖注入
  - Scenario Ref：需求文档存在时只报告不写入
  - Scenario Ref：需求文档缺失时只报告不生成
  - Scenario Ref：归档类不注入需求文档技能
  - Scenario Ref：Phase 5 委派而非内联
  - 验证：`pnpm vitest run test/artifact-dataflow.test.ts`

- [x] 8.2 [测试][单元][P1] 更新 `config-command.test.ts`：`iagent config show` 输出含 `compileCheck` 默认生效值与用户覆盖值，工作流生效项数改为 8
  - 文件：`test/config-command.test.ts`
  - Spec Ref：skill-profile / iagent config show
  - Spec Ref：compile-check-gate / iagent config show 展示生效编译检查配置
  - Scenario Ref：查看默认集生效
  - Scenario Ref：查看用户配置生效
  - Scenario Ref：查看编译检查配置
  - Scenario Ref：查看用户覆盖的编译检查配置
  - Scenario Ref：展示默认生效值
  - Scenario Ref：展示用户配置值
  - Scenario Ref：非法取值在 config show 中可见
  - 验证：`pnpm vitest run test/config-command.test.ts`

- [x] 8.3 [测试][单元][P1] 核查 `host-orchestration.test.ts`：`requirementDocStatus` 协议断言仍成立（字段保留），archive 侧语义描述更新为「仅报告输入」；**更新「派生结果覆盖既有 9 个委派技能」回归锁为 7 个（移除 `spec-archive` / `spec-bulk-archive`）**，并按新 `host-orchestration` delta 断言「归档类无 `allowed_subagents`、`spec-bulk-archive` 仍保留 `Agent, Task`」
  - 文件：`test/host-orchestration.test.ts`
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Spec Ref：host-orchestration / 编排适配注入面按模板委派派生
  - Scenario Ref：有委派即注入
  - Scenario Ref：无委派不注入
  - Scenario Ref：委派清单携带参数
  - Scenario Ref：可降级委派不被误报为必需缺口
  - Scenario Ref：派生结果覆盖既有委派技能
  - Scenario Ref：归档类无 Skill 委派面
  - 验证：`pnpm vitest run test/host-orchestration.test.ts`

- [x] 8.4 [测试][单元][P1] 核查派生与引用一致性：`test/command-reference-refs.test.ts`、`test/template-derivation.test.ts`、`test/pi-native.test.ts`、`test/opencode-v2.test.ts`、`test/template-language.test.ts` 在模板改动后仍通过（新增 references 不引入英文回退）
  - 文件：上述 5 个测试文件（仅在新失败时修补断言，不改生产代码语义）
  - Spec Ref：compile-check-gate / 编译检查细则的 references 下沉与预算约束
  - Scenario Ref：主文件保留骨架并指向 references
  - 验证：`pnpm vitest run test/command-reference-refs.test.ts test/template-derivation.test.ts test/pi-native.test.ts test/opencode-v2.test.ts test/template-language.test.ts`

- [x] 8.5 [测试][单元][P1] 行数预算与细则缺失降级核查：`iagent-spec-apply`（改前 446）/ `iagent-spec-archive`（423）/ `iagent-spec-bulk-archive`（491）/ `iagent-workflow`（480）主 SKILL 均 ≤500 行（改后逐项复测，bulk 与 workflow 余量仅 9 / 20 行）；主文件含 references 读取指令与内联兜底语句
  - 文件：`test/skill-size-budget.test.ts`（既有断言，必要时补充条目）
  - Spec Ref：compile-check-gate / 编译检查细则的 references 下沉与预算约束
  - Scenario Ref：主文件保留骨架并指向 references
  - Scenario Ref：细则缺失不降级为跳过
  - 验证：`pnpm vitest run test/skill-size-budget.test.ts`

- [x] 8.6 [测试][单元][P2] 判定：以下场景为文案约束或既有派生链已覆盖，不新增专属测试（依据：无可独立验证行为），在此留痕
  - 文件：无新增（判定结论即本任务记录）
  - Spec Ref：tool-call-whitelist / 归档技能不委派需求文档技能（授权面收敛）
  - Scenario Ref：指令侧白名单同步派生
  - Scenario Ref：编排技能不为归档侧内层委派虚增条目
  - 验证：结论引用被覆盖的具体测试（8.4 派生链 / 6.4 白名单断言），MUST NOT 写成「未评估」

- [x] 8.7 [测试][单元][P1] 更新 `test/spec-workflow-contract.test.ts`：删除「auto-workflow 正文含『需求文档对齐 step 4.8』」断言，改为断言 Phase 5 只引用 archive 的存在性报告语义；其余门承载 / 委派断言保持
  - 文件：`test/spec-workflow-contract.test.ts`
  - Spec Ref：workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref：Phase 5 正文无已移除分支残留
  - 验证：`pnpm vitest run test/spec-workflow-contract.test.ts`

## 9. 构建、快照与版本

- [x] 9.1 [代码] 构建并重新生成技能快照：`pnpm build && pnpm generate:skills`（模板与 references 改动后必须执行，否则 `test/skills-parity.test.ts` 失败）；确认 `skills/iagent-spec-apply/references/compile-check.md` 已生成
  - 文件：`skills/**`（生成产物）
  - Spec Ref：compile-check-gate / 编译检查细则的 references 下沉与预算约束
  - Scenario Ref：references 文件随快照生成
  - 验证：`pnpm vitest run test/skills-parity.test.ts`

- [x] 9.2 [代码] 全量测试：`pnpm test` 全绿（含 1.5 / 2.10-2.12 / 3.3 / 4.7-4.8 / 5.6 / 6.3-6.4 / 8.1-8.7 与新增 `test/project-config-compile-check.test.ts`）
  - 文件：无（执行动作）
  - Spec Ref：compile-check-gate / 编译检查硬门与终态模型
  - Spec Ref：compile-check-gate / 编译证据契约
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Spec Ref：skill-profile / 依赖注入
  - 验证：退出码 0

- [x] 9.3 [代码] 版本号递增 `2.1.0 → 3.0.0`（major：四条用户可见不兼容行为 + `iagent config show` 输出变化 + 两个归档技能 `allowed-tools` frontmatter 取值变化；AGENTS.md「BREAKING ⇒ major，歧义取较大」），同步 `README.md` 的 `iagent --version`、`npx mi-agent-tools@x.y.z` 示例与 `npm install --save-dev mi-agent-tools@2.0.0`（改为 3.0.0）
  - 文件：`package.json`、`README.md`
  - Spec Ref：compile-check-gate / compileCheck 配置契约与默认值单一源
  - 验证：`node -e "console.log(require('./package.json').version)"` → `3.0.0`

- [x] 9.4 [代码] `CHANGELOG.md`：把 `[Unreleased]` 归档为 `## [3.0.0] - <日期>`，`### BREAKING` 记四条不兼容行为（配置载体迁移、默认安装集 9→8、归档能力收缩、编译门收紧），`### Added` 记 `compileCheck` 配置与编译证据契约；保留空的 `[Unreleased]` 并同步底部链接定义
  - 文件：`CHANGELOG.md`
  - Spec Ref：compile-check-gate / compileCheck 配置契约与默认值单一源
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Spec Ref：skill-profile / 依赖注入
  - 验证：`## [3.0.0]` 小节存在、含 `### BREAKING`，链接定义指向新 tag

- [x] 9.5 [代码] 提交前自检：`git status` 确认变更面仅含本次制品与实现文件；`.openspec-tmp/`、`.claude/`、`.iagent/` 等本机产物未入库；提案制品按 `openspec/changes/improve-compile-gate-and-archive-readonly/` 前缀精确暂存
  - 文件：无（执行动作）
  - Spec Ref：spec-workflow-skills / spec-apply 实现技能
  - 验证：`git status --porcelain` 无本机产物路径
