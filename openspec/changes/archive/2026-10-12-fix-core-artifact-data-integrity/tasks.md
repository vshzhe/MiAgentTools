# Tasks: fix-core-artifact-data-integrity

## A-数据安全

- [ ] [代码] 1.1 writeJsonFile 原子写入改造：JSON.stringify try-catch → 写 .tmp 临时文件 → 回读验证 JSON.parse → 备份 .bak → rename 原子替换；失败时清理 .tmp 保留原文件 [N14]
  - 依赖: 无
- [ ] [代码] 1.2 readChangeJson .bak 备份回退：主文件缺失或 JSON.parse 失败时自动从 .bak 恢复 [N17]
  - 依赖: 1.1
- [ ] [代码] 1.3 initChangeJson TOCTOU 修复：writeJsonFile 写入失败时重新读取 change.json 处理并发竞争 [N14]
  - 依赖: 1.1
- [ ] [测试][单元][P0] 1.4 原子写入单元测试：写入后验证内容完整、无残留 .tmp；JSON 损坏从 .bak 恢复；备份失败不阻断写入；initChangeJson 并发保护；循环引用序列化异常不落盘
  - 依赖: 1.1, 1.2, 1.3

## B-命令保护

- [ ] [代码] 2.1 ToolCommandAdapter 接口修改：formatFile 增加 optional fingerprintPlaceholder 参数；GeneratedCommand 新增 fingerprintPlaceholder 字段 [N6]
  - 依赖: 无
- [ ] [代码] 2.2 generateCommand 改为两趟拼装：第一趟空占位生成全文，第二趟计算 SHA256 回填指纹行（对齐 generateSkillContent 模式） [N6]
  - 依赖: 2.1
- [ ] [代码] 2.3 fingerprint.ts 正则兼容：FINGERPRINT_LINE_RE / FINGERPRINT_VALUE_RE 扩展匹配 0 空格缩进格式（command frontmatter） [N6]
  - 依赖: 无
- [ ] [代码] 2.4 update.ts 指令循环 6 路判定：文件不存在→安装、内容相同→跳过、isUnmodified→升级、isLegacyVersionMismatched→升级、--force→覆盖、用户手改→跳过；UpdateResult 新增 commandsSkippedModified 字段 [N7]
  - 依赖: 2.2, 2.3
- [ ] [代码] 2.5 init.ts 指令写入附带指纹：指令写入时注入 generatedFingerprint 字段，保持现有文件存在性判定不变 [N6]
  - 依赖: 2.2
- [ ] [测试][单元][P0] 2.6 Commands 更新测试：指纹自洽升级覆盖、用户手改跳过保护、--force 覆盖、内容相同幂等、文件不存在安装、存量无指纹版本号不一致升级
  - 依赖: 2.4, 2.5

## C-模板约束

- [ ] [代码] 3.1 spec-propose.ts 模板第 3 节 Bash 命令修正：venus spec render <type> 改为仅 venus spec render tasks；失败处置段明确 proposal/specs/design MUST NOT 手写 MD [N12]
  - 依赖: 无
- [ ] [代码] 3.2 artifact-generation.md Step G2.5 同步强化 proposal/specs/design MUST NOT 渲染 MD 的约束 [N12]
  - 依赖: 3.1
- [ ] [代码] 3.3 spec.ts render 命令非 tasks 类型输出非阻断提示（告知 JSON 才是真源） [N12]
  - 依赖: 无

## D-收尾

- [ ] [代码] 4.1 skills/ 快照重新生成：pnpm build && pnpm generate:skills 确保模板变更写入技能快照
  - 依赖: 3.1
- [ ] [代码] 4.2 全量测试回归：pnpm test 确保所有 71 个用例通过（skills-parity / allowed-tools / template-derivation / sidecar-writer 等）
  - 依赖: 1.4, 2.6, 4.1
- [ ] [代码] 4.3 版本号与 CHANGELOG 更新：按 minor 递增（功能修正），写 CHANGELOG 条目
  - 依赖: 4.2

> 进度: 0/16 (0%)