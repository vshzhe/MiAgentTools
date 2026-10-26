# tasks：upgrade-workflow-efficiency

> 流程基准：`openspec/explorations/iagent-workflow-efficiency-upgrade-explore-001.md` 的 `## 功能流程图`（已确认 N1–N11，含 N2F / N4F / N5A / N5B / N7F 分支）。任务锚点 `[N<id>]` 对应节点 id，节点覆盖度计入验证。
> 任务类型标签：`[代码]` / `[测试]` / `[DB脚本]` / `[使用说明]`；`[测试]` 任务带 `[单元]`/`[功能]` 与 `[P0]`/`[P1]`/`[P2]` 子标注。
> 批次：⑥ 分**批次一**（`debug` 派发）与**批次二**（handoff 包）；② 与 ④ 落在同一归档段落，**必须同批完成**。

## Caller Updates

调用点计数为编排器影响面实测口径（调用表达式 / 类型引用点），逐项处置如下：

| 簇 | 调用方 / 符号 | 位置 | 处置 |
| :--- | :--- | :--- | :--- |
| ② | `initDatabase`（**7 调用**） | `src/commands/init.ts:329`、`src/commands/spec.ts:315`、`src/core/spec/sqlite-index.ts:402`（`recreateDatabase` 内部）、`test/sqlite-index.test.ts:61/75/81/95`、`test/markdown-index.test.ts:26` | 被调函数模块删除 → 调用点**全部删除**；两个测试文件整文件删除 |
| ② | `CapabilityIndexEntry`（**8**）/ `ChangeIndexEntry`（**5**）/ `RequirementIndexEntry` | `src/commands/spec.ts:421/733-800`、`src/core/spec/markdown-index.ts`、`sqlite-index.ts:87-110`、`sqlite-memory-backend.ts:9-54` | 类型定义随模块删除；`spec.ts` 的 `insert*` 调用链一并删除 |
| ② | `indexChangeJsonEntry`（**1 调用**） | `src/commands/spec.ts:394`（定义 `:733`） | 函数与调用同批删除（仅 reindex 使用） |
| ② | `reindex` 命令 | `src/commands/spec.ts:272` 起命令体 | 命令、辅助函数、import 全部删除；`completion.ts` 子命令表同步 |
| ② | `InitResult.indexDbStatus` | `src/commands/init.ts:39`（import）、`:317-333`、`:349` | 字段与渲染行删除；`cli/index.ts` 输出同步 |
| ② | `MemoryBackend`（**1 调用方**） | `test/spec-commands.test.ts:11`（`iagent spec reindex（内存后端…）` describe 段） | 模块随 `sqlite-memory-backend.ts` 删除 → 该 describe 段（6 用例）与 import 一并删除（任务 2.14） |
| ② | `LEGACY_INDEX_DB_FILE` / `reindex` 提示 | `src/core/legacy-migration.ts:93`、`:793` | 旧品牌缓存清理语义保留（对象为 `openspec/changes/archive/.venus/`）；提示文案改中性、零 `reindex` 残留（任务 2.13） |
| ① | `scanProject`（**4 调用**） | `src/commands/init.ts` | 签名保留，`options` 去掉 `maxDepth`/`maxFiles`、新增 `softTimeoutMs`/`respectIgnoreFiles`/`now`；调用点透传配置 |
| ① | `renderScanReport`（**3 调用**） | `src/cli/index.ts` | 改 v2 渲染（`skipped` 分类行 + 软超时提示） |
| ① | `writeScanBaseline`（**2**）/ `walkDir`（**1**） | `src/core/project-scan.ts`（内部） | 写 v2；`walkDir` 去上限并接入忽略 + 软超时 |
| ① | `SCAN_BASELINE_FILE`（**3 调用，含 `src/core/legacy-migration.ts`**） | `project-scan.ts:27`、`legacy-migration.ts` | **不改文件名与路径**（只改内容 schema）→ 迁移逻辑不变；补「搬移后仍可解析」断言测试 |
| ⑤ | `WORKFLOW_PROTOCOLS` / `GateSpec`（**2 调用**） | `src/core/host-orchestration/index.ts` | 只增 `GATE_WHITELIST` 映射与断言；`PhaseSpec` 结构不变 |
| ⑤ | `evaluatePhaseTransition`（**3**）/ `renderHostOrchestrationSection`（**3**）/ `renderDelegate`（**4**） | `src/core/host-orchestration/*` | 判定语义不变；渲染新增白名单段与直通句 |
| ⑤ | 测试面 | `test/allowed-tools.test.ts`、`test/claude-host-adapter.test.ts`、`test/host-orchestration.test.ts` | 断言同步（任务 4.6–4.8） |
| ④ | `CODEGRAPH_MCP`（**11 调用**）/ `skillDelegation`（**17**）/ `SUBAGENT_DISPATCH`（**7**） | `src/core/templates/tool-whitelist.ts` 与 12 个模板 | 新增 `CODEGRAPH_CLI`；既有条目不删；`test/tool-whitelist-constants.test.ts` 补断言 |
| ④ | `CODEGRAPH_PACKAGE` | `src/core/dependencies.ts` | **不变**（仅安装提示口径） |
| ⑥ | `BATCH_SCHEDULING_FULL`（**1 定义 + 1 引用**） | `src/core/templates/workflows/spec-apply.ts:8`（定义）、`:533`（作为 `references/batch-scheduling.md` 输出，**唯一使用者**）。**原表误指 `test/template-derivation.test.ts` —— 该文件对此常量零断言** | 常量文本改写；相关断言在 `test/subagent-resource-sharing.test.ts`（A1 硬断言 `context-pack.md` / `apply-<change-name>`）与 `test/markdown-first-regression.test.ts:52-59`（硬断言 `context-pack.md`）→ 二者**必须同步改写**（任务 6.10 / 6.12） |
| ② | 残留字样（7.5 回归锁硬前置） | `src/cli/index.ts:14`（注释含 `reindex`）、`src/core/child-process.ts:30`（注释含 `sqlite3`） | 同批清理（任务 2.3 / 2.17），否则 7.5 的 `src/**` 零命中断言必然失败 |
| ⑤⑥ | 规则常量真源 | `src/core/project-config.ts:202`（`impl` 域「设计先行」）、`:216`（`spec` 域 `context-pack` 行） | 改**常量**而非 `.iagent/rules/*.md`（后者是 init/update 用常量重组的产物且已被 gitignore）→ 任务 4.5 / 6.8 |

## 1. 扫描基线 v2（DEC-1）

- [x] 1.1 [代码] 新增忽略规则解析模块 `src/core/scan-ignore.ts`：`createIgnoreMatcher(projectRoot, { respectIgnoreFiles })` 返回 `{ ignores(relPath, isDir), warnings }`；支持 `#` 注释、`!` 否定、尾部 `/` 仅目录、`*`/`**`、无斜杠按 basename 匹配任意层级；嵌套 `.gitignore` 作用域限所在子树；解析失败 **fail-open**（不过滤 + WARN）`[N2]`
  - 文件：`src/core/scan-ignore.ts`
  - Spec Ref: init-project-scan / 忽略清单与忽略规则解析
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / `.gitignore` 与否定规则生效
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / 嵌套 `.gitignore` 作用域受限
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / 忽略规则解析失败 fail-open
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / 关闭忽略规则解析
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / 无 VCS 项目仍可遍历
  - 验证：纯函数级测试（任务 1.9）覆盖四类规则与 fail-open；Windows 路径用 posix 归一后比对

- [x] 1.2 [代码] `project-scan.ts` 遍历去上限并接入忽略 + 软超时：删除 `MAX_SCAN_DEPTH` / `MAX_SCAN_FILES` 常量与 `walkDir` 的深度、文件数截断分支；`ScanSink` 删除 `limits.maxDepth/maxFiles` 与 `depthLimited/filesLimited`，新增 `skippedCounter` / `softTimeout` 状态；遍历入口先判内置固定清单再判 ignore matcher；超预算即停止（不记失败）`[N2][N2F]`
  - 文件：`src/core/project-scan.ts`
  - Spec Ref: init-project-scan / 确定性预扫描
  - Scenario Ref: init-project-scan / 确定性预扫描 / 深度目录不再被漏采
  - Scenario Ref: init-project-scan / 软超时与跳过量统计 / 不设深度与文件数上限
  - Scenario Ref: init-project-scan / 软超时与跳过量统计 / 软超时停止遍历但不失败
  - Scenario Ref: init-project-scan / 软超时与跳过量统计 / 不可读条目计入 skipped 与 failures
  - 验证：构造深度 ≥12 的配置目录与 >2000 文件夹具，全部被采集；极小 `softTimeoutMs` 触发受控停止

- [x] 1.3 [代码] `limits` v2 契约与文案：新增 `SCAN_BASELINE_VERSION = 2`、`DEFAULT_SCAN_SOFT_TIMEOUT_MS = 30000`、`ScanLimitsV2` 类型；`limitDetail` 改为按 `reasons` 生成「忽略 / 软超时 / 不可读」人读文案；`hit` 语义改为「发生任一跳过」；`createEmptyScanReport()` 产出 v2 空值（`detail` 中性文案、`reasons: []`、`skipped` 全 0）`[N2F][N3]`
  - 文件：`src/core/project-scan.ts`
  - Spec Ref: init-project-scan / 软超时与跳过量统计
  - Scenario Ref: init-project-scan / 软超时与跳过量统计 / 无跳过时 hit 为 false
  - Spec Ref: init-project-scan / 扫描基线落盘
  - Scenario Ref: init-project-scan / 扫描基线落盘 / 基线写入成功
  - 验证：`createEmptyScanReport()` 断言 `version===2` 且 `limits.skipped` 三项为 0；`hit=false` 时 `detail` 不含「上限」

- [x] 1.4 [代码] `scanProject` / `writeScanBaseline` / `renderScanReport` 跟随 v2：`ScanOptions` 去掉 `maxDepth`/`maxFiles`、新增 `softTimeoutMs` / `respectIgnoreFiles` / `now`；基线写入恒为 `version: 2`；终端报告新增「跳过」段（按 `ignored` / `timeout` / `unreadable` 分类计数）与软超时提示行 `[N3][N2F]`
  - 文件：`src/core/project-scan.ts`
  - 文件：`src/cli/index.ts`
  - 文件：`src/commands/init.ts`
  - Spec Ref: init-project-scan / 扫描基线落盘
  - Scenario Ref: init-project-scan / 扫描基线落盘 / 基线写入成功
  - Scenario Ref: init-project-scan / 扫描基线落盘 / 历史 v1 基线仍可读取
  - Scenario Ref: init-project-scan / 确定性预扫描 / 每次 init 覆盖刷新基线
  - Scenario Ref: init-project-scan / 确定性预扫描 / `--no-scan` 跳过预扫描
  - 验证：报告文本含 `skipped` 三类计数；写出的 JSON 不含 `maxDepth`/`maxFiles`

- [x] 1.13 [代码] 扫描的**注入与逃生路径**：`iagent init` 新增 `--no-scan-ignore`（等价 `respectIgnoreFiles=false`，与 `--no-scan` / `--no-deps` 同构，须同步 `completion.ts` 的选项补全与 `--help`）与环境变量 `IAGENT_SCAN_SOFT_TIMEOUT_MS`（正整数毫秒；非法值忽略并 WARN）；`config.yaml` MUST NOT 新增 `scan` 段（`parseProjectConfig` 契约不变）`[N2][N2F]`
  - 文件：`src/commands/init.ts`
  - 文件：`src/cli/index.ts`
  - 文件：`src/commands/completion.ts`
  - Spec Ref: init-project-scan / 软超时与跳过量统计
  - Scenario Ref: init-project-scan / 软超时与跳过量统计 / 软超时停止遍历但不失败
  - Spec Ref: init-project-scan / 忽略清单与忽略规则解析
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / 关闭忽略规则解析
  - 验证：`IAGENT_SCAN_SOFT_TIMEOUT_MS=1 node bin/iagent.js init` 触发受控停止且退出码 0（终端与基线双写提示）；`--no-scan-ignore` 下 `.gitignore` 不参与过滤；`--help` 列出新选项

- [x] 1.5 [代码] 骨架与文档探测与新遍历语义对齐：`containsJavaWithin` / `probeSkeleton` 的 `SKELETON_PROBE_DEPTH`（`:36`，当前 4）**改为与主遍历一致的「无深度上限 + 软超时」受控探测**（复用同一 ignore matcher 与超时预算；命中即停，MUST NOT 引入第二套上限常量）；`probeDocs` 同步；骨架结论仍只记事实 `[N2]`
  - 文件：`src/core/project-scan.ts`
  - Spec Ref: init-project-scan / 信号与候选分层
  - Scenario Ref: init-project-scan / 信号与候选分层 / 观察到的事实记为信号
  - Scenario Ref: init-project-scan / 信号与候选分层 / jar 存在但未被源码使用
  - 验证：深目录（≥12 层）Java 源码项目仍识别为「src/main/java 标准根」，且不产生框架结论；`grep -n "SKELETON_PROBE_DEPTH" src` 零命中

- [x] 1.6 [代码] 固定忽略清单扩充：`EXCLUDED_DIR_NAMES` 补 `.next` / `.venv` / `__pycache__` 等（保留 `.git`/`node_modules`/`dist`/`build`/`coverage` 与 iagent 自身产物目录）；命中计入 `skipped.ignored` `[N2][N2F]`
  - 文件：`src/core/project-scan.ts`
  - Spec Ref: init-project-scan / 忽略清单与忽略规则解析
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / 固定忽略清单目录不进入遍历
  - Spec Ref: init-project-scan / 敏感值防护
  - Scenario Ref: init-project-scan / 敏感值防护 / iagent 自身产物不被误报为项目信号
  - Scenario Ref: init-project-scan / 敏感值防护 / 排除清单内的文件
  - 验证：夹具含上述目录时 `skipped.ignored` 递增且 `signals` 不含其内容

- [x] 1.7 [代码] `project-init` 技能基线消费段新增硬要求：读取 `limits.skipped`（三类计数）与 `failures`，`skipped` 任一非 0 时 MUST 在报告中呈现并说明「跳过所致 ≠ 项目无该内容」；`failures` 逐条呈现；基线缺失/不可解析时降级 Glob/Grep 并在报告标注 `[N4][N4F]`
  - 文件：`src/core/templates/workflows/project-init.ts`
  - Spec Ref: init-project-scan / 扫描基线落盘
  - Scenario Ref: init-project-scan / 扫描基线落盘 / 基线缺失时技能降级
  - Scenario Ref: init-project-scan / 扫描基线落盘 / 消费侧呈现跳过与失败
  - Spec Ref: init-project-scan / 软超时与跳过量统计
  - Scenario Ref: init-project-scan / 软超时与跳过量统计 / 不可读条目计入 skipped 与 failures
  - 验证：`pnpm build && pnpm generate:skills` 后 SKILL.md 含「必须呈现 skipped / failures」表述；`skill-size-budget` 通过

- [x] 1.8 [代码] 旧装机迁移兼容核对：确认 `legacy-migration.ts` 的扫描基线搬移只依赖 `SCAN_BASELINE_FILE` 常量，不改其逻辑；若搬移后需要版本归一（v1 → 保持 v1 只读），在读取侧承载而不在迁移期重写用户文件 `[N1]`
  - 文件：`src/core/legacy-migration.ts`
  - 文件：`test/legacy-migration.test.ts`
  - Spec Ref: init-project-scan / 扫描基线落盘
  - Scenario Ref: init-project-scan / 扫描基线落盘 / 旧装机搬移的基线仍可解析
  - 验证：迁移夹具搬移后基线内容逐字保留，v2 读取方按 v1 分支解析成功

- [x] 1.9 [测试][单元][P0] 改写 `test/project-scan.test.ts`：删除「触上限截断」类用例；新增「深度 ≥12 漏采消失」「>2000 文件不截断」「忽略命中计入 `skipped.ignored`」「软超时 `exceeded=true` + `skipped.timeout>0` + 退出码 0」「不可读进 `failures` + `skipped.unreadable`」「`limits.hit=false` 时 `reasons` 为空」`[N2][N2F]`
  - 文件：`test/project-scan.test.ts`
  - Spec Ref: init-project-scan / 软超时与跳过量统计
  - Scenario Ref: init-project-scan / 软超时与跳过量统计 / 软超时停止遍历但不失败
  - Scenario Ref: init-project-scan / 软超时与跳过量统计 / 不可读条目计入 skipped 与 failures
  - Scenario Ref: init-project-scan / 软超时与跳过量统计 / 不设深度与文件数上限
  - Spec Ref: init-project-scan / 确定性预扫描
  - Scenario Ref: init-project-scan / 确定性预扫描 / 深度目录不再被漏采
  - 验证：`pnpm test test/project-scan.test.ts` 全绿；断言文本不再出现 `MAX_SCAN_DEPTH` / `MAX_SCAN_FILES`

- [x] 1.10 [测试][单元][P1] 新增 `test/scan-ignore.test.ts`：固定清单 / `.gitignore` / `!` 否定 / 嵌套作用域 / 自定义 ignore / 解析失败 fail-open / `respectIgnoreFiles=false` 退化 / Windows 反斜杠归一 `[N2]`
  - 文件：`test/scan-ignore.test.ts`
  - Spec Ref: init-project-scan / 忽略清单与忽略规则解析
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / 固定忽略清单目录不进入遍历
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / `.gitignore` 与否定规则生效
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / 嵌套 `.gitignore` 作用域受限
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / 忽略规则解析失败 fail-open
  - Scenario Ref: init-project-scan / 忽略清单与忽略规则解析 / 关闭忽略规则解析
  - 验证：新测试文件全绿；fail-open 用例断言「不过滤 + warnings 非空」

- [x] 1.11 [测试][功能][P1] `test/project-init-scan.test.ts` 增补：基线含 `limits.skipped>0` 时技能正文要求呈现（生成产物文本断言）；基线 v1/v2 双读不报错；保留既有「基线缺失降级」用例 `[N4][N4F]`
  - 文件：`test/project-init-scan.test.ts`
  - Spec Ref: init-project-scan / 扫描基线落盘
  - Scenario Ref: init-project-scan / 扫描基线落盘 / 历史 v1 基线仍可读取
  - Scenario Ref: init-project-scan / 扫描基线落盘 / 基线缺失时技能降级
  - 验证：`pnpm test test/project-init-scan.test.ts` 全绿

- [x] 1.12 [测试][单元][P2] 扫描既有行为回归：`Ant 项目` / `非 Maven·Ant 族项目` / `预扫描失败不阻断 init` / `配置含凭据键（只记键名）` / `多环境配置变体合并` / `测试目录探针记录事实` / `测试文件模式计数因软超时未完成` / `无测试探针时为空` 八条既有场景在 v2 契约下仍成立
  - 文件：`test/project-scan.test.ts`
  - Spec Ref: init-project-scan / 确定性预扫描
  - Scenario Ref: init-project-scan / 确定性预扫描 / Ant 项目（无 pom.xml）
  - Scenario Ref: init-project-scan / 确定性预扫描 / 非 Maven / Ant 族项目
  - Scenario Ref: init-project-scan / 确定性预扫描 / 预扫描失败不阻断 init
  - Spec Ref: init-project-scan / 敏感值防护
  - Scenario Ref: init-project-scan / 敏感值防护 / 配置含凭据键
  - Scenario Ref: init-project-scan / 敏感值防护 / 多环境配置变体合并
  - Spec Ref: init-project-scan / 信号与候选分层
  - Scenario Ref: init-project-scan / 信号与候选分层 / 测试目录探针记录事实
  - Scenario Ref: init-project-scan / 信号与候选分层 / 测试文件模式计数因软超时未完成
  - Scenario Ref: init-project-scan / 信号与候选分层 / 无测试探针时为空
  - 验证：八条断言全绿；凭据用例断言输出无任何取值

## 2. 索引退役 + 归档 CodeGraph（DEC-2 + DEC-4，同批）

- [x] 2.1 [代码] 删除索引模块：`src/core/spec/sqlite-index.ts`、`markdown-index.ts`、`index-cache.ts`、`sqlite-memory-backend.ts` 整文件移除 `[N5][N5A]`
  - 文件：`src/core/spec/sqlite-index.ts`
  - 文件：`src/core/spec/markdown-index.ts`
  - 文件：`src/core/spec/index-cache.ts`
  - 文件：`src/core/spec/sqlite-memory-backend.ts`
  - 文件：`test/sqlite-index.test.ts`
  - 文件：`test/markdown-index.test.ts`
  - Spec Ref: sqlite-cross-change-index / index.db 初始化
  - Spec Ref: sqlite-cross-change-index / 归档写入索引
  - 验证：`grep -r "sqlite-index\|markdown-index\|index-cache\|sqlite-memory-backend" src test` 零命中；两个测试文件整文件删除（`sqlite-memory-backend.ts` 的其余引用方见任务 2.14）

- [x] 2.2 [代码] `src/commands/spec.ts` 删除 `reindex` 命令与全部辅助（`indexChangeJsonEntry` / `indexSpecsMdFallback` / `indexDesignMdFallback` / `indexExplorationMdFallback` / `extractModule` 等仅索引使用者），清除 `sqlite-index` / `markdown-index` / `index-cache` 的 import `[N9]`
  - 文件：`src/commands/spec.ts`
  - Spec Ref: spec-workflow-cli / reindex 子命令已移除
  - Scenario Ref: spec-workflow-cli / reindex 子命令已移除 / 子命令不再注册
  - Scenario Ref: spec-workflow-cli / reindex 子命令已移除 / 调用已移除的子命令报错
  - Spec Ref: sqlite-cross-change-index / Reindex uses Markdown as the primary source
  - 验证：`node bin/iagent.js spec --help` 无 `reindex`；`node bin/iagent.js spec reindex` 非零退出

- [x] 2.3 [代码] `src/commands/init.ts` 删除 `initDatabase` / `isSqlite3Available` / `resolveIndexDb` import、建库段（`:317-333`）与 `InitResult.indexDbStatus` 字段；`src/cli/index.ts` 移除索引结果渲染行 **与 `:14` 的子命令清单注释中的 `reindex`**（属 7.5 回归锁范围）`[N1][N3]`
  - 文件：`src/commands/init.ts`
  - 文件：`src/cli/index.ts`
  - Spec Ref: spec-workflow-cli / reindex 子命令已移除
  - Scenario Ref: spec-workflow-cli / reindex 子命令已移除 / init 不再创建索引
  - Scenario Ref: spec-workflow-cli / reindex 子命令已移除 / 历史 index.db 不被删除
  - Spec Ref: init-project-scan / index.db 初始化步骤
  - 验证：init 在含历史 `index.db` 的项目上不读不写不删该文件；输出无索引行；`grep -n "reindex" src/cli/index.ts` 零命中

- [x] 2.4 [代码] `src/commands/completion.ts` 的 `IAGENT_COMMANDS.spec.subcommands` 移除 `reindex`（并同步 `spec` 描述串）`[N9]`
  - 文件：`src/commands/completion.ts`
  - Spec Ref: spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令
  - Scenario Ref: spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令 / 补全表不含已退役子命令
  - Scenario Ref: spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令 / 补全表由程序派生并受断言约束
  - 验证：补全一致性测试通过；候选集与 Commander 注册集相等

- [x] 2.5 [代码] `package.json` 删除 `sql.js` 依赖并刷新锁文件（`pnpm install`），确认全仓库零 import `[N5A]`
  - 文件：`package.json`
  - 文件：`pnpm-lock.yaml`
  - Spec Ref: sqlite-cross-change-index / Full-text results retain Markdown evidence
  - 验证：`grep -r "sql.js" src test package.json` 零命中；`pnpm install` 无缺失依赖告警

- [x] 2.6 [代码] `spec-explore` 历史记忆检索收窄为唯一 N5B 分支：删除 `openspec/.iagent/index.db` 与 `exploration_memory` 查询段，改为 Glob `openspec/specs/<capability>/explorations.md`，保留「无能力级探索记忆」记录语义；同时把 CodeGraph「强制首动作」改为能力探测顺序 `[N5][N5A][N5B][N6]`
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - Spec Ref: spec-workflow-skills / spec-explore 探索技能
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 历史记忆仅走能力文件
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 能力记忆文件缺失不阻塞
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / CodeGraph 能力探测先于回退
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 工具名缺失不判定索引不可用
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 只读动作不请求确认
  - Spec Ref: sqlite-cross-change-index / 探索查询索引
  - 验证：模板中零 `index.db` / `exploration_memory` / `sqlite3` 引用；正文含三通道探测顺序

- [x] 2.7 [代码] 白名单单一源新增 `CODEGRAPH_CLI = 'Bash(codegraph:*)'`，并新增 `src/core/templates/codegraph-protocol.ts` 导出 `renderCodegraphProbeOrder({ withCli })`（同一函数两种渲染：三通道 / 仅 MCP 两通道）与 `CODEGRAPH_LOCK_LADDER` 文本（锁阶梯 + `writer.pid` JSON 判据 + 「仅无 daemon 时按需 sync」条件句）`[N6][N9]`
  - 文件：`src/core/templates/tool-whitelist.ts`
  - 文件：`src/core/templates/codegraph-protocol.ts`
  - Spec Ref: tool-call-whitelist / CodeGraph CLI 条目单一源
  - Scenario Ref: tool-call-whitelist / CodeGraph CLI 条目单一源 / 条目格式由共享常量产出
  - Scenario Ref: tool-call-whitelist / CodeGraph CLI 条目单一源 / CLI 与 MCP 条目并存
  - Spec Ref: tool-call-whitelist / CodeGraph 探测顺序与锁阶梯单一源
  - Scenario Ref: tool-call-whitelist / CodeGraph 探测顺序与锁阶梯单一源 / 探测顺序与锁阶梯由共享常量产出
  - Scenario Ref: tool-call-whitelist / CodeGraph 探测顺序与锁阶梯单一源 / daemon 存活禁止解锁
  - Scenario Ref: tool-call-whitelist / CodeGraph 探测顺序与锁阶梯单一源 / writer.pid 不可解析时按存活处理
  - Scenario Ref: tool-call-whitelist / CodeGraph 探测顺序与锁阶梯单一源 / 目录存在性不构成可用性判据
  - Scenario Ref: tool-call-whitelist / CodeGraph 探测顺序与锁阶梯单一源 / 无 daemon 才按需同步
  - Spec Ref: tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造
  - Scenario Ref: tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造 / CodeGraph CLI 条目由常量产出
  - 验证：常量取值与 `Bash(codegraph:*)` 逐字一致；协议文本含 `writer.pid` 的 JSON 判据、`ready:false` / 解析失败按存活的 fail-safe 口径，以及「目录存在性不得用于判可用性」的护栏句；`withCli=false` 渲染结果不含 `codegraph status` 字样

- [x] 2.8 [代码] `spec-archive` 归档段改造：删除 `reindex --force` 调用；CodeGraph 状态检查改能力探测；同步段删除无条件 `codegraph sync`，改「daemon 活跃 → 不同步不解锁」「无 daemon → 按需 sync 一次」；锁冲突走阶梯；`allowedTools` 增 `${CODEGRAPH_CLI}` `[N9]`
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - Spec Ref: spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 归档不含索引重建
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / daemon 活跃时不同步也不解锁
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 无 daemon 时按需同步一次
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 锁阶梯失败降级 Grep
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / CodeGraph 同步失败非阻塞
  - Spec Ref: sqlite-cross-change-index / 归档写入索引
  - 验证：模板零 `reindex` 引用；`allowedTools` 含 `Bash(codegraph:*)`

- [x] 2.9 [代码] `spec-bulk-archive` 同批改造：预检改三通道能力探测、同步段 daemon 判定 + 锁阶梯、删除 `reindex` 与「任何错误一律跳过」粗粒度分支；`allowedTools` 增 `${CODEGRAPH_CLI}` `[N9]`
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - Spec Ref: spec-bulk-archive-skill / CodeGraph 批量预检
  - Scenario Ref: spec-bulk-archive-skill / CodeGraph 批量预检 / 预检成功
  - Scenario Ref: spec-bulk-archive-skill / CodeGraph 批量预检 / 仅部分工具可用时仍判定可用
  - Scenario Ref: spec-bulk-archive-skill / CodeGraph 批量预检 / 预检失败自动跳过
  - Scenario Ref: spec-bulk-archive-skill / CodeGraph 批量预检 / daemon 活跃时不尝试解锁
  - Spec Ref: spec-bulk-archive-skill / CodeGraph 批量同步与验证
  - Scenario Ref: spec-bulk-archive-skill / CodeGraph 批量同步与验证 / 单次项目级同步
  - Scenario Ref: spec-bulk-archive-skill / CodeGraph 批量同步与验证 / daemon 活跃时跳过同步
  - Scenario Ref: spec-bulk-archive-skill / CodeGraph 批量同步与验证 / 锁冲突走阶梯
  - Scenario Ref: spec-bulk-archive-skill / CodeGraph 批量同步与验证 / 同步失败不阻塞
  - Scenario Ref: spec-bulk-archive-skill / CodeGraph 批量同步与验证 / 归档不触发索引重建
  - 验证：模板零 `reindex`；正文含「三通道顺序」与「writer.pid 存活禁止 unlock」

- [x] 2.10 [代码] `debug` / `project-init` 的「先跑 `codegraph_status`」硬约束改为能力探测顺序，并按渲染形态补白名单：`debug` / `project-init` 插值 `renderCodegraphProbeOrder({ withCli: true })` 并加 `${CODEGRAPH_CLI}`（二者正文将声明第三通道 CLI 调用，故 MUST 同时具备该条目）；`migration` 插值 `renderCodegraphProbeOrder({ withCli: false })`（**不加** `CODEGRAPH_CLI`，该技能不跑 CLI），正文旧「遵循 `codegraph_status` 优先规则」措辞一并删除 `[N6]`
  - 文件：`src/core/templates/workflows/debug.ts`
  - 文件：`src/core/templates/workflows/project-init.ts`
  - 文件：`src/core/templates/workflows/migration.ts`
  - Spec Ref: tool-call-whitelist / CodeGraph CLI 条目单一源
  - Scenario Ref: tool-call-whitelist / CodeGraph CLI 条目单一源 / 探索与调试技能具备 CLI 条目
  - Spec Ref: tool-call-whitelist / CodeGraph 探测顺序与锁阶梯单一源
  - Scenario Ref: tool-call-whitelist / CodeGraph 探测顺序与锁阶梯单一源 / 旧「先跑 status」口径不留残留
  - Spec Ref: spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / CodeGraph 同步失败非阻塞
  - 验证：三模板的 CodeGraph 段落均引用同一函数（零手写副本），零「必须是首个动作」与零「codegraph_status 优先规则」表述；`debug` / `project-init` 白名单含 `Bash(codegraph:*)`、`migration` 不含且其渲染结果不含 `codegraph status`；`test/project-init-scan.test.ts:68` 的 `codegraph_status` 文本断言同步改写（改为断言探测顺序关键词）

- [x] 2.11 [测试][功能][P1] `spec-explore` 既有探索协议回归（MODIFIED 需求整体重写后逐条守护）：探索文件持久化 / 写入确认守卫 / 依赖文件 re-read / 材料性歧义划分 / 条件触发保持探索立场 / 入口形态适配 / 含糊输入激活门 / 浮现流程时产出并确认 / 无流程时直通 / 流程最终确认门不死锁
  - 文件：`test/templates.test.ts`
  - Spec Ref: spec-workflow-skills / spec-explore 探索技能
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 探索文件持久化
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 写入确认守卫
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 依赖文件 re-read from disk
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 材料性歧义划分
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 条件触发保持探索立场
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 入口形态适配
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 含糊输入激活门并阻塞确认
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 浮现业务功能流程时产出并确认
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 无业务功能流程时直通不阻断
  - Scenario Ref: spec-workflow-skills / spec-explore 探索技能 / 流程最终确认门不陷入死锁
  - 验证：十条既有场景文本仍可在渲染产物中定位，且探索阶段阻塞门仍 ≤1

- [x] 2.12 [测试][功能][P1] `spec-archive` 需求文档检查点回归（改 CodeGraph 段时不得削弱既有状态分支）：跳过不补生成 / 已存在则对齐 / 生成失败不重试 / 已生成缺失不重建 / 读取失败不落入兼容生成 / 历史无状态兼容 / 人工域受保护 / 单独调用读持久状态 / 失败不阻断归档 / 探索记忆同步 / delta 智能合并
  - 文件：`test/templates.test.ts`
  - Spec Ref: spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 用户跳过且文档缺失时不补生成
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 用户跳过但文档已存在时对齐
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 生成失败状态不静默重试
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 已生成状态但文档缺失不重建
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 状态读取重试一次后失败不落入兼容生成
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 历史变更无状态时兼容生成
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 文档存在时人工域受保护
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / archive 单独调用时读取持久状态
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 需求文档处理失败不阻断归档
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 探索记忆同步
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / delta spec 智能合并
  - 验证：十一条场景文本可定位；需求文档状态四值语义与 `host-orchestration` 一致

- [x] 2.13 [代码] 旧装机迁移的索引提示中性化：`src/core/legacy-migration.ts` 删除「旧索引库已删除，可用 `iagent spec reindex` 重建」提示文案（改为「旧跨变更索引已删除（索引能力已退役）」类中性提示），保留 `LEGACY_INDEX_DB_FILE` / `LEGACY_INDEX_DIR_RELATIVE_PATH` 的旧品牌缓存清理语义（清理对象为 `openspec/changes/archive/.venus/`，与「不删除用户历史 `.iagent/index.db`」不冲突，任务内需在代码注释显式说明该边界）`[N1]`
  - 文件：`src/core/legacy-migration.ts`
  - Spec Ref: sqlite-cross-change-index / index.db 初始化
  - Scenario Ref: spec-workflow-cli / reindex 子命令已移除 / 历史 index.db 不被删除
  - 验证：`grep -n "reindex" src/core/legacy-migration.ts` 零命中；迁移夹具仍删除旧品牌索引目录但提示不含命令名

- [x] 2.14 [测试][功能][P0] 旧索引测试面收口：删除 `test/spec-commands.test.ts` 的 `describe('iagent spec reindex（内存后端，不依赖外部 sqlite3）')` 整段（6 个用例，覆盖变更索引 / 能力冲突 / 决策搜索 / 探索记忆）与 `MemoryBackend` import（它是 `sqlite-memory-backend.ts` 的最后一个引用方）；`test/legacy-migration.test.ts` 的「旧 sidecar 目录与索引库被删除且报告含 reindex 提示」用例改为断言中性提示（不含命令名）。这两个用例组是「提案冲突检测」「探索查询索引」与 reindex 行为仅存的测试面，删除后不再有测试对象。**同批守护 `legacy-install-migration` 主规格的「旧版品牌产物清理」五条既有场景**（该 Requirement 已随本变更 MODIFIED：删除旧索引库后的提示必须中性、不得指向已删命令）
  - 文件：`test/spec-commands.test.ts`
  - 文件：`test/legacy-migration.test.ts`
  - Spec Ref: sqlite-cross-change-index / 提案冲突检测
  - Spec Ref: sqlite-cross-change-index / 探索查询索引
  - Spec Ref: sqlite-cross-change-index / Reindex uses Markdown as the primary source
  - Spec Ref: legacy-install-migration / 旧版品牌产物清理
  - Scenario Ref: legacy-install-migration / 旧版品牌产物清理 / 旧补全脚本与标记块一并清理
  - Scenario Ref: legacy-install-migration / 旧版品牌产物清理 / 标记块不成对时不改动 rc
  - Scenario Ref: legacy-install-migration / 旧版品牌产物清理 / 旧侧车目录清理
  - Scenario Ref: legacy-install-migration / 旧版品牌产物清理 / 旧索引库清理提示不指向已删命令
  - Scenario Ref: legacy-install-migration / 旧版品牌产物清理 / 无旧产物时不触碰用户主目录
  - Spec Ref: spec-workflow-cli / reindex 子命令已移除
  - Scenario Ref: spec-workflow-cli / reindex 子命令已移除 / 历史 index.db 不被删除
  - 验证：`pnpm test test/spec-commands.test.ts test/legacy-migration.test.ts` 全绿；两文件零 `MemoryBackend` / `reindex` 残留；`legacy-install-migration` 五条场景在迁移夹具上逐条可判定

- [x] 2.15 [测试][单元][P2] 提案侧无索引依赖断言：`spec-propose` 模板与 `spec.ts` 辅助中零 `index.db` / `indexChangeJsonEntry` 引用（提案冲突检测改由变更目录内 delta 文件清单承担，行为与当前实际一致）`[N5]`
  - 文件：`test/markdown-first-regression.test.ts`
  - Spec Ref: sqlite-cross-change-index / 提案冲突检测
  - 验证：断言可拦截任何对已删索引 API 的重新引入；提案冲突判断仅依赖 `openspec/changes/*/specs/` 的文件清单

- [x] 2.17 [代码] `sqlite3` 残留收口：`src/core/child-process.ts:30` 的注释「写入子进程 stdin 的内容（sqlite3 等需要）」改为不指向已删除依赖的中性表述（如「写入子进程 stdin 的内容（需要从 stdin 传参的命令）」）；**决策**：`SpawnCommandOptions.input` 选项**保留**（属通用能力，删除它只是扩大改动面且会破坏 `spawnCommand` 对外的兼容形状），但注释 MUST NOT 再以 `sqlite3` 举例 `[N5A]`
  - 文件：`src/core/child-process.ts`
  - Spec Ref: spec-workflow-cli / reindex 子命令已移除
  - Scenario Ref: spec-workflow-cli / reindex 子命令已移除 / 子命令不再注册
  - 验证：`grep -rn "sqlite3" src` 零命中（7.5 回归锁的硬前置）；`pnpm test test/child-process.test.ts` 全绿

- [x] 2.16 [测试][功能][P1] 索引退役后的**规格措辞收口**守护（三处非索引能力的 delta 由本任务承载）：`artifact-json-sidecar` 与 `artifact-markdown-source` 的历史 JSON 只读兼容措辞不再以「索引操作 / 生成索引」为出口；`agent-tool-identity` 不再列举「跨变更索引目录」待改名产物。断言方式：主规格合并前后对三处 Requirement 文本做快照比对（合并后 MUST NOT 出现 `reindex` / `INDEX_DB_PATH` / 「生成索引」类措辞），并在 `iagent spec status` / `iagent spec validate` 上复跑确认只读兼容行为不变。
  - 文件：`test/spec-status.test.ts`
  - 文件：`test/markdown-migration.test.ts`
  - Spec Ref: artifact-json-sidecar / 历史 JSON 只能只读兼容并通过显式迁移
  - Scenario Ref: artifact-json-sidecar / 历史 JSON 只能只读兼容并通过显式迁移 / Markdown 与 JSON 并存
  - Scenario Ref: artifact-json-sidecar / 历史 JSON 只能只读兼容并通过显式迁移 / JSON-only 历史变更读取
  - Scenario Ref: artifact-json-sidecar / 历史 JSON 只能只读兼容并通过显式迁移 / 写入操作遇到 JSON-only 历史变更
  - Scenario Ref: artifact-json-sidecar / 历史 JSON 只能只读兼容并通过显式迁移 / 历史 sidecar 迁移
  - Spec Ref: artifact-markdown-source / Legacy JSON artifacts require explicit migration
  - Scenario Ref: artifact-markdown-source / Legacy JSON artifacts require explicit migration / 历史 JSON-only 变更只读检查
  - Scenario Ref: artifact-markdown-source / Legacy JSON artifacts require explicit migration / Markdown 与历史 JSON 并存
  - Scenario Ref: artifact-markdown-source / Legacy JSON artifacts require explicit migration / 显式迁移遇到已存在目标文件
  - Scenario Ref: artifact-markdown-source / Legacy JSON artifacts require explicit migration / 显式迁移成功
  - Spec Ref: agent-tool-identity / 品牌命名的磁盘产物一同改名
  - Scenario Ref: agent-tool-identity / 品牌命名的磁盘产物一同改名 / 遗留 sidecar 目录改名
  - Scenario Ref: agent-tool-identity / 品牌命名的磁盘产物一同改名 / 索引目录随能力退役
  - Scenario Ref: agent-tool-identity / 品牌命名的磁盘产物一同改名 / 补全产物改名
  - Scenario Ref: agent-tool-identity / 品牌命名的磁盘产物一同改名 / 标记块一致性
  - 验证：三处 Requirement 的合并后文本零 `reindex` / `INDEX_DB_PATH`；既有 status / 迁移用例全绿（本任务只收口措辞，不改行为）

## 3. 提交与纳管（DEC-3）

- [x] 3.1 [代码] `commit.ts` 新增「提案制品纳入」段：活跃变更检测（0/1/多）→ 固定文件清单（`proposal.md` / `design.md` / `tasks.md` / `exploration.md` / `.openspec.yaml` / `specs/**/*.md`，排除 `attachments/**` 与需求文档）精确暂存 → 前缀校验 → 提交信息尾行 `提案: <name>`；保留 `## 约束` 的人工确认条款；`allowedTools` 核对无新增 `[N10][N11]`
  - 文件：`src/core/templates/workflows/commit.ts`
  - Spec Ref: commit-push-skill / Git 提交技能的提案制品纳入
  - Scenario Ref: commit-push-skill / Git 提交技能的提案制品纳入 / 单活跃变更的提案制品随提交
  - Scenario Ref: commit-push-skill / Git 提交技能的提案制品纳入 / 多活跃变更时由用户选择
  - Scenario Ref: commit-push-skill / Git 提交技能的提案制品纳入 / 无活跃变更退化为普通提交
  - Scenario Ref: commit-push-skill / Git 提交技能的提案制品纳入 / 不使用全量暂存
  - Scenario Ref: commit-push-skill / Git 提交技能的提案制品纳入 / 提交前仍需人工确认
  - Scenario Ref: commit-push-skill / Git 提交技能的提案制品纳入 / 纳管缺失时降级不阻断
  - 验证：正文含「MUST NOT `git add -A`」「尾行 `提案:`」「不自动 commit」三处硬约束

- [x] 3.2 [代码] `spec-apply` 完成段新增「提案制品精确暂存 + 提示」：清单固定、逐条 `git add`、不 commit、失败只 WARN `[N8][N10][N11]`
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 实现技能
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 完成段精确暂存提案制品
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 暂存不使用全量添加
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 暂存后不自动提交
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 暂存失败不阻断收尾
  - Spec Ref: commit-push-skill / openspec 变更制品的纳管策略
  - Scenario Ref: commit-push-skill / openspec 变更制品的纳管策略 / 本机缓存仍被忽略
  - 验证：完成段位于测试关卡之后、Guardrails 之前；不出现 `git commit` 调用

- [x] 3.3 [代码] 仓库纳管：`.gitignore` 由「`openspec/` 整目录排除」改为**规则链**「`openspec/*`（通配排除）→ `!openspec/changes/`（放行）→ `openspec/changes/archive/.iagent/`、`openspec/changes/**/attachments/`（逐个再排除）」；`.iagent/` 与 `.openspec-tmp/` 既有条目不动；`openspec/explorations/**`、`openspec/specs/**`、`openspec/devdocs/**`、`openspec/rules/**`、`openspec/config.yaml`、`openspec/CONTEXT.md` 由 `openspec/*` 继续排除（**已决策：保持现状不纳管**，MUST NOT 在实现时再改判）`[N11]`
  - 文件：`.gitignore`
  - Spec Ref: commit-push-skill / openspec 变更制品的纳管策略
  - Scenario Ref: commit-push-skill / openspec 变更制品的纳管策略 / 变更制品可被提交
  - Scenario Ref: commit-push-skill / openspec 变更制品的纳管策略 / 归档变更制品同样被纳管
  - Scenario Ref: commit-push-skill / openspec 变更制品的纳管策略 / 本机缓存仍被忽略
  - Scenario Ref: commit-push-skill / openspec 变更制品的纳管策略 / 放行写法在 git 语义下真实生效
  - 验证：`git status --porcelain --untracked-files=all | Select-String "openspec/changes/"` **非空**（至少含本变更 `proposal.md`）—— 空结果即规则链写法无效，MUST 修正而非改判通过；`git status` 不出现 `attachments/`、`openspec/changes/archive/.iagent/`、`openspec/specs/`、`openspec/explorations/`；`git check-ignore -v openspec/changes/upgrade-workflow-efficiency/proposal.md` 返回非忽略

- [x] 3.4 [代码] `iagent init` 增加纳管策略提示（首次 init 且仓库未纳入 `openspec/changes/**` 时输出一行提示），MUST NOT 改写业务 `.gitignore` 规则 `[N11]`
  - 文件：`src/commands/init.ts`
  - 文件：`src/cli/index.ts`
  - Spec Ref: commit-push-skill / openspec 变更制品的纳管策略
  - Scenario Ref: commit-push-skill / openspec 变更制品的纳管策略 / init 只提示不改写
  - Scenario Ref: commit-push-skill / openspec 变更制品的纳管策略 / SVN 侧语义不变
  - 验证：init 输出含提示行；`.gitignore` 内容除 `--force` 场景外不被改写

- [x] 3.5 [测试][功能][P1] `spec-apply` 既有实现流程回归（MODIFIED 需求整体重写后逐条守护）：设计确认门 / 任务上下文获取 / 任务勾选推进 / scope-creep 防护 / 编译检查 / `[测试]` 任务委派 / 测试不路由 attachments / 未标注任务按代码处理 / 测试执行关卡 / 存量失败不阻塞 / 变更范围失败处置 / 无框架降级 / 测试与实现串行
  - 文件：`test/templates.test.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 实现技能
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 设计确认门
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 任务上下文获取
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 任务勾选推进
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / scope-creep 防护
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 编译检查
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / [测试] 任务委派测试生成技能
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / [测试] 任务不按补充文档路由
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 未标注任务仍按代码实现处理
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 测试执行关卡运行变更范围
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 存量失败测试不阻塞
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 变更范围测试失败处置
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 项目无测试框架时降级
  - Scenario Ref: spec-workflow-skills / spec-apply 实现技能 / 测试任务与实现任务的依赖串行
  - 验证：十三条既有场景文本可定位；实现阶段阻塞门仍为单门

## 4. 确认门白名单（DEC-5）

- [x] 4.1 [代码] 门白名单**数据**定义在协议层 `src/core/host-orchestration/protocol.ts`（`GateWhitelistEntry` + `GATE_WHITELIST`：5 类 + `anchors` 锚点集合（一对多）+ `conditional`，`destructive-change` 为不可豁免项），与 `GateSpec` 同源；`src/core/templates/prompt-gate.ts` 的 `GATE_PROTOCOL_PREAMBLE` 增负向边界句（「非门动作 MUST NOT 停止 / MUST NOT 请求确认」）并 import 白名单渲染门清单文本（模板层依赖协议层，**禁止**协议层反向 import 模板层）`[N6][N7]`
  - 文件：`src/core/host-orchestration/protocol.ts`
  - 文件：`src/core/templates/prompt-gate.ts`
  - Spec Ref: workflow-suite-skills / 编排技能门白名单与直通句
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / 门协议不弱化
  - Spec Ref: tool-call-whitelist / 白名单不改变对话级确认门
  - Scenario Ref: tool-call-whitelist / 白名单不改变对话级确认门 / 纯委派动作不请求确认
  - Scenario Ref: tool-call-whitelist / 白名单不改变对话级确认门 / 破坏性改动仍需确认
  - Spec Ref: host-orchestration / 确认门白名单与协议门清单对齐
  - Scenario Ref: host-orchestration / 确认门白名单与协议门清单对齐 / 协议门均在白名单内
  - 验证：`GATE_WHITELIST` 含 5 条且 `destructive-change.conditional === false`；`requirement-clarification.anchors` 覆盖 `diagnostic-confirmation` 与 `fix-option-confirmation`；PREAMBLE 仍含「本次响应到此结束」；`grep -n "host-orchestration" src/core/templates/prompt-gate.ts` 命中而 `protocol.ts` / `workflows.ts` 中零 `templates/` import（分层方向可由 lint 人工核对）

- [x] 4.2 [代码] `workflow.ts` 四处阶段委派点补直通句（范本 `auto-workflow.ts:41`）并新增「门白名单 + MUST NOT 确认清单」段 `[N7]`
  - 文件：`src/core/templates/workflows/workflow.ts`
  - Spec Ref: workflow-suite-skills / 编排技能门白名单与直通句
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / workflow 补直通句
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / 必留门文本齐备
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / 负向清单齐备
  - Spec Ref: workflow-suite-skills / 每阶段至多一个阻塞确认门（门预算）
  - Scenario Ref: workflow-suite-skills / 每阶段至多一个阻塞确认门（门预算） / 实现阶段单门
  - 验证：正文含 `不停顿`、`不宣告`；门数量不增

- [x] 4.3 [代码] `auto-workflow` / `debug` / `migration` / `spec-*` 补「MUST NOT 请求确认清单」段（引用共享常量，不手写第二份）；`spec-explore` 保留流程图门为唯一流程级阻塞门 `[N6][N7]`
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 文件：`src/core/templates/workflows/debug.ts`
  - 文件：`src/core/templates/workflows/migration.ts`
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 文件：`src/core/templates/workflows/spec-verify.ts`
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - Spec Ref: workflow-suite-skills / 编排技能门白名单与直通句
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / 负向清单齐备
  - Spec Ref: workflow-suite-skills / 每阶段至多一个阻塞确认门（门预算）
  - Scenario Ref: workflow-suite-skills / 每阶段至多一个阻塞确认门（门预算） / 探索阶段门数不超预算
  - 验证：各模板含负向清单且不新增阻塞门；`skill-size-budget` 通过

- [x] 4.4 [代码] `host-orchestration` 对齐：`workflows.ts` 的门 id 与 `GATE_WHITELIST` 的**锚点集合**建立映射（新增常量/断言；`diagnostic-confirmation` / `fix-option-confirmation` 挂 `requirement-clarification`，`flow-final-confirmation` / `implementation-bridge` / `archive-confirmation` 各自挂同名类别），`render.ts` 把「已授权技能直接推进」由 strict 段上移为模板正文通则；`PhaseSpec` 与 `evaluatePhaseTransition` **不改** `[N7][N7F]`
  - 文件：`src/core/host-orchestration/workflows.ts`
  - 文件：`src/core/host-orchestration/render.ts`
  - 文件：`src/core/host-orchestration/protocol.ts`
  - Spec Ref: host-orchestration / 确认门白名单与协议门清单对齐
  - Scenario Ref: host-orchestration / 确认门白名单与协议门清单对齐 / 协议门均在白名单内
  - Scenario Ref: host-orchestration / 确认门白名单与协议门清单对齐 / 五类白名单覆盖全部现有阶段门
  - Scenario Ref: host-orchestration / 确认门白名单与协议门清单对齐 / 对齐不新增阶段门
  - Scenario Ref: host-orchestration / 确认门白名单与协议门清单对齐 / 条件门语义不变
  - Scenario Ref: host-orchestration / 确认门白名单与协议门清单对齐 / 破坏性改动确认独立生效
  - Spec Ref: host-orchestration / Gate and receipt enforcement
  - Scenario Ref: host-orchestration / Gate and receipt enforcement / 非门动作不被建模为停止点
  - Scenario Ref: host-orchestration / Gate and receipt enforcement / 适配器不发明门
  - 验证：门 id 集合 ⊆ 白名单锚点；`evaluatePhaseTransition` 单测（既有）全绿
- [x] 4.5 [代码] 「设计先行」豁免口径落在**真源**：`src/core/project-config.ts` 的 `RULE_CONSTANT_LINES.impl`（`:202` 的「设计先行」行）追加豁免句 —— 父编排已完成实现桥（`implementation-bridge`）时子技能不再重复设计确认，仅在无父流程授权时独立执行确认。**MUST NOT** 只改仓库内已被 `.gitignore` 排除的 `.iagent/rules/coding-rules.md`：它是 init/update 用该常量重组出来的产物（`composeRuleFileContent` 在 `:561` 被调用，常量块外的人工域才逐字保留），直接改会在下次 `init`/`update` 被覆盖且对用户侧零生效 `[N6][N7]`
  - 文件：`src/core/project-config.ts`
  - 产出：`src/core/project-config.ts`
  - Spec Ref: workflow-suite-skills / 编排技能门白名单与直通句
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / 负向清单齐备
  - 验证：`defaultRuleFileContent('impl')` 含豁免句；`test/completion-config.test.ts`（`:246-256` 的蒸馏要点断言）与 `test/project-config-rules.test.ts` 全绿；本仓库执行 `iagent init`/`update` 后 `.iagent/rules/coding-rules.md` 的常量块含该句而人工域逐字不变

- [x] 4.6 [测试][功能][P0] `test/templates.test.ts` 增门白名单断言：编排技能正文含 5 类必留门文本与 MUST NOT 清单；`workflow` 含直通句关键字；不含「是否调用 spec_apply」类自造门句式 `[N7]`
  - 文件：`test/templates.test.ts`
  - Spec Ref: workflow-suite-skills / 编排技能门白名单与直通句
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / 必留门文本齐备
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / 自造门句式被拦截
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / workflow 补直通句
  - Spec Ref: workflow-suite-skills / 每阶段至多一个阻塞确认门（门预算）
  - Scenario Ref: workflow-suite-skills / 每阶段至多一个阻塞确认门（门预算） / 白名单外的门不被计入
  - Scenario Ref: workflow-suite-skills / 每阶段至多一个阻塞确认门（门预算） / 破坏性改动确认不占用阶段门预算
  - 验证：`pnpm test test/templates.test.ts` 全绿

- [x] 4.7 [测试][功能][P1] `test/host-orchestration.test.ts` 增对齐断言：阶段门 id ⊆ `GATE_WHITELIST` 锚点集合（含 `diagnostic-confirmation` / `fix-option-confirmation` → `requirement-clarification` 的一对多映射）；条件门 `gateConditions` 三态行为不变；`evaluatePhaseTransition` 旧用例不改 `[N7F]`
  - 文件：`test/host-orchestration.test.ts`
  - Spec Ref: host-orchestration / 确认门白名单与协议门清单对齐
  - Scenario Ref: host-orchestration / 确认门白名单与协议门清单对齐 / 协议门均在白名单内
  - Scenario Ref: host-orchestration / 确认门白名单与协议门清单对齐 / 五类白名单覆盖全部现有阶段门
  - Scenario Ref: host-orchestration / 确认门白名单与协议门清单对齐 / 条件门语义不变
  - Scenario Ref: host-orchestration / 确认门白名单与协议门清单对齐 / 对齐不新增阶段门
  - Spec Ref: host-orchestration / Gate and receipt enforcement
  - Scenario Ref: host-orchestration / Gate and receipt enforcement / Gate blocks transition
  - Scenario Ref: host-orchestration / Gate and receipt enforcement / Invalid receipt blocks transition
  - 验证：既有 `evaluatePhaseTransition` 用例零改动仍全绿

- [x] 4.8 [测试][功能][P1] `test/allowed-tools.test.ts` / `test/claude-host-adapter.test.ts` 断言同步：新增 `CODEGRAPH_CLI` 覆盖、`debug` 含 `Agent, Task`、`commit` 正文含「提案制品」、宿主委派表未虚增 `[N7F]`
  - 文件：`test/allowed-tools.test.ts`
  - 文件：`test/claude-host-adapter.test.ts`
  - Spec Ref: tool-call-whitelist / CodeGraph CLI 条目单一源
  - Scenario Ref: tool-call-whitelist / CodeGraph CLI 条目单一源 / 归档类技能具备 CLI 条目
  - Scenario Ref: tool-call-whitelist / CodeGraph CLI 条目单一源 / 探索与调试技能具备 CLI 条目
  - Spec Ref: commit-push-skill / Git 提交技能的提案制品纳入
  - Scenario Ref: commit-push-skill / Git 提交技能的提案制品纳入 / 提交前仍需人工确认
  - Spec Ref: tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造
  - Scenario Ref: tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造 / 编排技能白名单经共享常量构造
  - Scenario Ref: tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造 / 授权面不因来源统一而扩大
  - Spec Ref: tool-call-whitelist / 白名单不改变对话级确认门
  - Scenario Ref: tool-call-whitelist / 白名单不改变对话级确认门 / 工具调用自动执行而确认门仍阻塞
  - Scenario Ref: tool-call-whitelist / 白名单不改变对话级确认门 / 自动化语义不构成跳过理由
  - 验证：两文件全绿；白名单常量测试（`tool-whitelist-constants.test.ts`）同步断言

- [x] 4.9 [代码] 只读校验询问收口：删除「检测到技术栈：…是否运行技术栈专项校验？」[是][否] 询问，改为「自动执行技术栈专项检查并在报告中说明校验项」；同时在负向清单段落显式列出「只读校验的『是否运行 <校验>？』询问 MUST NOT 确认」。**实际落点只有两处源码 + 一个派生产物**（原任务写「三处正文」不准确）：① `src/core/templates/workflows/spec-verify-proposal.ts:227`；② `src/core/templates/workflows/workflow.ts:78`（位于 `VERIFICATION_PROTOCOL_FULL` 常量内，`workflow.ts` 正文本身没有第二处）；③ 由上者派生的 `references/verification-protocol.md` 3.4（`workflow.ts:595` 输出，无需单独改，改常量即同步）`[N6][N7]`
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`
  - 文件：`src/core/templates/workflows/workflow.ts`
  - Spec Ref: workflow-suite-skills / 编排技能门白名单与直通句
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / 只读校验不请求确认
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / 负向清单齐备
  - Spec Ref: tool-call-whitelist / 白名单不改变对话级确认门
  - Scenario Ref: tool-call-whitelist / 白名单不改变对话级确认门 / 纯委派动作不请求确认
  - 验证：`grep -rn "是否运行技术栈专项校验" src skills` 零命中；`test/templates.test.ts` 增反向断言；`skill-size-budget` 通过

## 5. 数据共享 · 批次一：debug 派发（DEC-6）

- [x] 5.1 [代码] `debug.ts` `allowedTools` 增 `${SUBAGENT_DISPATCH}`；Phase 4 修复循环改为按 bug 派发单元（同文件串行、并发 ≤ `apply.concurrency`）+ 四列回执 `<bug id> | <状态> | <产出文件> | <公开签名>` + 沿用 `⛔ EXIT GUARD`（子代理不推进阶段、不改 tasks.md）`[N8]`
  - 文件：`src/core/templates/workflows/debug.ts`
  - Spec Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化
  - Scenario Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化 / 修复循环按单元派发
  - Scenario Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化 / 同文件 bug 串行
  - Scenario Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化 / 四列回执
  - Scenario Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化 / 子代理不推进阶段
  - Scenario Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化 / 无派发能力时降级
  - Scenario Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化 / 白名单同步
  - 验证：`allowedTools` 含 `Agent, Task`；正文含四列回执格式与并发上限

- [x] 5.2 [代码] `debug.ts` 正文瘦身：把 46KB 内联探查过程描述中的大段细则下沉 `references/`（新增或复用），主文件保留触发词、阶段骨架、确认门、委派清单与护栏；确保主 SKILL.md 行数 ≤500 `[N8]`
  - 文件：`src/core/templates/workflows/debug.ts`
  - Spec Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化
  - Scenario Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化 / 修复循环按单元派发
  - 验证：`test/skill-size-budget.test.ts` 通过；正文不再内联整段探查过程

- [x] 5.3 [代码] `debug` 探查摘要与 handoff 包衔接声明：`changeName` 确定后 `investigation-digest` 结论作为 `## Codebase 摘要` 来源之一（不重复探查、不替代诊断记录）`[N6][N8]`
  - 文件：`src/core/templates/workflows/debug.ts`
  - Spec Ref: workflow-suite-skills / debug 流程级探查摘要共享
  - Scenario Ref: workflow-suite-skills / debug 流程级探查摘要共享 / 摘要作为 handoff 包 Codebase 摘要来源
  - Scenario Ref: workflow-suite-skills / debug 流程级探查摘要共享 / 摘要不替代交付物
  - 验证：正文含「不重复探查」与「不替代诊断记录」双约束句

- [x] 5.4 [测试][功能][P0] `debug` 派发形态与白名单断言：`allowedTools` 含 `Agent, Task`；正文含四列回执、并发上限、EXIT GUARD 与「子代理 MUST NOT 修改 tasks.md」
  - 文件：`test/templates.test.ts`
  - Spec Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化
  - Scenario Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化 / 白名单同步
  - Scenario Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化 / 四列回执
  - Scenario Ref: workflow-suite-skills / debug 修复循环的派发形态与回执最小化 / 子代理不推进阶段
  - Spec Ref: workflow-suite-skills / debug 流程级探查摘要共享
  - Scenario Ref: workflow-suite-skills / debug 流程级探查摘要共享 / Phase 2 起始先读摘要
  - Scenario Ref: workflow-suite-skills / debug 流程级探查摘要共享 / 不重复已覆盖的查询
  - Scenario Ref: workflow-suite-skills / debug 流程级探查摘要共享 / 摘要不存在时初始化
  - Scenario Ref: workflow-suite-skills / debug 流程级探查摘要共享 / 调试循环复用摘要
  - Scenario Ref: workflow-suite-skills / debug 流程级探查摘要共享 / 工作区关键词派生
  - Scenario Ref: workflow-suite-skills / debug 流程级探查摘要共享 / 修复改动后的摘要失效
  - Scenario Ref: workflow-suite-skills / debug 流程级探查摘要共享 / 摘要落盘失败不阻断
  - Scenario Ref: workflow-suite-skills / debug 流程级探查摘要共享 / 收尾清理摘要
  - 验证：断言逐条可判定；`pnpm test test/templates.test.ts` 全绿

## 6. 数据共享 · 批次二：handoff 包（DEC-6）

- [x] 6.1 [代码] `spec-apply` 的 `BATCH_SCHEDULING_FULL` 改为「变更级 handoff 包」：路径 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md`；六节不变 + 新增可选 `## 阶段结论`；新增「跨阶段复用 propose 产出包」与「独立调用时按同一六节协议产出一次」两条分支 `[N8]`
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 跨阶段复用 propose 产出的包
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 独立调用时按同一协议产出包
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 上下文包一次性产出
  - 验证：正文含 `pipeline-<change-name>` 与 `handoff-pack.md`；不再出现 `apply-<change-name>/context-pack.md` 作为唯一路径

- [x] 6.2 [代码] 指纹校验与阶段结论：包头部固定元信息（`change` / `producedBy` / `producedAt` / `sourceFingerprint`）；阶段入口比对制品指纹，不一致重建 + WARN；`## 阶段结论` 只追加不改写 `[N8]`
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 指纹不一致时重建
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 阶段结论只追加
  - 验证：正文含「不一致 → 重建 + WARN」「不得静默使用陈旧包」

- [x] 6.3 [代码] 工作区生命周期：`spec-apply` 的 `.openspec-tmp/` 创建/清理语义由「apply 级」改为「流程级」；清理同时识别 `pipeline-` 与旧 `apply-` 前缀（迁移期兼容），清理失败记 WARN `[N8]`
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 包机制失效 fail-safe 降级
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 流程级工作区收尾清理
  - 验证：正文含「同时识别两前缀」与清理失败 WARN 口径

- [x] 6.4 [代码] `spec-propose` 新增 handoff 包产出：制品定稿后产出 `handoff-pack.md`（六节 + `sourceFingerprint`），供 verify/apply/archive 只读；产出失败只 WARN（不阻断提案）`[N8]`
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 上下文包一次性产出
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 包机制失效 fail-safe 降级
  - 验证：propose 正文含包产出步骤与六节清单

- [x] 6.5 [代码] `spec-verify` / `spec-archive` 改为只读消费 handoff 包并追加 `## 阶段结论`（禁止重产整包）`[N8][N9]`
  - 文件：`src/core/templates/workflows/spec-verify.ts`
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 阶段结论只追加
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 跨阶段复用 propose 产出的包
  - 验证：两技能正文含「只读 + 追加」，无「重产整包」

- [x] 6.6 [代码] `auto-workflow` / `workflow` 改引用 handoff 包：Phase 3/4/5 阶段入口读包、指纹校验、不一致重建；`auto-workflow` 的继承声明改指 handoff 包 `[N7][N8]`
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 文件：`src/core/templates/workflows/workflow.ts`
  - Spec Ref: workflow-suite-skills / auto-workflow 继承共享资源协议
  - Scenario Ref: workflow-suite-skills / auto-workflow 继承共享资源协议 / Phase 4 显式声明继承
  - Scenario Ref: workflow-suite-skills / auto-workflow 继承共享资源协议 / 复用 propose 产出的 handoff 包
  - Scenario Ref: workflow-suite-skills / auto-workflow 继承共享资源协议 / auto-mode 下协议照常生效
  - Scenario Ref: workflow-suite-skills / auto-workflow 继承共享资源协议 / 派发失败仍按既有策略处理
  - 验证：两模板不另立包格式；正文含 `pipeline-<change-name>`

- [x] 6.7 [代码] `migration` 的规范要点载体改为 handoff 包 `## 规范要点` 节，删除每单元内联注入 `[N8]`
  - 文件：`src/core/templates/workflows/migration.ts`
  - Spec Ref: migration-skills / migration 规范要点写入上下文包
  - Scenario Ref: migration-skills / migration 规范要点写入上下文包 / 规范要点写入包的规范要点节
  - Scenario Ref: migration-skills / migration 规范要点写入上下文包 / 不再内联注入规范要点
  - Scenario Ref: migration-skills / migration 规范要点写入上下文包 / 包路径与协议与其他技能一致
  - Scenario Ref: migration-skills / migration 规范要点写入上下文包 / 包不可用时退化为内联注入
  - Scenario Ref: migration-skills / migration 规范要点写入上下文包 / 规范要点缺失时不阻断
  - 验证：正文含 `handoff-pack.md` 与「不内联规范要点全文」

- [x] 6.8 [代码] `src/core/project-config.ts` 的 `RULE_CONSTANT_LINES.spec` 第 7 行（`:216`，当前为「批次含 ≥2 派发单元时一次性产出 context-pack，MUST NOT 逐单元重复蒸馏」）扩写为「变更级 handoff 包：propose 一次性产出、跨阶段只读并只追加阶段结论，MUST NOT 逐阶段重复蒸馏（`.openspec-tmp/pipeline-<change>/handoff-pack.md`）」。**MUST NOT** 只改 `.iagent/rules/spec.md`（该文件由该常量重组生成，且已被 `.gitignore` 排除）`[N8]`
  - 文件：`src/core/project-config.ts`
  - 产出：`src/core/project-config.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 跨阶段复用 propose 产出的包
  - 验证：`defaultRuleFileContent('spec')` 含 `handoff-pack.md` 且**不含** `context-pack`；本仓库 `.iagent/rules/spec.md` 常量块同步更新而人工域逐字保留；两次连续 `iagent init` 后内容稳定（幂等）

- [x] 6.9 [测试][功能][P0] 新增 handoff 包回归：`.openspec-tmp/pipeline-<change>/` 创建 → propose 产出六节 → verify/apply 只读 + 追加 → 指纹不一致重建 → 收尾清理覆盖所有退出路径；旧 `apply-` 前缀仍被清理
  - 文件：`test/subagent-resource-sharing.test.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 指纹不一致时重建
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 阶段结论只追加
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 独立调用时按同一协议产出包
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 单任务批次不新产出包
  - 验证：断言包路径、六节标题、追加不自损、清理两前缀

- [x] 6.10 [测试][功能][P1] `test/subagent-resource-sharing.test.ts` 的 **A1 既有断言随包改名同步**：`context-pack.md` → `handoff-pack.md`、`.openspec-tmp/apply-<change-name>/` → `.openspec-tmp/pipeline-<change-name>/`、包名口径「handoff 包（原上下文包）是子代理唯一必读制品」按新正文逐字对齐；其余 A2–A4 断言（调度指令瘦身 / 追加动作 / 前缀一致）保持语义不变（**原任务错误指向 `test/template-derivation.test.ts` —— 该文件没有 `BATCH_SCHEDULING_FULL` 断言**）
  - 文件：`test/subagent-resource-sharing.test.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 上下文包一次性产出
  - 验证：该文件全绿；文件内零 `context-pack.md` 与零 `.openspec-tmp/apply-<change-name>/`（6.3 的「识别旧前缀」是**清理逻辑**的表述，MUST NOT 以旧路径作为正向协议路径）

- [x] 6.12 [测试][功能][P0] `test/markdown-first-regression.test.ts` 的 `:52-59`「spec-apply 声明 context-pack…」用例随 6.1 改写：断言目标改为 `handoff-pack.md`（同时保留「以 tasks.md 的勾选框为唯一权威」断言）。**该用例当前硬断言 `context-pack.md`，不改则 8.1 必然失败**（design「测试影响」原表把它误标为「应保持绿」）
  - 文件：`test/markdown-first-regression.test.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 上下文包一次性产出
  - 验证：`pnpm test test/markdown-first-regression.test.ts` 全绿；文件内零 `context-pack.md`；2.15 / 7.5 在本文件追加的索引断言同时为绿

- [x] 6.11 [测试][功能][P1] 派发协议既有行为回归（包位置改写后逐条守护）：调度指令瘦身 / 产出登记表跨批共享 / 回执最小化 / 共享指令前缀字节一致 / 禁止重读与重跑 / 空值处置 / 包缺口回执与回填 / auto-mode 不豁免 / 派发单元与并发上限 / 跨单元同文件拆出 / 无子代理降级 / 任务勾选集中管理
  - 文件：`test/subagent-resource-sharing.test.ts`
  - Spec Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 调度指令瘦身与唯一必读制品
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 产出登记表跨批共享
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 回执最小化
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 共享指令前缀字节一致
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 禁止重读与禁止重跑已覆盖查询
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 空值处置不留空不编造
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 包缺口回执与回填
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / auto-mode 不豁免共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 派发单元与并发上限
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 跨单元同文件拆出并发组
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 无子代理能力的运行时降级
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 任务勾选与失败重试由协调者集中管理
  - 验证：十二条既有场景文本可定位；反向断言（不内联规范摘要等）保持绿

## 7. 版本、文档与快照收口

- [x] 7.1 [使用说明] 版本与变更日志：`package.json` `1.0.2 → 2.0.0`；`CHANGELOG.md` 把 `[Unreleased]` 归档为 `## [2.0.0] - 2026-10-26`（含 `### BREAKING`：删 `spec reindex`、删 `sql.js`、删 `sqlite-cross-change-index` 能力、扫描基线 v1→v2、`openspec/changes/**` 纳管），保留空 `[Unreleased]` 并同步底部链接引用；`README.md` 三处版本号同步（`:18` / `:25` / `:76`）
  - 文件：`package.json`
  - 文件：`CHANGELOG.md`
  - 文件：`README.md`
  - 产出：`CHANGELOG.md`
  - Spec Ref: spec-workflow-cli / reindex 子命令已移除
  - Scenario Ref: spec-workflow-cli / reindex 子命令已移除 / 历史 index.db 不被删除
  - 验证：`node bin/iagent.js --version` 输出 2.0.0；CHANGELOG `### BREAKING` 覆盖四类破坏性变更

- [x] 7.2 [使用说明] `AGENTS.md` 同步（**六处**，缺一即文档漂移）：① 仓库地图删除 `sqlite-index.ts` / `markdown-index.ts` / `index-cache.ts` / `sqlite-memory-backend.ts` 四条与 `reindex` 提及，**新增** `src/core/scan-ignore.ts` 与 `src/core/templates/codegraph-protocol.ts` 条目；② 技术栈行删除 `sql.js`；③ 修改守则第 2 条的**白名单三层表**：把 `Bash(codegraph:*)` 明确归入「调用类」（经 `CODEGRAPH_CLI` 共享常量构造），否则与「技能专有 `Bash(...)` MUST NOT 扩大」自相矛盾；④ 项目约定更新扫描语义（无上限 + 忽略清单 + 软超时 + v2 `limits`）；⑤ 项目约定更新 `openspec/changes/**` 纳管与 `.gitignore` 规则链；⑥ Markdown-first 段落中的索引描述与本次新增的 `.openspec-tmp/pipeline-<change>/` handoff 包约定
  - 文件：`AGENTS.md`
  - 产出：`AGENTS.md`
  - Spec Ref: commit-push-skill / openspec 变更制品的纳管策略
  - Scenario Ref: commit-push-skill / openspec 变更制品的纳管策略 / 变更制品可被提交
  - Spec Ref: init-project-scan / 扫描基线落盘
  - Scenario Ref: init-project-scan / 扫描基线落盘 / 基线写入成功
  - Spec Ref: tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造
  - Scenario Ref: tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造 / CodeGraph CLI 条目由常量产出
  - 验证：`grep -n "reindex\|sql\.js\|sqlite-index\|sqlite-memory\|index-cache" AGENTS.md` 零命中（历史变更记录段除外）；仓库地图含两个新文件；白名单表含 `CODEGRAPH_CLI` 归类

- [x] 7.9 [使用说明] 项目知识文档与术语表同步（② 的文档面，原制品遗漏）：`docs/project/README.md:19`（CodeGraph 内嵌索引 + `sqlite-index.ts` 表述）、`docs/project/architecture/技术框架.md:33`（`sql.js` 依赖行）、`docs/project/modules/模块与功能点.md:90-91`（两个索引模块条目）、`docs/project/README.md:32`（`MAX_SCAN_DEPTH=8` 的 limits 说明）与根 `CONTEXT.md` 的术语表（SQLite Cross-Change Index / MemoryBackend）
  - 文件：`docs/project/README.md`
  - 文件：`docs/project/architecture/技术框架.md`
  - 文件：`docs/project/modules/模块与功能点.md`
  - 文件：`CONTEXT.md`
  - 产出：`docs/project/`
  - Spec Ref: sqlite-cross-change-index / index.db 初始化
  - Spec Ref: init-project-scan / 扫描基线落盘
  - Scenario Ref: init-project-scan / 扫描基线落盘 / 基线写入成功
  - 验证：`grep -rn "sql\.js\|sqlite-index\|sqlite-memory\|MAX_SCAN_DEPTH" docs/project CONTEXT.md` 零命中；术语表中退役条目改写为「已退役（DEC-2）」并保留历史定位描述

- [x] 7.3 [使用说明] `docs/upgrade-guide.md` 新增「索引退役」小节：历史 `index.db` 不删除、可用外部 `sqlite3` 打开、何时可安全清理；`reindex` 命令消失后的替代检索方式
  - 文件：`docs/upgrade-guide.md`
  - 产出：`docs/upgrade-guide.md`
  - Spec Ref: spec-workflow-cli / reindex 子命令已移除
  - Scenario Ref: spec-workflow-cli / reindex 子命令已移除 / 调用已移除的子命令报错
  - 验证：文档含清理指引与替代检索说明

- [x] 7.4 [代码] `pnpm build && pnpm generate:skills` 重新生成 `skills/` 快照；`.claude/` dogfood 产物按需 `iagent update`（不入库）
  - 文件：`skills/`
  - Spec Ref: tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造
  - Scenario Ref: tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造 / 常量变更自动跟随
  - 验证：`test/skills-parity.test.ts` 通过；`git status` 仅含预期快照变动

- [x] 7.5 [测试][功能][P0] 索引移除彻底性回归锁（新增测试）：`src/`、`src/core/templates/`、`skills/` 中零 `reindex` / `index.db` / `sqlite3` / `sql.js` 引用；白名单仅限两类历史落点 —— `docs/upgrade-guide.md` 等迁移说明中的历史提及，以及 `src/core/legacy-migration.ts` 的旧品牌常量（`LEGACY_INDEX_DB_FILE` / `LEGACY_INDEX_DIR_RELATIVE_PATH`，用于清理 `openspec/changes/archive/.venus/`，**不得**含 `reindex` 文案）。断言 MUST 以白名单路径精确排除，MUST NOT 用宽松前缀放过整个 `src/`
  - 文件：`test/markdown-first-regression.test.ts`
  - Spec Ref: spec-workflow-cli / reindex 子命令已移除
  - Scenario Ref: spec-workflow-cli / reindex 子命令已移除 / 子命令不再注册
  - Spec Ref: sqlite-cross-change-index / index.db 初始化
  - 验证：新增断言可拦截任何残留引用；既有 markdown-first 断言保持绿

- [x] 7.6 [测试][功能][P1] 命令面与配置面回归：`test/commands.test.ts` / `test/config-command.test.ts` 更新命令清单与 `InitResult` 字段断言；`test/skill-size-budget.test.ts` / `test/command-reference-refs.test.ts` 复跑
  - 文件：`test/commands.test.ts`
  - 文件：`test/config-command.test.ts`
  - 文件：`test/skill-size-budget.test.ts`
  - 文件：`test/command-reference-refs.test.ts`
  - Spec Ref: spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令
  - Scenario Ref: spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令 / 补全表含 migrate 与 validate
  - 验证：四文件全绿；命令总数与 `AGENTS.md` 描述一致

- [x] 7.7 [测试][功能][P1] 归档步骤序回归：`spec-archive` / `spec-bulk-archive` 正文断言「无 reindex」「daemon 活跃 → 不 sync 不解锁」「无 daemon → sync 一次」
  - 文件：`test/templates.test.ts`
  - Spec Ref: spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 归档不含索引重建
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / daemon 活跃时不同步也不解锁
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 无 daemon 时按需同步一次
  - Spec Ref: spec-bulk-archive-skill / CodeGraph 批量同步与验证
  - Scenario Ref: spec-bulk-archive-skill / CodeGraph 批量同步与验证 / 归档不触发索引重建
  - 验证：断言覆盖两技能与两分支

- [x] 7.8 [使用说明] ADR-0002 落盘（制品层已在本阶段完成；实现阶段只复核与设计一致）：`openspec/docs/adr/0002-retire-sqlite-cross-change-index.md` 记录索引退役的背景 / 决策 / 理由 / 影响 / 否决方案 / 恢复方式
  - 文件：`openspec/docs/adr/0002-retire-sqlite-cross-change-index.md`
  - 产出：`openspec/docs/adr/0002-retire-sqlite-cross-change-index.md`
  - Spec Ref: sqlite-cross-change-index / index.db 初始化
  - 验证：ADR 编号与既有 ADR-0001 不冲突；内容与 design「ADR 引用」段一致

## 8. 全量回归与端到端

- [x] 8.1 [测试][功能][P0] `pnpm build && pnpm lint && pnpm test` 全量通过；对失败项按「模板修正 → 重新 `generate:skills` → 复跑」闭环
  - 文件：`test/`
  - Spec Ref: workflow-suite-skills / 编排技能门白名单与直通句
  - Scenario Ref: workflow-suite-skills / 编排技能门白名单与直通句 / 门协议不弱化
  - 验证：三条命令退出码均为 0

- [x] 8.2 [测试][功能][P1] 端到端手测：全新项目 `iagent init`（检查 `skipped` 呈现与无索引行）→ 本变更 `spec-apply` 收尾暂存提示 → `commit` 清单含提案制品且尾行溯源 → `spec-archive` 无 reindex、daemon 活跃时不 sync
  - 文件：`test/`
  - Spec Ref: commit-push-skill / Git 提交技能的提案制品纳入
  - Scenario Ref: commit-push-skill / Git 提交技能的提案制品纳入 / 单活跃变更的提案制品随提交
  - Spec Ref: spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref: spec-workflow-skills / spec-archive 归档技能 / 无 daemon 时按需同步一次
  - 验证：四个环节的人工可见输出与规格一致，记录到实现报告

## 依赖与顺序

- 1.1 → 1.2（遍历接入忽略）；1.2 → 1.3 → 1.4；1.5 / 1.6 可与 1.2 并行；1.4 → 1.7（消费侧）；1.4 → 1.13（注入路径，先有 `ScanOptions` 再有 CLI/env 透传）；1.8 独立
- 1.9 依赖 1.1/1.2/1.3；1.10 依赖 1.1；1.11 依赖 1.4/1.7；1.12 依赖 1.3/1.4/1.6
- 2.1 → 2.2 → 2.3 → 2.4 → 2.5（删除链条，缺一即编译失败）；2.7 → 2.8 / 2.9 / 2.10（常量先于引用）；**2.2 与 2.8/2.9 必须同批提交**（归档段耦合）
- 2.6 依赖 2.1（索引分支删除后正文才能收窄）；2.11 依赖 2.6（探索协议改写后回归）；2.12 依赖 2.8（归档段改写后回归）；2.13 / 2.14 依赖 2.1（模块删除后文案与测试面同步收口）；2.15 依赖 2.1（索引 API 删除后断言无回引）；**2.16 / 2.17 与 2.5 同批**（残留字样必须先清零，否则 7.5 回归锁永远红）
- 3.1 独立；3.2 依赖 3.3（纳管未生效时暂存必降级，仅影响手测）；3.4 依赖 3.3；3.5 依赖 3.2（完成段新增后回归既有实现流程）
- 4.1 → 4.2 / 4.3 / 4.4（常量先于引用）；4.5 独立；4.6 依赖 4.1–4.4；4.7 依赖 4.4；**4.8 依赖 2.7 / 3.1 / 5.1 → 必须排在 ⑥ 批次一之后**（它同时断言 `CODEGRAPH_CLI`、commit 正文与 debug 派发；⑤ 的收口以 4.6/4.7 为界，MUST NOT 因 4.8 把批次一提前）；4.9 依赖 4.1（负向清单先定稿）并与 4.3 同批（同一批模板正文改写）
- 5.1 → 5.3；5.2 与 5.1 同批（正文瘦身需与派发段一起改写）；5.4 依赖 5.1/5.2
- 6.1 → 6.2 → 6.3；6.1 → 6.4 → 6.5 → 6.6；6.7 依赖 6.1；6.8 独立（规则常量）；6.9 依赖 6.1–6.6；6.10 依赖 6.1（A1 断言随改名同步）；**6.12 依赖 6.1（不随则 8.1 必红）**；6.11 依赖 6.1（包路径改写后回归既有派发协议）
- 7.1–7.3 / 7.9 依赖模板与代码定稿（1.x–6.x）；7.4 依赖全部模板改动；7.5–7.7 依赖 7.4；7.9 依赖 1.3/1.6/2.1
- 8.1 依赖 7.4/7.5；8.2 依赖 8.1
- **⑥ 批次次序**：5.x（批次一）必须先于 6.x（批次二）——批次一补齐 debug 的派发与四列回执语义，批次二在同一回执/登记表口径上扩展为跨阶段包；批次一 MUST 在「包不存在时读 `investigation-digest` + 单元清单」的降级口径下独立可实施（见 design D7）
