/**
 * commit 类型技能模板：提交。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

export function getCommitSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_commit',
        description: '提交变更。当用户要提交代码，需要检查变更、生成规范的提交信息并提交时使用。',
        allowedTools: 'Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Read, Glob, Grep',
        type: 'commit',
        instructions: `提交变更 —— 提交前必须核对变更内容，提交信息必须符合规范。

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

3. **生成提交信息**

   遵循 Conventional Commits 规范（一行式）：
   \`\`\`text
   type(scope): subject
   \`\`\`
   - **type**：feat（新功能）/ fix（修复）/ docs（文档）/ style（格式）/ refactor（重构）/ test（测试）/ chore（构建/工具）
   - **scope**：影响的模块（可省略）
   - **subject**：祈使句、不加句号、50 字符内概括

   示例：\`feat(auth): 添加用户登录接口\`

4. **暂存并提交**

   - 优先精确暂存相关文件（\`git add <files>\`），而非无差别 \`git add -A\`
   - 执行 \`git commit\`，向用户展示最终提交信息与结果（commit hash、文件数）

## 约束

- 提交是外向且不可轻易撤销的操作：首次执行前向用户展示将要提交的文件与提交信息，确认后再执行
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
        content: `提交变更 —— 提交前必须核对变更内容，提交信息必须符合规范。

**输入**：\`/iagent:commit\` 后可跟提交信息建议或说明（可省略，省略时自动生成后展示确认）。

## 执行步骤

1. **检查当前变更**：\`git status\` + \`git diff --stat\`；无关变更、临时文件、疑似密钥必须先提醒。
2. **核对提交内容**：浏览 diff 确认无意外改动；提醒先跑测试/lint（用户明确跳过时尊重决定）。
3. **生成提交信息**：Conventional Commits 一行式 \`type(scope): subject\`，如 \`feat(auth): 添加用户登录接口\`。
4. **暂存并提交**：精确暂存相关文件，展示最终提交信息与结果。

## 约束

- 首次执行前展示将提交的文件与提交信息，确认后再执行
- 一次提交只做一件事，混合变更建议拆分
- 禁止提交密钥、.env、构建产物、用户明确排除的文件`,
    };
}
