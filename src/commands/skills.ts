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
    type ProjectSkillFilter,
} from '../core/project-skills.js';

export type { ProjectSkillsOutput } from '../core/project-skills.js';

/** 合法阶段值 */
const SKILL_PHASES = ['design', 'implement'] as const;
/** 合法范围值 */
const SKILL_SCOPES = ['backend', 'frontend'] as const;

/** 构造 skills 子命令。 */
export function buildSkillsCommand(): Command {
    return new Command('skills')
        .description('枚举项目技能（.iagent/config.yaml 的 skills 段）并校验完整性')
        .option('--json', '以 JSON 输出（供程序处理）')
        .option('--phase <phase>', `按阶段筛选（合法值：${SKILL_PHASES.join(' / ')}）`)
        .option('--scope <scope>', `按范围筛选（合法值：${SKILL_SCOPES.join(' / ')}）`)
        .action((options: { json?: boolean; phase?: string; scope?: string }) => {
            const filter: ProjectSkillFilter = {};
            if (options.phase !== undefined) {
                if (!(SKILL_PHASES as readonly string[]).includes(options.phase)) {
                    console.error(`未知的阶段：${options.phase}（合法值：${SKILL_PHASES.join(' / ')}）`);
                    process.exitCode = 1;
                    return;
                }
                filter.phase = options.phase as ProjectSkillFilter['phase'];
            }
            if (options.scope !== undefined) {
                if (!(SKILL_SCOPES as readonly string[]).includes(options.scope)) {
                    console.error(`未知的范围：${options.scope}（合法值：${SKILL_SCOPES.join(' / ')}）`);
                    process.exitCode = 1;
                    return;
                }
                filter.scope = options.scope as ProjectSkillFilter['scope'];
            }
            const output = collectProjectSkills(process.cwd(), undefined, filter);
            console.log(
                options.json === true ? JSON.stringify(output, null, 2) : renderSkillsText(output)
            );
        });
}
