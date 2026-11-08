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
 *  - spec-archive / spec-bulk-archive ⇒ spec-verify
 *    （spec-verify：实现完成后、归档前验证。归档侧已删除需求文档相关逻辑，
 *     正文不再委派 `iagent_requirement_doc`，故 MUST NOT 注入）
 *  - 默认集后果：DEFAULT_WORKFLOWS 8 项自身无注入项 ⇒ 默认安装集为 8 项
 *  - migration ⇒ feature-doc + migration-check
 *    （编排技能 Phase 1 源项目扫描与 Phase 4 迁移检查依赖两子技能）
 *  - workflow ⇒ spec-explore + spec-propose + spec-verify-proposal + proposal-review
 *    + spec-apply + spec-archive
 *    （一站式引导工作流：内联探索/提案/验证，验证阶段委派 spec-verify-proposal 评分门与
 *     proposal-review 深度复查；验证通过后委派 spec-apply 实现、spec-archive 归档；
 *     spec-verify 由 spec-archive 传递注入。requirement-doc 不再自动注入 —— 需求文档
 *     只由独立技能按需生成，用户须显式在 workflows 中选择安装）
 *  - auto-workflow ⇒ spec-explore + spec-propose + spec-verify-proposal + proposal-review
 *    + spec-apply + spec-archive
 *    （Phase 1-3 与引导工作流同构；Phase 4/5 委派 spec-apply / spec-archive；
 *     spec-verify 由 spec-archive 传递注入；requirement-doc 同上不再自动注入。
 *     auto-workflow 不委派 workflow 技能，故不再注入 workflow）
 *  - debug ⇒ spec-verify-proposal
 *    （P7 验证调用；需求文档桥已整体移除，不再注入 requirement-doc。
 *     `test` 属条件委派且正文已声明缺省降级路径，不触发注入）
 *  - spec-apply ⇒ test
 *    （`[测试]` 任务**无条件委派** `iagent_test` 生成测试代码；缺该技能会形成死引用，
 *     故随装补全。设计确认门由父流程实现桥或 apply 自身承载，不注入其他技能） */
export const DEPS: Record<string, readonly string[]> = {
    'spec-propose': ['spec-verify-proposal'],
    'spec-apply': ['test'],
    'spec-archive': ['spec-verify'],
    'spec-bulk-archive': ['spec-verify'],
    'migration': ['feature-doc', 'migration-check'],
    'workflow': ['spec-explore', 'spec-propose', 'spec-verify-proposal', 'proposal-review', 'spec-apply', 'spec-archive'],
    'auto-workflow': ['spec-explore', 'spec-propose', 'spec-verify-proposal', 'proposal-review', 'spec-apply', 'spec-archive'],
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
 * 例：仅勾选 auto-workflow → 注入 spec-explore / spec-propose / spec-verify-proposal /
 * proposal-review / spec-apply / spec-archive，其中 spec-archive 自身的依赖（spec-verify）
 * 在下一轮迭代中继续补全。
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
