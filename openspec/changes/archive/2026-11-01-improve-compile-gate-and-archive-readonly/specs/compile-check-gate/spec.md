## ADDED Requirements

### Requirement: compileCheck 配置契约与默认值单一源

编译检查的配置权威载体 SHALL 为项目 `.iagent/config.yaml` 的顶层 `compileCheck` 段（本工具的项目配置目录），MUST NOT 以 `openspec/config.yaml` 或任何第二处作为权威来源。

段内字段与默认值 SHALL 由 `src/core/project-config.ts` 单点定义并对外暴露（接口 + 解析 + 默认值 + 默认配置内容），MUST NOT 在技能模板或 CLI 命令中各自**定义**一套默认值（测试可断言生效值，但其期望值须来自同一实现常量，MUST NOT 成为可独立编辑的第三份真源）：

| 字段 | 类型 | 默认 | 语义 |
| :--- | :--- | :--- | :--- |
| `enabled` | 布尔 | `true` | 是否执行编译检查；`false` 为项目级显式禁用 |
| `command` | 字符串 | 空（= 自动探测） | 显式编译命令，优先级最高 |
| `timeoutMs` | 整数 | `600000` | 单条命令超时上限（10 分钟），超时计为失败 |
| `incremental` | 布尔 | `true` | 批调度每批结束后是否执行批后编译检查（复用收尾全量的同一命令，范围限定本批改动模块） |
| `autoFix` | 布尔 | `true` | 编译失败后是否进入自动修复循环 |
| `maxRetries` | 整数 | `3` | 自动修复循环的重试上限 |

解析 SHALL 接受缺段、缺字段与非法取值：缺段 / 缺字段回退默认值；非法取值（非布尔、非正整数、非数字）回退该字段默认值并输出 WARN。默认配置内容 SHALL 以注释示例形式给出该段，使用户可见可改。

**原始值与生效值分离**：原始解析结果（`ProjectConfig.compileCheck`）只承载用户显式声明的字段（缺失即未声明），补全默认后的完整值（`ResolvedProjectConfig.compileCheck`）才是生效值；段级来源标记 SHALL 为「段存在 = 用户配置 / 段缺失 = 默认值」，段内字段回退 SHALL 在 `iagent config show` 的 WARN 行中逐字段可见，MUST NOT 把回退值静默标为用户配置。

**技能侧取值**：技能 SHALL 先读 `.iagent/config.yaml` 的该段；段缺失或字段缺失时，SHALL 经 `iagent config show` 读取生效默认值（apply 已持 `Bash(iagent:*)`）；CLI 不可用时才使用本节默认值并记 WARN。技能模板 MUST NOT 定义与 `DEFAULT_COMPILE_CHECK` 不同的默认值，MUST NOT 引入第二套字段名。

**字段作用域**：本段的 `command` / `timeoutMs` / `maxRetries` / `autoFix` / `incremental` SHALL 仅约束 `iagent_spec_apply` 的编译门；`debug` 仅共享 `enabled` 与「缺省启用」语义，仍按自身 Phase 5 的技术栈探测执行。`iagent_spec_apply` 与 `iagent_debug` 正文 MUST 声明该作用域，MUST NOT 让用户误以为设置 `command` 会对 debug 生效。

#### Scenario: 缺省即启用

- **WHEN** 项目 `.iagent/config.yaml` 不存在或不含 `compileCheck` 段
- **THEN** 生效配置为 `enabled=true` / `timeoutMs=600000` / `incremental=true` / `autoFix=true` / `maxRetries=3` / `command` 为空，且该生效值可由 `iagent config show` 查看

#### Scenario: 项目级显式禁用

- **WHEN** `.iagent/config.yaml` 声明 `compileCheck.enabled: false`
- **THEN** 技能以 `disabled` 为编译检查终态并写入证据，摘要中明确记录「项目级显式禁用编译检查」，MUST NOT 记为通过

#### Scenario: 非法取值回退默认并告警

- **WHEN** `compileCheck.maxRetries: 0` 或 `compileCheck.enabled: maybe`
- **THEN** 该字段回退默认值（`3` / `true`），解析过程输出 WARN 指明字段与回退值，MUST NOT 静默采用非法值

### Requirement: 编译命令的运行时判定

编译命令 SHALL 在运行时按目标项目的实际构建描述符确定，技能模板 MUST NOT 固化本项目（iagent 自身）的命令为唯一命令。

判定顺序 SHALL 为：

1. **显式配置**：`compileCheck.command` 非空 → 直接使用（不经探测）；
2. **构建描述符探测**：以**变更文件最近的祖先目录**为起点向上查找构建描述符，按项目实际命中的描述符构造命令——`package.json` 的 `scripts.build`（无 `build` 脚本时降级为同目录存在 `tsconfig.json` 则 `tsc --noEmit`）、lockfile 决定包管理器（`pnpm-lock.yaml` → `pnpm run build`，`package-lock.json` → `npm run build`，`yarn.lock` → `yarn build`）、`pom.xml` → `mvn compile -DskipTests`、`build.gradle` / `build.gradle.kts` → `gradle compileJava`、`build.xml` → `ant compile`、`go.mod` → `go build ./...`、`Cargo.toml` → `cargo build`、`build.js` → `node build.js`；
3. **不适用**：以上均未命中 → 终态 `not-applicable`（**不得**记为通过）。

**monorepo 语义**：变更文件分布在多个模块时，SHALL 按各自最近的构建描述符归组，**去重后逐条执行**；每条命令的 `command` / `exitCode` / 范围 SHALL 分别记录，任一命令非零退出即整体失败。

#### Scenario: 显式命令优先

- **WHEN** `compileCheck.command` 配置为 `node build.js`
- **THEN** 技能只执行该命令，不追加任何探测得到的命令

#### Scenario: 按描述符探测（非本仓库项目）

- **WHEN** 变更文件位于含 `pom.xml` 的 Java 模块内且未配置 `command`
- **THEN** 技能执行 `mvn compile -DskipTests`，不执行 `tsc --noEmit`

#### Scenario: monorepo 多描述符逐条执行并记录

- **WHEN** 变更文件横跨 `packages/a`（`package.json`）与 `packages/b`（`tsconfig.json`）
- **THEN** 技能按两个描述符分别执行命令，证据中 `command` 与 `exitCode` 列各有两条对应记录（逐行）

#### Scenario: 无可编译产物记不适用

- **WHEN** 变更仅含 Markdown 文档且项目无任何构建描述符，且未配置 `command`
- **THEN** 技能以 `not-applicable` 终态写入证据，`reason` 说明「未探测到可编译产物」，MUST NOT 记为 `pass`

### Requirement: 编译检查硬门与终态模型

编译检查 SHALL 为硬门：其终态只允许四值——`pass`（命令全部零退出）/ `fail`（存在非零退出或超时）/ `not-applicable`（无可编译产物）/ `disabled`（项目级 `enabled: false`）。

技能 MUST NOT 提供会话级「跳过编译检查」出口：正文与输出模板 MUST NOT 出现「跳过检查」「跳过并记录警告」一类选项。失败时 SHALL 按 `autoFix` 进入自动修复循环（`autoFix=true` 时最多重试 `maxRetries` 次，`false` 时直接失败）；仍失败则**暂停并报告**，MUST NOT 进入测试执行门、MUST NOT 建议归档、MUST NOT 把任务勾选为完成。

依赖未安装 / 环境缺失导致的命令失败、命令超时 SHALL 计为 `fail` 并进入修复循环，MUST NOT 归类为 `not-applicable` 或跳过。

**自动修复开关**：`compileCheck.autoFix=false` 时首次失败 SHALL 直接记 `fail` 并暂停，MUST NOT 进入自动修复循环；`maxRetries` 仅在 `autoFix=true` 时生效。MUST NOT 出现「配置声明了 autoFix 但正文无对应分支」的脱节。

**批后增量检查的命令**：`compileCheck.incremental=true` 时的批后检查 SHALL 复用收尾全量所用的同一条命令（显式 `command` 或描述符探测结果），仅把报告范围限定为本批改动的模块；MUST NOT 引入第二套「轻量命令」字段或隐式命令。批后检查修复耗尽后 SHALL 立即记 `fail` 并暂停（不继续后续批次、不进入测试门）。

**辅助检查边界**：lint / 前端校验（若项目适用）保留为 Step 8 的辅助项，失败仅记 WARN 与摘要，SHALL NOT 参与四值终态、SHALL NOT 计入证据 `errorCount`；MUST NOT 因重写 Step 8 而静默移除这两步。

#### Scenario: 失败后自动修复再重跑

- **WHEN** 编译命令非零退出且 `autoFix=true`
- **THEN** 技能按可修复性分类问题、只修改变更范围内文件、重跑命令，最多 `maxRetries` 次

#### Scenario: 显式关闭自动修复

- **WHEN** `compileCheck.autoFix=false` 且编译命令首次非零退出
- **THEN** 技能不进入修复循环，直接记 `fail` 证据并暂停，输出剩余错误（含 `file:line`）

#### Scenario: 批后增量检查复用同一命令

- **WHEN** `compileCheck.incremental=true` 且某批任务完成
- **THEN** 技能复用收尾全量的同一条命令对本次改动模块执行检查，失败的处置与收尾全量一致；MUST NOT 另造一条「轻量」命令

#### Scenario: 重试耗尽后暂停

- **WHEN** 自动修复 `maxRetries` 次后命令仍失败
- **THEN** 技能暂停并报告失败明细（剩余错误 + `file:line`），MUST NOT 进入测试执行门，MUST NOT 给出归档建议

#### Scenario: 无会话级跳过出口

- **WHEN** 编译检查失败且用户要求「跳过检查继续」
- **THEN** 技能 MUST NOT 记录 `disabled`（该终态仅来自配置文件 `enabled: false`）、MUST NOT 伪造 `not-applicable`，仍保持 `fail` 并暂停

#### Scenario: 超时与缺依赖计为失败

- **WHEN** 命令超时（超过 `timeoutMs`）或失败原因含依赖未安装（如 `command not found` / 缺 `node_modules`）
- **THEN** 终态为 `fail` 并进入修复循环，MUST NOT 记为 `not-applicable`

### Requirement: 编译证据契约

技能 SHALL 在 `.openspec-tmp/pipeline-<change-name>/compile-report.md`（`path.join()` 构造）写入结构化编译证据，字段至少包含：`change` / `command` / `exitCode` / `errorCount` / `fixedCount` / `status` / `scope` / `timestamp` / `reason`（列名固定；同一变更的多条命令逐行记录，文件级汇总按下一段规则）。

同时 SHALL 向变更级 handoff 包的 `## 阶段结论` 表追加一行 `phase=compile`（含 `status` 与 `artifact` 指向证据文件路径），MUST NOT 重产整包。

证据 SHALL 在「成功 / 失败 / 不适用 / 显式禁用」四种终态下均产出——**没有任何终态可以免于写证据**。

**非执行行占位**：未真正执行命令的终态（`not-applicable` / `disabled`）SHALL 以固定占位符 `-` 填写 `command`、`exitCode`、`scope`，`errorCount=0`、`fixedCount=0`，并在 `reason` 写明「未探测到可编译产物」或「项目级显式禁用」；MUST NOT 留空或使用 `N/A` 等自由文本变体，以保证父流程可按固定列解析。

**文件级汇总**：多条命令时 SHALL 输出文件级汇总（`**summary**: status=...`）。汇总优先级为：任一命令 `fail` → `fail`；否则全部 `pass` → `pass`；零命令执行时只能为 `not-applicable` 或 `disabled`。父流程 SHALL 读取汇总行（或等价的汇总字段），MUST NOT 以表格最后一行的状态代表整个变更。

#### Scenario: 成功时写证据

- **WHEN** 编译命令全部零退出
- **THEN** 证据文件 `status=pass`，`errorCount=0`、`fixedCount` 为本次自动修复数，阶段结论追加 `compile | pass | <证据路径>`

#### Scenario: 失败时仍写证据

- **WHEN** 重试耗尽后仍有编译错误
- **THEN** 证据文件 `status=fail` 且 `errorCount` 为剩余错误数，阶段结论追加 `compile | fail | <证据路径>`

#### Scenario: 不适用与禁用同样留痕

- **WHEN** 终态为 `not-applicable` 或 `disabled`
- **THEN** 证据文件照常产出，`reason` 分别写明「无可编译产物」与「项目级显式禁用」，阶段结论同步追加对应 `status`；`command` / `exitCode` / `scope` 记 `-`，`errorCount` / `fixedCount` 记 `0`

#### Scenario: 多命令按汇总行判定

- **WHEN** monorepo 中 `packages/a` 编译失败、`packages/b` 编译通过
- **THEN** 表格有两行（一行 `fail`、一行 `pass`），汇总行 `status=fail`；父流程读取汇总行判 `fail` 并阻断归档，MUST NOT 因最后一行是 `pass` 而放行

### Requirement: 编译证据生命周期

编译证据与 handoff 包 SHALL 保留至父流程归档收尾，`iagent_spec_apply` 的收尾清理（Step 10）MUST NOT 删除 `compile-report.md` 与 `handoff-pack.md`；清理对象限于临时脚本与草稿。

**归档收尾清理**：`.openspec-tmp/pipeline-<change-name>/` 的最终清理 SHALL 由归档阶段完成——`spec-archive` 在每个变更归档成功后、`spec-bulk-archive` 在每个归档单元成功后清理该变更的管道工作区（同时识别 `pipeline-` 与旧 `apply-` 前缀）；失败 / 跳过的单元保留工作区供诊断。清理失败 SHALL 记 WARN，MUST NOT 阻断归档、MUST NOT 改写已写入的阶段结论。

独立调用 `iagent_spec_apply`（无父流程）时，技能 SHALL 保留证据并在输出中报告证据路径，MUST NOT 强制删除（清理责任移交用户）。

#### Scenario: 收尾清理保留证据

- **WHEN** apply 完成测试执行门并进入收尾清理
- **THEN** `compile-report.md` 与 `handoff-pack.md` 仍存在，清理仅作用于临时脚本与草稿；清理失败记 WARN 不阻断

#### Scenario: 独立调用保留证据并报告路径

- **WHEN** 无父流程时独立执行 apply
- **THEN** 技能在完成摘要中给出证据文件路径，MUST NOT 删除该文件

#### Scenario: 归档收尾清理流程级工作区

- **WHEN** 单变更归档成功并已追加 `phase=archive` 结论；或批量归档的某个单元记录 Success
- **THEN** 技能清理该变更的 `.openspec-tmp/pipeline-<change-name>/`（含 `compile-report.md` 与 `handoff-pack.md`），同时识别旧 `apply-` 前缀；批量按**单元**清理（批量不消费 handoff 包的阶段结论，故以该单元的 Success 记录为清理时点）；清理失败记 WARN 且不阻断归档

#### Scenario: 失败或跳过单元保留工作区

- **WHEN** 批量归档中某变更归档失败或被跳过
- **THEN** 该变更的 `.openspec-tmp/pipeline-<change-name>/` 保留供诊断，摘要注明保留位置，MUST NOT 删除

### Requirement: 旧配置来源弃用（不双源）

`openspec/config.yaml` 中若存在 `compileCheck` 段或 `apply.incrementalCheck` / `apply.compileCheck` 一类字段，技能 SHALL 只在读取阶段做**一次** WARN 提示（指向 `.iagent/config.yaml` 的新字段），MUST NOT 采用其取值、MUST NOT 在两个文件间做合并或回退。

`apply.incrementalCheck` 的语义 SHALL 收敛为 `compileCheck.incremental`，MUST NOT 保留两处独立真源。

#### Scenario: 旧位置配置只告警不生效

- **WHEN** 项目仅在 `openspec/config.yaml` 写有 `compileCheck.enabled: false`，而 `.iagent/config.yaml` 无该段
- **THEN** 生效值仍为默认 `enabled=true`，技能输出一次 WARN 指明迁移目标，不采用旧取值

#### Scenario: incrementalCheck 收敛

- **WHEN** 项目在 `openspec/config.yaml` 声明 `apply.incrementalCheck: false`
- **THEN** 技能输出一次 WARN，生效值取 `compileCheck.incremental`（缺省 `true`），MUST NOT 以旧字段关闭批后检查

### Requirement: iagent config show 展示生效编译检查配置

`iagent config show` SHALL 在既有摘要中展示生效的 `compileCheck` 值（`enabled` / `command` / `incremental` / `timeoutMs` / `autoFix` / `maxRetries`）及其来源（用户配置或默认值），使用户无需读源码即可确认编译门是否生效。

#### Scenario: 展示默认生效值

- **WHEN** `.iagent/config.yaml` 不含 `compileCheck` 段并运行 `iagent config show`
- **THEN** 输出 `compileCheck: enabled=true, command=(自动探测), incremental=true, timeoutMs=600000, autoFix=true, maxRetries=3（来源：默认值）`

#### Scenario: 展示用户配置值

- **WHEN** `.iagent/config.yaml` 声明 `compileCheck.enabled: false` 与 `compileCheck.command: node build.js`
- **THEN** 输出对应取值并标注来源为用户配置

#### Scenario: 非法取值在 config show 中可见

- **WHEN** `.iagent/config.yaml` 声明 `compileCheck.maxRetries: 0`（非法）且未声明其他字段
- **THEN** 输出 `maxRetries=3` 并附 WARN 行指明「`maxRetries` 非法，已回退默认值 3」；来源仍标注为「用户配置（含回退字段）」而非纯默认值

### Requirement: 编译检查细则的 references 下沉与预算约束

`iagent_spec_apply` 主 SKILL.md SHALL 只保留 Step 8 的门 / 判定 / 证据 / 失败处置骨架与指向 `references/compile-check.md` 的读取指令（执行 Step 8 前 MUST 先 `Read` 该文件）；描述符探测矩阵、命令构造细则、monorepo 归组去重算法、证据模板与终态判定表 SHALL 下沉到该 references 文件。

下沉 MUST NOT 降低约束强度：主文件缺失细则不等于约束失效，references 缺失或不可读时技能 MUST 记录 WARN 并按其内联摘要继续，MUST NOT 因此跳过编译检查。

主 SKILL.md 行数 MUST ≤500（`test/skill-size-budget.test.ts` 守护）；`pnpm generate:skills` 产出的技能目录 SHALL 包含 `references/compile-check.md`。`<!-- CMD:SKIP -->` 成对标记 MUST 保留 references 读取指令在 command 版可见（漏标 fail-safe 使 command 版保留更长的说明，MUST NOT 反向标记）；command 版不随附 references 目录时，执行者 SHALL 按主文件内联摘要继续并记 WARN，MUST NOT 因此跳过编译检查。

#### Scenario: 主文件保留骨架并指向 references

- **WHEN** 检查生成的 `iagent-spec-apply/SKILL.md`
- **THEN** Step 8 含门 / 终态 / 证据字段骨架与「执行 Step 8 前 MUST 先 Read `references/compile-check.md`」，细则表格不在主文件

#### Scenario: references 文件随快照生成

- **WHEN** 运行 `pnpm generate:skills`
- **THEN** `skills/iagent-spec-apply/references/compile-check.md` 存在且含描述符探测矩阵与证据模板

#### Scenario: 细则缺失不降级为跳过

- **WHEN** `references/compile-check.md` 不可读
- **THEN** 技能记录 WARN 并按主文件内联摘要继续执行编译检查，MUST NOT 跳过或记为 `not-applicable`

