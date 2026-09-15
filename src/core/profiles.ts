/**
 * Profile 系统：默认 workflow 集与依赖注入。
 *
 * 决定 WHICH workflow 被安装（与 rules 字段正交：rules 管规则注入按 SkillType，
 * workflows 管装哪些按 workflowId）：
 *   - DEFAULT_WORKFLOWS：未配置 workflows 字段时的默认集（7 项）
 *   - DEPS：依赖注入规则表（用户漏选某 workflow 时自动补全其依赖）
 *   - resolveWorkflows：解析生效集（默认集或用户配置 + 依赖注入补全）
 *
 * workflow id = deriveCommandId(技能名)（venus_<type>_<name> → <type>-<name>），
 * 与 registry 中 commandId 派生规则一致，故 workflowFilter 过滤即按 commandId 匹配。
 */

/** 默认 workflow 集（未配置 workflows 字段时生效）。
 *  tr-init-project（项目起步必需）+ spec 全 6（规格驱动闭环）
 *  + tr-test-generate（通用测试生成）+ tr-test-gentest-java（Java 单元测试）。 */
export const DEFAULT_WORKFLOWS: readonly string[] = [
    'tr-init-project',
    'tr-test-generate',
    'tr-test-gentest-java',
    'spec-explore',
    'spec-propose',
    'spec-apply',
    'spec-archive',
    'spec-verify',
    'spec-verify-proposal',
];

/** 依赖注入规则表：key 依赖 value（用户选了 key 但漏了 value 时自动补全 value）。
 *  - spec-propose ⇒ spec-verify-proposal（规则文件：提案实现前必须通过评分门）
 *  - spec-archive / spec-bulk-archive ⇒ spec-verify（verify 职责：实现完成后、归档前验证）
 *  - tr-impl-auto-migration ⇒ tr-docs-feature-doc + tr-impl-migration-check
 *    （编排技能 Phase 1 源项目扫描与 Phase 4 迁移检查依赖两子技能）
 *  - tr-impl-workflow ⇒ tr-impl-review-proposal + tr-docs-requirement-doc
 *    （验证 PASS 后深度复查与需求文档生成依赖两技能）
 *  - tr-impl-auto-workflow ⇒ tr-impl-workflow + tr-docs-requirement-doc
 *    （Phase 1-3 与引导工作流同构，Phase 3.3 生成需求文档）
 *  - tr-impl-genfull ⇒ spec-explore + spec-propose + spec-apply + spec-archive
 *    + tr-impl-frontend + tr-test-gentest-java + tr-impl-review-proposal + tr-docs-requirement-doc
 *    （引导式全流程编排：委派 8 个阶段技能；spec-verify-proposal 由 spec-propose 传递注入，
 *    spec-verify 由 spec-archive 传递注入，不在此重复列出）
 *  - tr-impl-debug ⇒ tr-docs-requirement-doc + spec-verify-proposal
 *    （P7 验证调用两技能）
 *  - spec-apply 不注入（apply 时假设 propose 阶段已过评分门，避免冗余） */
export const DEPS: Record<string, readonly string[]> = {
    'spec-propose': ['spec-verify-proposal'],
    'spec-archive': ['spec-verify'],
    'spec-bulk-archive': ['spec-verify'],
    'tr-impl-auto-migration': ['tr-docs-feature-doc', 'tr-impl-migration-check'],
    'tr-impl-workflow': ['tr-impl-review-proposal', 'tr-docs-requirement-doc'],
    'tr-impl-auto-workflow': ['tr-impl-workflow', 'tr-docs-requirement-doc'],
    'tr-impl-genfull': [
        'spec-explore',
        'spec-propose',
        'spec-apply',
        'spec-archive',
        'tr-impl-frontend',
        'tr-test-gentest-java',
        'tr-impl-review-proposal',
        'tr-docs-requirement-doc',
    ],
    'tr-impl-debug': ['tr-docs-requirement-doc', 'spec-verify-proposal'],
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
 * 例：仅勾选 tr-impl-auto-workflow → 注入 tr-impl-workflow 与 tr-docs-requirement-doc，
 * 其中 tr-impl-workflow 自身的依赖（tr-impl-review-proposal）在下一轮迭代中继续补全。
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
