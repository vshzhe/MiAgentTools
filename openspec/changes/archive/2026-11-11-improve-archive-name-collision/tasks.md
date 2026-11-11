# Tasks: improve-archive-name-collision

## 1. 领域层：归档目标名唯一化

- [x] 1.1 [代码] 改造 `resolveTargetPath`：候选名被占用时追加 `-2`、`-3`… 直至不存在，尝试上限 99 次后抛错并给出最后候选路径；保留「变更名已含 `YYYY-MM-DD-` 前缀则不叠加日期」语义 [N5]
  - 文件：`src/core/spec/archive.ts`
  - 验证：目标已存在时返回带后缀路径；`-100` 全占用时抛错且源目录未移动
  - Spec Ref：spec-workflow-cli / 归档目标名冲突时确定性唯一化
  - Scenario Ref：目标已占用时追加数字后缀

- [x] 1.2 [代码] `executeArchive` 与 `previewArchive` 共用唯一化结果：移除「目标已存在即抛错」的提前返回，移动仍走 `moveDirectory`（rename → 复制删除回退）；仅探测存在性，不写不删既有归档目录 [N4] [N7]
  - 文件：`src/core/spec/archive.ts`
  - 验证：预览 `targetPath` 与执行 `archivedPath` 相等；既有归档目录 mtime/内容不变
  - Spec Ref：spec-workflow-cli / 归档目标名冲突时确定性唯一化
  - Scenario Ref：预览与执行目标一致

- [x] 1.3 [测试][单元][P0] 归档目标名冲突用例：目标未占用保持原名；`<今日>-<name>` 已存在 → `-2`；`-2` 也已存在 → `-3` [N5]
  - 文件：`test/spec-commands.test.ts`
  - 验证：`path.basename(result.archivedPath)` 断言三段路径
  - Spec Ref：spec-workflow-cli / 归档目标名冲突时确定性唯一化
  - Scenario Ref：目标未占用时保持既有命名
  - Scenario Ref：目标已占用时追加数字后缀

- [x] 1.4 [测试][单元][P1] 边界用例：自带日期前缀 + 冲突 → `-2`；`-2`…`-100` 全占用 → 抛错且源目录保留；既有候选目录内容不被改写 [N5]
  - 文件：`test/spec-commands.test.ts`
  - 验证：抛错信息含最后候选路径；冲突目录内文件 sha 不变
  - Spec Ref：spec-workflow-cli / 归档目标名冲突时确定性唯一化
  - Scenario Ref：变更名自带日期前缀时冲突仍可归档
  - Scenario Ref：唯一化尝试超限时报错
  - Scenario Ref：既有归档只读

- [x] 1.5 [测试][功能][P1] CLI 端到端：对同名变更连续归档两次，两次均成功且第二次落在 `-2` [N5]
  - 文件：`test/markdown-spec-cli.test.ts`
  - 验证：子进程执行 `node bin/iagent.js spec archive`（先 `pnpm build`），断言两个归档目录并存
  - Spec Ref：spec-workflow-cli / 归档目标名冲突时确定性唯一化
  - Scenario Ref：目标已占用时追加数字后缀

- [x] 1.6 [测试][单元][P1] 预览与执行目标一致：`previewArchive().targetPath` === `executeArchive().archivedPath`（含唯一化后缀） [N7]
  - 文件：`test/spec-commands.test.ts`
  - 验证：先制造冲突再断言两者相等
  - Spec Ref：spec-workflow-cli / 归档目标名冲突时确定性唯一化
  - Scenario Ref：预览与执行目标一致

## 2. spec-archive 技能协议

- [x] 2.1 [代码] Step 5「执行归档」改为以 CLI 报告的实际归档目录为事实来源：删除「目标已存在 → 报告错误 + 建议重命名/删除/换日期」分支与对应 Output 段（`Archive Failed`），改为说明同名冲突已由 CLI 唯一化 [N7]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 验证：模板正文不再含「重命名既有归档 / 删除重复 / 换日期」指引；含唯一化说明
  - Spec Ref：spec-workflow-skills / spec-archive 归档名冲突的唯一化报告
  - Scenario Ref：不再建议人工改名或删除

- [x] 2.2 [代码] Step 7 索引条目口径：「变更名称」取实际目录名去掉 `YYYY-MM-DD-` 前缀后的全段（含后缀）；模块提取前先剥离尾部 `-<数字>`；归档日期/月份仍取前 10 / 前 7 位 [N8] [N9]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 验证：正文含后缀保留与剥离规则，且月份判定不引用后缀
  - Spec Ref：spec-workflow-skills / spec-archive 归档名冲突的唯一化报告
  - Scenario Ref：同名二次归档成功
  - Scenario Ref：索引日期与月份仍取目录名前缀
  - Scenario Ref：模块提取先剥离唯一化后缀

- [x] 2.3 [代码] 输出摘要与实际路径一致（`Archived to: archive/YYYY-MM-DD-<name>[-N]/`），并在 Guardrails 增补「同名冲突不中止、不覆盖既有归档」[N12]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 验证：Output 段占位符允许可选 `-N` 后缀
  - Spec Ref：spec-workflow-skills / spec-archive 归档名冲突的唯一化报告
  - Scenario Ref：同名二次归档成功

- [x] 2.4 [测试][功能][P1] 模板契约断言：`spec-archive` 生成正文含唯一化与后缀剥离规则、不含旧「归档目标已存在即失败」指引；`spec archive` 命令未新增 `--strict` 选项 [N12]
  - 文件：`test/spec-workflow-contract.test.ts`
  - 验证：读取模板正文断言关键片段；CLI 帮助断言无 `--strict` / `--suffix`
  - Spec Ref：spec-workflow-cli / 归档目标名冲突时确定性唯一化
  - Spec Ref：spec-workflow-skills / spec-archive 归档名冲突的唯一化报告
  - Scenario Ref：spec-workflow-cli / 归档目标名冲突时确定性唯一化 / 既有归档只读
  - Scenario Ref：spec-workflow-skills / spec-archive 归档名冲突的唯一化报告 / 同名二次归档成功
  - Scenario Ref：spec-workflow-skills / spec-archive 归档名冲突的唯一化报告 / 索引日期与月份仍取目录名前缀
  - Scenario Ref：spec-workflow-skills / spec-archive 归档名冲突的唯一化报告 / 不再建议人工改名或删除
  - Scenario Ref：spec-workflow-skills / spec-archive 归档名冲突的唯一化报告 / 模块提取先剥离唯一化后缀


## 3. spec-bulk-archive 技能协议

- [x] 3.1 [代码] 单元 b)「执行归档」删除「目标已存在 → 标 Failed」分支：改为记录实际归档路径（含 `-2` / `-3`）并继续 b.5 → c → d；保留命名冲突以外的失败隔离 [N10]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：正文不再把「归档目录已存在」列为 Failed 示例
  - Spec Ref：spec-bulk-archive-skill / 三阶段分层并行归档执行
  - Scenario Ref：同名冲突不构成失败
  - Scenario Ref：失败隔离

- [x] 3.2 [代码] 批量索引条目口径：「变更名称」取前缀后全段（含后缀）；模块提取先剥离 `-<数字>`；成功/失败示例摘要同步 [N11]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：Step 10 c/d 与 Output 示例体现后缀口径
  - Spec Ref：spec-bulk-archive-skill / 唯一化后缀归档条目的一致记录
  - Scenario Ref：带后缀条目入索引
  - Scenario Ref：后缀不影响统计重算

- [x] 3.3 [测试][功能][P1] 模板契约断言：`spec-bulk-archive` 正文含「同名冲突不构成失败」与后缀命名口径，且不含 `Archive directory already exists` 失败示例 [N10] [N11]
  - 文件：`test/spec-workflow-contract.test.ts`
  - 验证：读取模板正文断言关键片段（含失败隔离与索引命名）
  - Spec Ref：spec-bulk-archive-skill / 三阶段分层并行归档执行
  - Spec Ref：spec-bulk-archive-skill / 唯一化后缀归档条目的一致记录
  - Scenario Ref：spec-bulk-archive-skill / 三阶段分层并行归档执行 / 同名冲突不构成失败
  - Scenario Ref：spec-bulk-archive-skill / 三阶段分层并行归档执行 / 失败隔离
  - Scenario Ref：spec-bulk-archive-skill / 唯一化后缀归档条目的一致记录 / 带后缀条目入索引
  - Scenario Ref：spec-bulk-archive-skill / 唯一化后缀归档条目的一致记录 / 后缀不影响统计重算


- [x] 3.4 [测试][功能][P2] 判定：并行组 / 串行链分组逻辑本次不修改，由既有协议文本承载；断言分组段落仍在（本次变更不改动，仅确认未被回归破坏） [N0]
  - 文件：`test/spec-workflow-contract.test.ts`
  - 验证：正文仍含「无共享 capability 的变更构成并行组」「共享同一 capability 的变更构成串行链」
  - Spec Ref：spec-bulk-archive-skill / 三阶段分层并行归档执行
  - Scenario Ref：并行组执行
  - Scenario Ref：串行链执行

## 4. 构建、回归与版本

- [x] 4.1 [代码] 刷新技能快照与指令产物：`pnpm build && pnpm generate:skills` [N12]
  - 文件：`skills/**`（生成物，不手改）
  - 验证：`test/skills-parity.test.ts` 通过
  - Spec Ref：spec-workflow-skills / spec-archive 归档名冲突的唯一化报告
  - Scenario Ref：不再建议人工改名或删除

- [x] 4.2 [测试][单元][P0] 全量回归：`pnpm test` + `pnpm lint` [N12]
  - 文件：`test/**`、`src/**`
  - 验证：全绿；改动面仅归档链相关文件
  - Spec Ref：spec-workflow-cli / 归档目标名冲突时确定性唯一化
  - Scenario Ref：目标已占用时追加数字后缀

- [x] 4.3 [代码] 版本号递增与 CHANGELOG：`node bin/iagent.js version bump`（按实现影响面判定，随功能一并提交）[N12]
  - 文件：`package.json`、`CHANGELOG.md`、`README.md`
  - 验证：`node bin/iagent.js version` 判定等级与写回一致
  - Spec Ref：spec-workflow-cli / 归档目标名冲突时确定性唯一化
  - Scenario Ref：目标已占用时追加数字后缀
