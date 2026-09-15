/**
 * init 完成后的 onboarding 提示。
 *
 * 按生效 workflow 集过滤，只展示当前配置集内的引导（默认集=7 项）。
 * 提示是有状态的：.venus/config.yaml 存在（说明已 init 过）时不重复打扰，
 * 可用 --onboarding 强制再次展示。
 */

import { DEFAULT_WORKFLOWS } from '../core/profiles.js';

/** 引导入口：workflowId 用于按生效集过滤 */
interface OnboardingHint {
    workflowId: string;
    name: string;
    command: string;
    hint: string;
}

/** 全部 workflow 的引导（顺序即展示顺序，默认集 7 个在前） */
const ONBOARDING_HINTS: OnboardingHint[] = [
    {
        workflowId: 'tr-init-project',
        name: '初始化项目',
        command: '/venus:tr-init-project',
        hint: '搭建新项目骨架：目录结构、配置文件、开发环境',
    },
    {
        workflowId: 'spec-explore',
        name: '探索',
        command: '/venus:spec-explore <话题>',
        hint: '变更前思考、调研代码库、明确需求',
    },
    {
        workflowId: 'spec-propose',
        name: '提案',
        command: '/venus:spec-propose <变更名>',
        hint: '一步生成 proposal/design/specs/tasks 提案制品',
    },
    {
        workflowId: 'spec-apply',
        name: '实现',
        command: '/venus:spec-apply <变更名>',
        hint: '按任务清单实现代码，设计确认后执行',
    },
    {
        workflowId: 'spec-verify',
        name: '验证',
        command: '/venus:spec-verify <变更名>',
        hint: '实现完成后、归档前验证与变更制品一致',
    },
    {
        workflowId: 'spec-archive',
        name: '归档',
        command: '/venus:spec-archive <变更名>',
        hint: '归档已实现的变更并同步主规格',
    },
    {
        workflowId: 'spec-verify-proposal',
        name: '提案评分门',
        command: '/venus:spec-verify-proposal <变更名>',
        hint: '提案生成后、实现前做量化评分（阈值 90%）',
    },
    {
        workflowId: 'tr-test-generate',
        name: '生成测试',
        command: '/venus:tr-test-generate <被测目标>',
        hint: '为代码补充结构化测试：BCDE 场景矩阵、AAA 结构、框架自动检测',
    },
    {
        workflowId: 'tr-test-gentest-java',
        name: 'Java 测试',
        command: '/venus:tr-test-gentest-java <被测类>',
        hint: 'Java 项目单元测试：框架检测、BCDE 场景矩阵、多模板生成、运行验证',
    },
    // 非默认 workflow（需 venus config 启用后才在提示中出现）
    {
        workflowId: 'tr-impl-feature',
        name: '实现功能',
        command: '/venus:tr-impl-feature <功能描述>',
        hint: '描述想做的功能，按分层架构规范实现',
    },
    {
        workflowId: 'tr-commit-change',
        name: '提交变更',
        command: '/venus:tr-commit-change',
        hint: '提交前自动检查变更并生成规范提交信息',
    },
    {
        workflowId: 'tr-review-code',
        name: '审查代码',
        command: '/venus:tr-review-code',
        hint: '默认审查未提交变更，输出分级审查报告',
    },
    {
        workflowId: 'tr-impl-frontend',
        name: '前端页面设计与生成',
        command: '/venus:tr-impl-frontend <页面需求>',
        hint: 'Venus4A 前端 JSP 页面设计决策 + 代码模板生成，涵盖 zTree/select2/layui/ECharts 等组件',
    },
    {
        workflowId: 'tr-release-version',
        name: '发布版本',
        command: '/venus:tr-release-version patch',
        hint: '整理变更日志并按 SemVer 建议版本号',
    },
    {
        workflowId: 'tr-tools-pwd',
        name: '查看当前路径',
        command: '/venus:tr-tools-pwd',
        hint: '问"当前目录是什么"，最简单的技能上手',
    },
    {
        workflowId: 'tr-tools-list',
        name: '列出技能',
        command: '/venus:tr-tools-list',
        hint: '查看已安装的 venus 技能分类',
    },
];

/**
 * 渲染 onboarding 提示块，按生效 workflow 集过滤。
 *
 * @param workflows - 生效 workflow id 集；未传用默认集
 */
export function renderOnboardingHints(workflows?: readonly string[]): string {
    const set = new Set(workflows ?? DEFAULT_WORKFLOWS);
    const hints = ONBOARDING_HINTS.filter((h) => set.has(h.workflowId));
    const lines: string[] = [
        '',
        '═══════════════════════════════════════════════════════',
        '  下一步：在 Claude Code 中试试这些指令',
        '═══════════════════════════════════════════════════════',
        '',
    ];
    for (const item of hints) {
        lines.push(`  ${item.command}`);
        lines.push(`    ${item.hint}`);
        lines.push('');
    }
    lines.push('  也可以直接用自然语言提问，Claude 会自动匹配技能。');
    lines.push('  查看全部：venus list');
    lines.push('  调整指令集：venus config');
    lines.push('');
    return lines.join('\n');
}
