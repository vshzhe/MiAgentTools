/**
 * tr_tools 类型技能模板：工具。
 * 含 venus_tools_pwd（查看当前路径，项目首个验收示例技能）与 venus_tools_list。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

export function getTrToolsPwdSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_tr_tools_pwd',
        description: '查看当前路径。当用户询问当前目录在哪、需要确认工作目录的绝对路径时使用。',
        allowedTools: 'Bash(pwd:*), Bash(pwd), Bash(echo %CD%:*), Bash(echo %CD%), Read, Glob',
        type: 'tr_tools',
        instructions: `查看当前路径 —— 给出当前工作目录的绝对路径。

## 执行步骤

1. **获取当前工作目录**

   优先运行跨 shell 通用的命令：
   \`\`\`bash
   pwd
   \`\`\`
   Git Bash / macOS / Linux 环境下直接生效。

   如果 pwd 不可用（如纯 Windows cmd），按环境选择兜底命令：
   - PowerShell：\`Get-Location\`
   - cmd：\`echo %CD%\`

2. **展示结果**

   以清晰的格式向用户呈现：
   \`\`\`text
   当前工作目录：
   <实际路径（pwd / Get-Location 返回的值）>
   \`\`\`

3. **（可选）补充上下文**

   如果用户是在问"我们在哪"的语境下询问，可顺带说明该路径下的关键标志文件
   （package.json / pom.xml / .git 等），帮助用户确认项目身份。

## 约束

- 只做只读操作，不切换目录、不修改任何文件
- 始终报告命令实际返回的路径，不做推断`,
        license: 'MIT',
        compatibility: '无特殊依赖，通用环境可用。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getTrToolsPwdCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 查看当前路径',
        description: '查看当前路径 —— 显示当前工作目录的绝对路径',
        category: 'Venus / 工具',
        tags: ['venus', 'tr_tools', 'pwd', 'path'],
        content: `查看当前路径 —— 给出当前工作目录的绝对路径。

## 执行步骤

1. **获取当前工作目录**：优先 \`pwd\`（Git Bash / macOS / Linux 通用）；不可用时按 shell 兜底 —— PowerShell 用 \`Get-Location\`，cmd 用 \`echo %CD%\`。
2. **展示结果**：以清晰格式呈现绝对路径。
3. **（可选）补充上下文**：顺带说明路径下的关键标志文件（package.json / .git 等）。

## 约束

- 只做只读操作，不切换目录、不修改任何文件
- 始终报告命令实际返回的路径，不做推断`,
    };
}

export function getTrToolsListSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_tr_tools_list',
        description: '列出可用技能。当用户想了解当前环境有哪些 venus 技能及其分类时使用。',
        allowedTools: 'Bash(venus:*), Bash(venus), Read, Glob',
        type: 'tr_tools',
        instructions: `列出可用技能 —— 展示已安装的 venus 技能与分类体系。

## 执行步骤

1. **运行列表命令**

   \`\`\`bash
   venus list
   \`\`\`
   如需结构化数据（供程序处理）：
   \`\`\`bash
   venus list --json
   \`\`\`

2. **展示结果**

   按 7 类生命周期分组呈现：
   \`\`\`text
   tr_init    初始化   venus_init_project
   tr_impl    实现     venus_impl_feature
   tr_test    测试     venus_test_generate
   tr_commit  提交     venus_commit_change
   tr_review  审查     venus_review_code
   tr_release 版本     venus_release_version
   tr_tools   工具     venus_tools_pwd, venus_tools_list
   \`\`\`

3. **（可选）说明用法**

   如用户在探索可用能力，补充说明：
   - 每个技能对应的斜杠指令形式（如 \`/venus:tools-pwd\`）
   - 如何用 \`venus generate --type <type> --name <name>\` 生成新技能

## 约束

- 只做只读操作
- 输出以命令实际返回为准，不凭记忆罗列`,
        license: 'MIT',
        compatibility: '需要 venus CLI。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getTrToolsListCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 列出技能',
        description: '列出可用技能 —— 展示已安装的 venus 技能与分类体系',
        category: 'Venus / 工具',
        tags: ['venus', 'tr_tools', 'list', 'skills'],
        content: `列出可用技能 —— 展示已安装的 venus 技能与分类体系。

## 执行步骤

1. **运行列表命令**：\`venus list\`（结构化数据用 \`venus list --json\`）。
2. **展示结果**：按 7 类生命周期分组（tr_init 初始化 / tr_impl 实现 / tr_test 测试 / tr_commit 提交 / tr_review 审查 / tr_release 版本 / tr_tools 工具）。
3. **（可选）说明用法**：各技能对应的斜杠指令形式，及 \`venus generate --type <type> --name <name>\` 生成新技能的方法。

## 约束

- 只做只读操作
- 输出以命令实际返回为准，不凭记忆罗列`,
    };
}
