# Tasks: improve-init-project-scan

> 任务按流程基准节点标注 `[N<x>]`（见变更 `exploration.md` 的 `## 功能流程图`，16 节点）。
> N1 / N2 为既有节点，本次不改行为，仅以回归验证任务覆盖。

## 1. 确定性预扫描模块（`src/core/project-scan.ts` 新建）

- [x] 1.1 [代码] [N3] 建立 `project-scan.ts` 骨架：`ProjectScanReport` 类型（`signals` / `candidates` / `failures` / `scope` / `limits` / `version` / `scannedAt`）+ `scanProject()` 主流程 + 限额参数入口（可注入以便测试）；导入按「系统包 → 第三方包 → 自定义包」分组且相对导入**带 `.js` 后缀**（仓库 TS ESM 约定）
  - 文件：`src/core/project-scan.ts`
  - 验证：`pnpm build` 通过；类型定义中 `config` 条目**只有 `keys` 无 value 字段**（类型层面杜绝取值外泄）；`pnpm lint` 通过

- [x] 1.2 [代码] [N3] 构建设施与目录骨架探测：识别 `build.xml` / `pom.xml` / `build.gradle` / `package.json`（含 Ant target 名解析）；识别 `src/main/java` 与 `src/` 直挂两种骨架形态；排除构建产物目录与依赖目录内的元数据文件
  - 文件：`src/core/project-scan.ts`
  - 验证：对**无 `pom.xml` 的 Ant 项目**输出构建设施为 Ant（不得报告缺失或失败）；三方依赖内的 `package.json` 不被记为项目构建设施

- [x] 1.3 [代码] [N3] 配置文件键名提取：解析 properties / XML 形态的连接与认证配置，**只提取键名与文件路径**，取值在提取函数内丢弃；同配置的多环境变体（`.bak` / 环境后缀 / `_mysql` 等派生文件）合并为一项
  - 文件：`src/core/project-scan.ts`
  - 验证：对含 `PASSWORD` / `KEY` / `SECRET` 键的配置，报告内**不含任何键的取值**；变体文件合并为一项而非逐项列出

- [x] 1.4 [代码] [N3] 路由声明位置与文档存在性探测：识别路由声明文件（servlet 映射文件、路由映射 XML、代码内分发器入口）；探测既有文档（`AGENTS.md` / `CLAUDE.md` / `README.md` / `docs/` / `.venus/config.yaml` / `openspec/config.yaml`）并提取**已结构化的技术栈声明**
  - 文件：`src/core/project-scan.ts`
  - 验证：既有结构化技术栈声明被记为高可靠信号；文档存在性结果进入 `signals.docs`

- [x] 1.5 [代码] [N3] 依赖候选探测 + 文件排除清单 + 遍历上限：jar/依赖名记为 `candidates`（附"候选，未验证源码使用"note）；内置排除清单（PII 非源码文件、编译产物目录、日志与崩溃转储、超大非源码文件、**venus 自身产物目录 `.claude/` `.venus/` `.codegraph/` `openspec/`**、`node_modules/`、`dist/`）；深度与文件数上限**定义为具名常量**（`MAX_SCAN_DEPTH` / `MAX_SCAN_FILES`，MUST NOT 内联字面量），超限写入 `limits.hit` 与说明；所有失败分支 MUST NOT 空 catch 吞异常，原因须落入 `failures` 或 WARN 文本
  - 文件：`src/core/project-scan.ts`
  - 验证：框架 jar **只出现在 `candidates` 且不出现在 `signals`**；超限时 `limits.hit=true` 且 `failures`/报告说明区分为"上限所致"；源码无内联上限字面量、无空 catch 块

- [x] 1.6 [代码] [N4] 基线写出：`.venus/scan-baseline.json` 整体覆盖写入，含 `version` / `scannedAt` / `scope` / `limits` / `failures`；写入失败仅返回 WARN 不抛出
  - 文件：`src/core/project-scan.ts`
  - 验证：重复调用整体覆盖（无陈旧事实残留）；`.venus/` 不可写时返回 WARN 结果且不抛异常

- [x] 1.7 [代码] [N5] `renderScanReport()`：渲染非阻断终端报告（探测到的信号摘要、候选、失败与超限说明、下一步提示）
  - 文件：`src/core/project-scan.ts`
  - 验证：报告不包含任何配置取值；失败/超限项在报告中被显式说明

- [x] 1.8 [代码] [N6] `venus init` 接入：`runInit()` 新增预扫描步骤（返回报告字段），`InitOptions` / `InitResult` 增字段；`cli/index.ts` init action 新增 `--no-scan` option 并渲染报告；`--no-scan` 置位跳过全部扫描步骤
  - 文件：`src/commands/init.ts`、`src/cli/index.ts`
  - 验证：`venus init` 输出含扫描报告；`venus init --no-scan` 不写基线、无扫描输出，其余步骤行为不变；既有 option（`--tools` / `--force` / `--no-deps` / `--onboarding`）行为不变

## 2. 预扫描测试

- [x] 2.1 [测试][单元][P0] Ant 项目（无 `pom.xml`）构建设施识别为 Ant；三方依赖内的 `package.json` 不被误记
  - 文件：`test/project-scan.test.ts`
  - 验证：`pnpm test` 该用例通过

- [x] 2.2 [测试][单元][P0] 敏感值防护：含 `PASSWORD` / `KEY` / `SECRET` 键的配置文件，报告与基线 JSON 中**不含任何取值**（断言序列化结果不含测试凭据串）
  - 文件：`test/project-scan.test.ts`
  - 验证：`pnpm test` 通过；被测样例含可被 grep 的哨兵凭据串，断言基线全文不含该串

- [x] 2.3 [测试][单元][P1] 排除清单：含 PII 的非源码文件、编译产物目录、日志文件、`node_modules/`、`dist/` 不被读取、不进入信号；**venus 自身产物目录不被误报**（夹具预置 `.claude/skills/<27 个技能目录>` + `.venus/`，断言其不进入 `signals` 且不触达上限）
  - 文件：`test/project-scan.test.ts`
  - 验证：`pnpm test` 通过

- [x] 2.4 [测试][单元][P1] 多环境配置变体合并为一项；候选与信号分层（框架 jar 只在 `candidates`）
  - 文件：`test/project-scan.test.ts`
  - 验证：`pnpm test` 通过

- [x] 2.5 [测试][单元][P1] 失败降级：目录不可读 / 写基线失败 / 触及上限三种情形均返回结果 + WARN，不抛异常；超限与"无内容"在报告中可区分
  - 文件：`test/project-scan.test.ts`
  - 验证：`pnpm test` 通过

- [x] 2.6 [测试][功能][P0] `venus init` 端到端（临时目录）：零文档项目首次 init → 产出 `.venus/scan-baseline.json` + 扫描报告；`--no-scan` 下不产出基线
  - 文件：`test/project-scan.test.ts`
  - 验证：`pnpm test` 通过

- [x] 2.7 [测试][单元][P2] 已评估判定无需测试：`renderScanReport()` 的纯排版分支无独立逻辑，由 2.6 的端到端输出断言覆盖，不另设用例（依据：无分支的业务无关排版）
  - 文件：`test/project-scan.test.ts`（记录于文件顶部注释）
  - 验证：结论与依据写入测试文件注释，`pnpm test` 通过

- [x] 2.8 [测试][单元][P1] 非 Maven / Ant 族项目（Node / TypeScript）：`package.json` + 包管理器锁文件被识别为构建设施与包管理器；不得假设任一技术栈为默认
  - 文件：`test/project-scan.test.ts`
  - 验证：`pnpm test` 通过；四种构建标志文件平权受理

## 3. `config.yaml` 的 `context` 回写

- [x] 3.1 [代码] [N16] 抽出逐行保留 + 段替换的公共实现，由 `writeWorkflowsToConfig()` 与新增 `writeContextToConfig()` 共用；`.venus/` 不存在时先建目录与默认配置
  - 文件：`src/core/project-config.ts`
  - 验证：`writeWorkflowsToConfig()` 的**外部行为与产物逐字不变**（既有测试全绿）；`writeContextToConfig()` 只替换 `context` 段

- [x] 3.2 [测试][单元][P0] 回写保留未知段与注释：构造含 `auto_package.runtime_dir` 未知段与注释行的 config，回写 `context` 后未知段、注释、空行逐字保留（断言不含 YAML 重序列化痕迹）
  - 文件：`test/project-config-context.test.ts`
  - 验证：`pnpm test` 通过

- [x] 3.3 [测试][单元][P1] `context` 段替换正确性：原占位内容被替换为新内容；`.venus/config.yaml` 缺失时先创建再写入
  - 文件：`test/project-config-context.test.ts`
  - 验证：`pnpm test` 通过

## 4. `venus_tr_init_project` 技能正文扩写（`tr-init.ts`）

- [x] 4.1 [代码] [N7] 正文新增「读取扫描基线」步骤：存在则复用；缺失/损坏则记 WARN 并自行机械探测（Glob/Grep/Read），不终止
  - 文件：`src/core/templates/workflows/tr-init.ts`
  - 验证：正文明确写出降级路径与 WARN 要求；不因基线缺失而终止

- [x] 4.2 [代码] [N8] 正文新增「技术框架语义扫描」：语言/框架/版本/构建工具/包管理器；版本判定走四级回退链（构建文件 → 工具链配置 → 构建脚本参数 → 文档文本 → 标「未知」）；优先采信既有结构化技术栈声明
  - 文件：`src/core/templates/workflows/tr-init.ts`
  - 验证：正文含回退链与「MUST NOT 编造」约束；含"优先采信 `.venus/config.yaml` / `openspec/config.yaml` 声明"

- [x] 4.3 [代码] [N9] 正文新增「委派 `venus_tr_docs_feature_doc`」：以 `Skill` 工具委派获取「模块与功能点 / 数据库 / API 规范」的信息基础；不可得时降级自行扫描并记 WARN；并写明**目标项目无 CodeGraph 索引时**改用 Glob / Grep / Read 完成扫描（沿用既有降级规约）
  - 文件：`src/core/templates/workflows/tr-init.ts`
  - 验证：正文写明委派目标、两条降级路径（委派不可得 / CodeGraph 不可用）；**MUST NOT** 出现"必须依赖该技能"或"必须有索引"的阻断表述

- [x] 4.4 [代码] [N10] 正文新增「安全规范扫描」：描述认证/鉴权机制、校验策略、配置约定；显式禁令——MUST NOT 含凭据值、MUST NOT 含可利用的绕过细节
  - 文件：`src/core/templates/workflows/tr-init.ts`
  - 验证：正文含两条显式禁令

- [x] 4.5 [代码] [N11] 正文新增「已存在文档逐份确认」：写入前检测目标文档存在性，逐一呈现并取得选择（确认重新生成 / 修改 / 跳过）；跳过时逐字保持；全部跳过时正常结束
  - 文件：`src/core/templates/workflows/tr-init.ts`
  - 验证：正文表述为逐份确认（非一次性总确认）；含"全部跳过仍正常结束"

- [x] 4.6 [代码] [N12] 正文新增「增量对齐与人工域标记」：`<!-- 人工域:开始 -->` / `<!-- 人工域:结束 -->` 界定；标记内逐字保留、标记外重派生；无标记时退化为整体重派生且不报错；**破损情形取保留侧**——未闭合时由开始标记保留至文末并记 WARN（MUST NOT 猜测闭合位置）、嵌套/乱序时保留最外层最大连续区间并记 WARN
  - 文件：`src/core/templates/workflows/tr-init.ts`
  - 验证：正文含标记字面量、退化规则与三条破损分支（未闭合 / 嵌套 / 乱序），且破损分支均取保留侧

- [x] 4.7 [代码] [N13][N14] 正文新增「五类文档 + 索引落盘」：按 `docs/project/<类型>/` 中文文件名落盘；某类无内容时不生成该类文档；索引列出全部五类并标「不适用 + 探测依据」
  - 文件：`src/core/templates/workflows/tr-init.ts`
  - 验证：正文含五类路径映射表与"不适用 + 探测依据"要求；含"MUST NOT 生成空壳文档"

- [x] 4.8 [代码] [N15] 正文新增「`AGENTS.md` 生成/对齐」：依扫描结果生成仓库导航（项目是什么 / 仓库地图 / 常用命令 / 修改守则）；已存在时走 4.5/4.6 同一分支
  - 文件：`src/core/templates/workflows/tr-init.ts`
  - 验证：正文引用 4.5/4.6 的分支而非独立策略

- [x] 4.9 [代码] [N16] 正文新增「`context` 回写」步骤：将技术栈与项目约定写入 `.venus/config.yaml` 的 `context` 段；失败记 WARN 继续
  - 文件：`src/core/templates/workflows/tr-init.ts`
  - 验证：正文含回写目标与失败容错

- [x] 4.10 [代码] 五类文档骨架模板与框架档案细节拆入 `references/`，主正文以文字引用（按需 `Read`）
  - 文件：`src/core/templates/workflows/tr-init.ts`（`references` 字段 + 正文引用）
  - 验证：`pnpm generate:skills` 后技能目录下生成 `references/*.md`；主 SKILL.md 正文不含五类模板全文

- [x] 4.11 [代码] 按正文实际使用扩展 `allowedTools`：新增 `CODEGRAPH_MCP` 与 `skillDelegation(['tr_docs_feature_doc'])`；不加 `SUBAGENT_DISPATCH`
  - 文件：`src/core/templates/workflows/tr-init.ts`
  - 验证：白名单含 `Skill(tr_docs_feature_doc)` 精确条目、不含 `Skill(*)`；**正文须真实出现 codegraph 工具名**（如 `codegraph_status` / `codegraph_files`）且提及 `venus_tr_docs_feature_doc`——`test/allowed-tools.test.ts` 有反向断言「含 MCP 条目的技能集合 ≡ 正文提及 codegraph 的集合」与「委派目标必须在正文被提及」，只加白名单不改正文会被判为"未经正文核准的授权"

- [x] 4.12 [测试][功能][P0] 技能正文结构断言：SKILL.md 快照含 4.1–4.9 各步骤的关键约束语句（基线降级、版本回退链+不编造、委派降级 + CodeGraph 不可用降级、安全禁令、逐份确认、人工域标记、五类路径表、不适用+依据、AGENTS.md 引用统一分支、context 回写容错）
  - 文件：`test/tr-init-scan.test.ts`
  - 验证：`pnpm test` 通过

## 5. `tr-init.ts` 派生改造

- [x] 5.1 [代码] `getTrInitProjectCommandTemplate().content` 改为由 `deriveCommandContent(getTrInitProjectSkillTemplate().instructions)` 生成；按 fail-safe 原则**默认不标记**，仅在确实不宜进入 command 版的段落加 `<!-- CMD:SKIP -->` / `<!-- /CMD:SKIP -->`
  - 文件：`src/core/templates/workflows/tr-init.ts`
  - 验证：源码中不存在第二份手工维护的 command 正文字符串（`grep` 确认 `content:` 处为派生调用）

- [x] 5.2 [测试][单元][P0] 派生一致性覆盖 `tr-init.ts`：派生产物与 skill 唯一源一致；未标记段落双向可见；标记段落仅 skill 版可见
  - 文件：`test/template-derivation.test.ts`
  - 验证：`pnpm test` 通过

- [x] 5.3 [测试][单元][P2] 已评估判定无需测试：其余 17 个 `tr-*.ts` 模板**不在本规则作用域内**，不为其新增派生断言（依据：Non-Goals 明确排除，且为未改动文件）
  - 文件：`test/template-derivation.test.ts`（记录于该文件注释）
  - 验证：结论与依据写入注释，`pnpm test` 通过

## 6. 产物重生成与回归

- [x] 6.1 [代码] 重生成技能快照与构建产物
  - 文件：`skills/venus_tr_init_project/SKILL.md`（及 `references/`）、`dist/`
  - 验证：`pnpm build && pnpm generate:skills` 成功

- [x] 6.2 [测试][功能][P0] 全量回归：既有快照一致性、白名单、模板派生、profile/默认集断言全绿（重点：默认安装集仍为 9 项），**含 6.4/6.5 两处回归锁同步**
  - 文件：`test/`（既有套件）
  - 验证：`pnpm test` 全绿；`pnpm lint` 通过

- [x] 6.4 [测试][单元][P0] 同步回归锁 A：`test/allowed-tools.test.ts` 的「正文用 CodeGraph 或白名单含 `Bash(codegraph:*)` 的技能数」硬编码计数（当前 `expect(derived.length).toBe(10)`）——本次 `tr-init` 纳入后须更新为 11
  - 文件：`test/allowed-tools.test.ts`
  - 验证：更新后 `pnpm test` 通过；断言仍具拦截力（不得删除断言或改为 `toBeGreaterThan`）

- [x] 6.5 [测试][单元][P0] 同步回归锁 B：同文件「经 `Skill` 委派的技能清单」逐项列举断言（当前 9 项）——须把 `tr-init-project` 纳入并保持字典序
  - 文件：`test/allowed-tools.test.ts`
  - 验证：更新后 `pnpm test` 通过；清单仍为**精确列举**（不得改为模糊匹配）

- [x] 6.3 [测试][功能][P1] 既有节点回归：`venus init`（N1）既有的技能/指令生成、权限合并、`.venus/` 配置创建、reconcile 提示行为不变；`ensureDependencies()`（N2）的非阻断报告行为不变
  - 文件：`test/`（既有 init 相关套件）
  - 验证：`pnpm test` 全绿；`venus init` 输出中既有段落逐字未变

## 7. 能力规格与文档同步

- [x] 7.1 [使用说明] 更新 `openspec/CONTEXT.md` 术语表：新增 6 条术语（项目扫描 / 确定性预扫描 / 扫描基线 / 信号与候选 / 人工域标记 / 不适用类）；更新「人工域」词条的界定方式（由按章节改为显式标记）
  - 产出: `openspec/CONTEXT.md`
  - 验证：新术语含 _Avoid_ 反例行；「人工域」词条已反映显式标记机制

- [x] 7.2 [代码] 版本号与变更日志：`package.json` minor 递增；`CHANGELOG.md` 将 `[Unreleased]` 归档为 `## [<新版本>] - YYYY-MM-DD`（`### Added` / `### Changed`），保留空 `[Unreleased]`，同步底部链接引用定义（`[Unreleased]` 比较基线改为新版本 tag，新增 `[<新版本>]` 的 compare/tag 链接）；同步更新其它出现版本号的位置（当前为 `README.md` 安装验证中的 `venus --version` 输出示例）
  - 文件：`package.json`、`CHANGELOG.md`、`README.md`
  - 验证：版本号与 CHANGELOG 一致；链接定义 `[Unreleased]` 基线改为新版本 tag；随本次功能提交一并提交
