/**
 * commit 类型技能模板：提交。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';

export function getCommitSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_commit',
        description: '提交变更。当用户要提交代码，需要检查变更、生成规范的提交信息并提交时使用；触发词"提交 / commit / git 提交 / 生成提交信息"；NOT for SVN 项目提交（改用 iagent_svn_commit）。',
        allowedTools: 'Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Read, Glob, Grep',
        type: 'commit',
        instructions: `提交变更 —— 提交前必须核对变更内容，提交信息必须符合规范。

**输入**：\`/iagent:commit\` 后可跟提交信息建议或说明（可省略，省略时自动生成后展示确认）。

## 执行步骤

1. **检查当前变更**

   \`\`\`bash
   git status
   git diff --stat
   \`\`\`
   - 列出修改/新增/删除的文件
   - **发现与本次任务无关的变更时明确指出，询问是拆分提交还是一并提交**
   - 发现临时文件、调试代码、含密钥的文件时提醒用户，禁止直接提交

2. **核对提交内容**

   \`\`\`bash
   git diff
   \`\`\`
   - 浏览关键 diff，确认无意外改动（格式化风暴、无关文件、误删）
   - 如项目有测试/lint 脚本，提醒用户先运行确认通过（用户明确跳过时尊重决定）

2.5 **提案制品纳入（Git 侧，与 SVN 侧分类提交对齐）**

   提交前同时检测两类候选：\`openspec/changes/\` 下的活跃变更，与 \`openspec/changes/archive/\` 下存在未提交制品的归档变更：

   - **0 个候选** → 退化为普通提交，MUST NOT 附加 \`提案:\` 尾行，MUST NOT 报错
   - **唯一候选** → 直接采用；归档候选 MUST 标注「已归档」
   - **≥2 个候选** → 列出候选（变更名 + 活跃/已归档 + schema）供用户选择；活跃与归档同名并存时 MUST 分别列出，MUST NOT 合并；MUST NOT 自行决定纳入哪一个
   - 归档提案仅部分制品未提交时只纳入未提交部分；无任何 VCS 变更的归档目录 MUST NOT 列为候选

   固定清单（仅这些路径，逐条精确暂存并逐条校验前缀 \`openspec/changes/<change-path>/\`；归档提案的 \`<change-path>\` 为 \`archive/YYYY-MM-DD-<name>\`）：

   - \`openspec/changes/<change-path>/proposal.md\`
   - \`design.md\` / \`tasks.md\` / \`exploration.md\` / \`.openspec.yaml\`
   - \`specs/**/*.md\`
   - **排除**：\`attachments/**\` 与 \`需求文档.md\`（附件与人工评审产物不入默认提交清单）
   - 不存在的条目跳过（不报错）；暂存失败（权限 / 路径不存在 / 未纳管）只记 WARN 并提示手动处理，MUST NOT 阻断代码提交，也 MUST NOT 静默把制品混入提交

   **溯源**：提交信息主体保持 Conventional Commits 一行式，另起**尾行** \`提案: <change-name>\`（与 \`iagent_svn_commit\` 完全同格式）；归档提案使用去掉日期前缀的变更名（\`2026-11-08-add-x\` → \`add-x\`），目录名不符合 \`YYYY-MM-DD-\` 前缀时原样使用。

3. **生成提交信息**

   遵循 Conventional Commits 规范（一行式）：
   \`\`\`text
   type(scope): subject
   \`\`\`
   - **type**：feat（新功能）/ fix（修复）/ docs（文档）/ style（格式）/ refactor（重构）/ test（测试）/ chore（构建/工具）
   - **scope**：影响的模块（可省略）
   - **subject**：祈使句、不加句号、50 字符内概括
   - **docs 类**：subject MUST 写明文档对象与内容变化，MUST NOT 只写「更新文档 / 修改文档 / 更新提案」等泛化表述；无明确对象时用文件路径或能力名兜底，仍无法确定时询问用户

   示例：\`feat(auth): 添加用户登录接口\` / \`docs(openspec): 更新告警接口规格与测试说明\`

4. **暂存并提交**

   - 优先精确暂存相关文件（\`git add <files>\`），而非无差别 \`git add -A\`
   - 提案制品按上一步固定清单精确暂存（幂等：已暂存则跳过）
   - 执行 \`git commit\`，向用户展示最终提交信息与结果（commit hash、文件数）；存在活跃变更时提交信息尾行为 \`提案: <change-name>\`

## 约束

- 提交是外向且不可轻易撤销的操作：首次执行前向用户展示将要提交的文件与提交信息，确认后再执行；本约束不因提案制品纳入而豁免
- **MUST NOT 使用 \`git add -A\` / \`git add openspec\` / \`git add openspec/changes\`**：暂存范围必须按固定清单逐条精确指定
- **MUST NOT 自动 commit**：确认前 MUST NOT 执行 \`git commit\`
- 一次提交只做一件事：混合了功能与修复时建议拆分
- 禁止提交：密钥、.env、构建产物、用户明确排除的文件`,
        license: 'MIT',
        compatibility: '需要 git 环境。',
        metadata: { author: 'mi-agent-tools' },
    };
}

export function getCommitCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 提交变更',
        description: '提交变更 —— 检查变更、生成规范提交信息并提交',
        category: 'iAgent / 提交',
        tags: ['iagent', 'commit', 'git', 'commit'],
        content: deriveCommandContent(getCommitSkillTemplate().instructions),
    };
}
