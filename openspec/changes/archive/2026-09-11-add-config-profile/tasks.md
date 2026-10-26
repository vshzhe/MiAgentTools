# Tasks: add-config-profile

<!-- 任务按依赖序：profile 核心 → 配置字段 → init/update → config 命令 → onboarding → 测试 → 文档 -->

## 1. profile 核心与模板注册

- [x] 1.1 [代码] 新建 `src/core/profiles.ts`：定义 `DEFAULT_WORKFLOWS`（7 项：tr-init-project + spec 全 6）、依赖注入规则表 `DEPS: Record<string, string[]>`（`spec-propose→[spec-verify-proposal]`、`spec-archive→[spec-verify]`）、`resolveWorkflows(config): { workflows: string[]; injected: string[] }`（缺失 workflows 用默认集，存在则用户列表+依赖注入补全，返回补入项标注）
  - 文件：`src/core/profiles.ts`（新建）
  - 验证：单测 `resolveWorkflows` 三场景——(a) 无 workflows→返回默认集 7 项、injected=[]；(b) `[spec-propose]`→返回含 spec-verify-proposal、injected=[spec-verify-proposal]；(c) `[spec-apply]`→injected=[]

- [x] 1.2 [代码] `registry.ts`：`WorkflowPair` 接口增加 `workflowId: string` 字段，`WORKFLOW_PAIRS` 每项用 `deriveCommandId(skill.name)` 挂 workflowId；`getSkillTemplates` 与 `getCommandTemplates` 增加 `workflowFilter?: readonly string[]` 参数，传入时按 Set 过滤（保留现有 typeFilter 行为，二者正交可叠加）
  - 文件：`src/core/templates/registry.ts`
  - 验证：`getSkillTemplates(undefined, ['spec-explore'])` 返回 1 项；`getSkillTemplates('spec', undefined)` 返回 6 项（既有行为不变）

## 2. 项目配置扩展

- [x] 2.1 [代码] `project-config.ts`：`ProjectConfig` 接口增加 `workflows?: string[]` 字段；`parseProjectConfig` 解析 `workflows:` 下的 `- <id>` 列表项（与 rules 解析同模式）；`defaultConfigFileContent` 默认含默认集 7 项注释示例；`readProjectConfig` 的 `ResolvedProjectConfig` 增加 `workflows?: string[]` 透传
  - 文件：`src/core/project-config.ts`
  - 验证：解析含 `workflows: [tr-impl-feature]` 的 config 返回该字段；无该字段返回 `workflows: undefined`

## 3. init/update 过滤与 reconcile

- [x] 3.1 [代码] `init.ts`：读取 `readProjectConfig` 的 workflows，调 `resolveWorkflows` 得生效集；`getSkillTemplates(undefined, workflows)` / `getCommandTemplates(undefined, workflows)` 过滤安装；`InitResult` 增加 `workflowsSource: 'default' | 'user'` 与 `injectedDeps: string[]` 字段供展示
  - 文件：`src/commands/init.ts`
  - 验证：新项目无 config 时 init 仅装 7 个技能/指令；配置 3 项时仅装 3 项+注入补全

- [x] 3.2 [代码] `update.ts`：同 3.1 按 `resolveWorkflows` 过滤刷新，手改保护逻辑（`isFromEarlierVersion`）不变；`UpdateResult` 增加生效集来源标注
  - 文件：`src/commands/update.ts`
  - 验证：配置 3 项时 update 仅刷新 3 项+注入；非配置集内产物不刷新

- [x] 3.3 [代码] `init.ts` / `update.ts`：reconcile 扫描——遍历 `.claude/skills/` 与 `.claude/commands/venus/` 下已存在的 venus 产物，对不在生效集内的，保留不删，收集到 `reconcileOrphans: string[]`，在输出末尾列出提示"以下 N 个不在当前 workflows 配置中，保留未删：... 如需移除：venus uninstall 或手动删除"
  - 文件：`src/commands/init.ts`、`src/commands/update.ts`
  - 验证：预先装 14 个，配置缩为 7 后 init，提示列出遗留 7 个且文件仍在

## 4. config 命令

- [x] 4.1 [代码] `package.json`：新增 `@inquirer/prompts` 运行依赖（`dependencies`），`build.js` 打包包含
  - 文件：`package.json`、`build.js`
  - 验证：`npm install` 后 `import { checkbox } from '@inquirer/prompts'` 可用

- [x] 4.2 [代码] 新建 `src/commands/config.ts`：`runConfigInteractive(projectRoot)` 用 `@inquirer/prompts` 的 `checkbox` 展示全部 14 个 workflow（choices 来自 registry 的 workflowId 集合），默认勾选当前生效集，确认后写回 config.yaml 的 workflows 字段（总是写显式列表）；取消时输出"未修改"
  - 文件：`src/commands/config.ts`（新建）
  - 验证：mock inquirer 输入，确认后 config.yaml 含 workflows 字段；取消时文件不变；非 TTY 环境（`process.stdin.isTTY === false`，如 CI/管道）检测后降级输出"非交互环境，请用 venus config --set <list>"而不阻塞

- [x] 4.3 [代码] `config.ts`：`runConfigShow(projectRoot)` 打印 context/rules 摘要 + `resolveWorkflows` 生效集（标注来源 default/user + 注入项）；`runConfigSet(projectRoot, list)` 校验每个 id 合法（对照 registry 全部 workflowId）后写回 workflows 字段，非法 id 抛错退出非零
  - 文件：`src/commands/config.ts`
  - 验证：`runConfigSet` 合法列表写回成功；非法 id `foo-bar` 抛错且文件不变；`runConfigShow` 无 config 时输出"来源：默认集"

- [x] 4.4 [代码] `cli/index.ts`：注册 `config` 命令——无参数走交互式，`show` 子命令或 `--show` 走打印，`--set <list>` 走非交互设置
  - 文件：`src/cli/index.ts`
  - 验证：`venus config --set tr-init-project,spec-explore` 写回成功；`venus config show` 打印生效集

## 5. onboarding 适配

- [x] 5.1 [代码] `onboarding.ts`：`ONBOARDING_HINTS` 改为按生效 workflow 集动态过滤——只展示当前配置集内的 workflow 对应引导；默认集下展示 spec 核心 + tr-init-project 引导，非配置集的 tr_* 不展示（或标注"需 venus config 启用"）
  - 文件：`src/commands/onboarding.ts`
  - 验证：默认集下 onboarding 输出不含 tr-impl-feature 等；仅含默认集 workflow 引导

## 6. 测试

- [x] 6.1 [代码] profiles 单测：`resolveWorkflows` 默认集/用户配置/依赖注入（propose⇒verify-proposal, archive⇒verify, apply 不注入）全场景
  - 文件：`test/profiles.test.ts`（新建）
  - 验证：vitest 全绿

- [x] 6.2 [代码] registry 过滤单测：`getSkillTemplates`/`getCommandTemplates` 的 workflowFilter 参数过滤正确，与 typeFilter 正交叠加
  - 文件：`test/templates.test.ts`（扩展）
  - 验证：vitest 全绿

- [x] 6.3 [代码] project-config 单测：workflows 字段解析、缺失返回 undefined、defaultConfigFileContent 含默认集
  - 文件：`test/commands.test.ts`（扩展）或新建 `test/project-config-workflows.test.ts`
  - 验证：vitest 全绿

- [x] 6.4 [代码] init/update 过滤单测：默认集装 7 个、配置集装对应项、reconcile 遗留提示
  - 文件：`test/commands.test.ts`、`test/validate-update.test.ts`（扩展）
  - 验证：vitest 全绿

- [x] 6.5 [代码] config 命令单测：交互式 mock 写回、show 输出来源标注、--set 合法/非法
  - 文件：`test/config-command.test.ts`（新建）
  - 验证：vitest 全绿

- [x] 6.6 [代码] onboarding 单测：按生效集过滤 hint 输出
  - 文件：`test/commands.test.ts`（扩展）
  - 验证：vitest 全绿

- [x] 6.7 [代码] skills-parity 回归：14 个技能命名/类型/指令派生一致性不被 workflowId 挂载破坏
  - 文件：`test/skills-parity.test.ts`（扩展）
  - 验证：vitest 全绿

## 7. 文档

- [x] 7.1 [使用说明] profile 配置使用指南：workflows 字段用法、默认集说明、依赖注入规则、venus config 三模式、init/update 过滤与 reconcile 行为、从全量迁移说明
  - 产出：`attachments/profile-config-guide.md`
  - 验证：指南覆盖全部 7 项决策（D1-D7）+ BREAKING 迁移路径，含最小可用示例

- [x] 7.2 [使用说明] CHANGELOG 更新：标注 BREAKING（init 默认行为变化）+ 新增 config 命令 + 新依赖
  - 产出：`CHANGELOG.md`
  - 验证：含 BREAKING 条目与迁移说明
