/**
 * 指令形态的 references 路径重写（变更 fix-skill-contract-drift / D4）。
 *
 * 技能产物把参考文件写到 `<skillsDir>/skills/<skillId>/references/`，而指令产物
 * 是单文件（`.claude/commands/...` / `.pi/prompts/...`），没有同名 references 目录。
 * 指令正文中的 `references/<file>` 因此在指令形态不可达。
 *
 * 本模块在生成期把裸相对路径重写为配对技能目录下的项目相对路径；
 * 技能形态保持原样（其相对路径本就相对技能目录）。
 */

import { AI_TOOLS } from '../config.js';
import { deriveSkillId } from '../skill-id.js';

/** 由工具 id 与指令 id 派生技能 references 目录（项目相对、正斜杠）；无指令布局时返回 null */
export function skillReferencesBasePath(toolId: string, commandId: string): string | null {
    const tool = AI_TOOLS.find((item) => item.value === toolId);
    // skills-only（如 codex）没有指令产物，无需重写
    if (!tool || tool.commandsDir === '') {
        return null;
    }
    const skillId = deriveSkillId(`iagent_${commandId.replaceAll('-', '_')}`);
    const skillsDir = tool.skillsDir.replaceAll('\\', '/');
    return `${skillsDir}/skills/${skillId}/references`;
}

/**
 * 把正文中的裸 `references/<file>.md` 重写为 `basePath/<file>.md`。
 *
 * 幂等：已带目录前缀（前一个字符为 `/`、`.`、`-` 或单词字符）的路径不再重复替换。
 */
export function rewriteReferencePaths(content: string, basePath: string | null): string {
    if (basePath === null) {
        return content;
    }
    return content.replace(
        /(^|[^\w./-])references\/([A-Za-z0-9._-]+\.md)/g,
        (_match, prefix: string, file: string) => `${prefix}${basePath}/${file}`
    );
}
