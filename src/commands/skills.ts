/**
 * iagent skills 命令：枚举项目技能（`.iagent/config.yaml` 的 `skills:` 段）。
 *
 * 只读：解析配置条目、路径（`.iagent` 优先 → 宿主技能目录回退）、
 * frontmatter 与完整性校验（`validation`）。供探索 / 实现阶段的技能基线消费。
 */

import { Command } from 'commander';
import {
    collectProjectSkills,
    renderSkillsText,
} from '../core/project-skills.js';

export type { ProjectSkillsOutput } from '../core/project-skills.js';

/** 构造 skills 子命令。 */
export function buildSkillsCommand(): Command {
    return new Command('skills')
        .description('枚举项目技能（.iagent/config.yaml 的 skills 段）并校验完整性')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((options: { json?: boolean }) => {
            const output = collectProjectSkills(process.cwd());
            console.log(
                options.json === true ? JSON.stringify(output, null, 2) : renderSkillsText(output)
            );
        });
}
