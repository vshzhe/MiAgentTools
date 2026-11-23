## ADDED Requirements

### Requirement: Git 分支执行（幂等与冲突不抛错）

系统 SHALL 在 `src/core/git-capability.ts` 提供以下分支执行函数，全部接受注入的 `GitCommandRunner`：

| 函数 | 语义 |
| :--- | :--- |
| `isWorkingTreeClean(dir, runner?)` | `git status --porcelain` 只读判定 `{ clean, dirty[], reason? }` |
| `createWorkBranch(options)` | 幂等创建并切换工作分支；记录 `baseBranch`；拒绝非法分支名 |
| `mergeWorkBranch(options)` | `git merge --no-ff`；冲突返回清单且 MUST NOT abort |
| `deleteMergedBranch(options)` | `git branch -d`（非 `-D`）；未合并返回 `skipped` |

**检测仍纯只读**：既有 `detectGit` / `isGitRepository` / `findParentRepository` / `probeInstallers` 的签名与语义 MUST NOT 改变。

函数级细则（参数、返回值、冲突列表来源、分支名校验字符集）见新增能力 `git-branch-capability`。

#### Scenario: 既有检测函数签名不变

- **WHEN** 审阅 `git-capability.ts` 的导出
- **THEN** 四个既有检测函数的签名与返回值 SHALL 保持不变，既有 `test/git-capability.test.ts` MUST NOT 需修改

#### Scenario: 分支函数经注入 runner 执行

- **WHEN** 以 mock runner 调用任一分支执行函数
- **THEN** SHALL 不产生真实进程，且所有写操作 SHALL 经 runner 完成
