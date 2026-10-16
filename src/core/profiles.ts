/**
 * Profile 系统：默认 workflow 集与依赖注入。
 *
 * 决定 WHICH workflow 被安装（与 rules 字段正交：rules 管规则注入按 SkillType，
 * workflows 管装哪些按 workflowId）：
 *   - DEFAULT_WORKFLOWS：未配置 workflows 字段时的默认集（8 项）
 *   - DEPS：依赖注入规则表（用户漏选某 workflow 时自动补全其依赖）
 *   - resolveWorkflows：解析生效集（默认集或用户配置 + 依赖注入补全）
 *
 * workflow id = deriveCommandId(技能名)（iagent_<type>_<name> → <type>-<name>），
 * 与 registry 中 commandId 派生规则一致，故 workflowFilter 过滤即按 commandId 匹配。
 */

/** 默认 workflow 集（未配置 workflows 字段时生效）。
 *  project-init（项目起步必需）+ spec 全 6（规格驱动闭环）
 *  + test（多 schema 测试生成：Java/Node 自动适配）。 */
export const DEFAULT_WORKFLOWS: readonly string[] = [
    'project-init',
    'test',
    'spec-explore',
    'spec-propose',
    'spec-apply',
    'spec-archive',
    'spec-verify',
    'spec-verify-proposal',
];

/** 依赖注入规则表：key 依赖 value（用户选了 key 但漏了 value 时自动补全 value）。
 *  - spec-propose ⇒ spec-verify-proposal（规则文件：提案实现前必须通过评分门）
 *  - spec-archive / spec-bulk-archive ⇒ spec-verify + requirement-doc
 *    （spec-verify：实现完成后、归档前验证；requirement-doc：预归档需求文档生成检查点
 *    经 Skill 工具委派该技能，被委派技能必须可得 —— 与 spec-propose ⇒ spec-verify-proposal 同构）
 *  - 默认集后果：DEFAULT_WORKFLOWS 显式项仍为 8，但 spec-archive 在集内且依赖 requirement-doc，
 *    故未配置 workflows 时实际安装 9 项（8 显式 + 1 注入）
 *  - migration ⇒ feature-doc + migration-check
 *    （编排技能 Phase 1 源项目扫描与 Phase 4 迁移检查依赖两子技能）
 *  - workflow ⇒ spec-verify-proposal + proposal-review + spec-apply + spec-archive
 *    （一站式引导工作流：内联探索/提案/验证，验证阶段委派 spec-verify-proposal 评分门与
 *     proposal-review 深度复查；验证通过后委派 spec-apply 实现、spec-archive 归档；
 *     requirement-doc 由 spec-archive 传递注入，不在此重复列出）
 *  - auto-workflow ⇒ workflow + requirement-doc
 *    （Phase 1-3 与引导工作流同构；Phase 5 内联执行归档步骤，其中包含需求文档生成检查点，仍委派该技能）
 *  - debug ⇒ spec-verify-proposal
 *    （P7 验证调用；需求文档不在 debug 范围内，故不再注入该技能）
 *  - spec-apply 不注入（apply 时假设 propose 阶段已过评分门，避免冗余） */
export const DEPS: Record<string, readonly string[]> = {
    'spec-propose': ['spec-verify-proposal'],
    'spec-archive': ['spec-verify', 'requirement-doc'],
    'spec-bulk-archive': ['spec-verify', 'requirement-doc'],
    'migration': ['feature-doc', 'migration-check'],
    'workflow': ['spec-verify-proposal', 'proposal-review', 'spec-apply', 'spec-archive'],
    'auto-workflow': ['workflow', 'requirement-doc'],
    'debug': ['spec-verify-proposal'],
};

/** resolveWorkflows 结果 */
export interface ResolvedWorkflows {
    /** 生效 workflow 集合（用户配置/默认集 + 注入补全项，注入项在后） */
    workflows: string[];
    /** 本次自动注入补全的 workflow（供输出提示用户） */
    injected: string[];
}

/**
 * 解析生效 workflow 集（依赖注入为不动点迭代：连带补全传递依赖）。
 *
 * 例：仅勾选 auto-workflow → 注入 workflow 与 requirement-doc，
 * 其中 workflow 自身的依赖（proposal-review）在下一轮迭代中继续补全。
 *
 * @param workflows - 用户配置的 workflow 列表；undefined/空 → 用默认集
 * @returns 生效集 + 注入补全项标注
 */
export function resolveWorkflows(workflows?: readonly string[]): ResolvedWorkflows {
    const base = workflows && workflows.length > 0 ? [...workflows] : [...DEFAULT_WORKFLOWS];
    const injected: string[] = [];
    const set = new Set(base);

    // 不动点迭代：新注入的依赖若自身也有依赖，继续连带补全（DEPS 无环，循环必然终止）
    let changed = true;
    while (changed) {
        changed = false;
        for (const [wf, deps] of Object.entries(DEPS)) {
            if (set.has(wf)) {
                for (const dep of deps) {
                    if (!set.has(dep)) {
                        set.add(dep);
                        injected.push(dep);
                        changed = true;
                    }
                }
            }
        }
    }

    return { workflows: [...base, ...injected], injected };
}
