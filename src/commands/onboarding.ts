/**
 * init 完成后的 onboarding 提示。
 *
 * 按生命周期顺序输出"下一步试试"引导，帮助用户从安装平滑过渡到使用。
 * 提示是有状态的：venus.config.yaml 存在（说明已 init 过）时不重复打扰，
 * 可用 --onboarding 强制再次展示。
 */

/** 生命周期顺序的引导入口（与技能分类体系一致） */
const ONBOARDING_HINTS: { type: string; name: string; command: string; hint: string }[] = [
    {
        type: 'tr_tools',
        name: '查看当前路径',
        command: '/venus:tools-pwd',
        hint: '在 Claude Code 中试试最简单的技能：问"当前目录是什么"',
    },
    {
        type: 'tr_impl',
        name: '实现功能',
        command: '/venus:impl-feature <功能描述>',
        hint: '描述一个想做的功能，按分层架构规范实现',
    },
    {
        type: 'tr_test',
        name: '生成测试',
        command: '/venus:test-generate <被测目标>',
        hint: '为刚写的代码补测试：先写用例，再让它通过',
    },
    {
        type: 'tr_commit',
        name: '提交变更',
        command: '/venus:commit-change',
        hint: '提交前自动检查变更并生成规范提交信息',
    },
    {
        type: 'tr_review',
        name: '审查代码',
        command: '/venus:review-code',
        hint: '默认审查未提交变更，输出分级审查报告',
    },
    {
        type: 'tr_release',
        name: '发布版本',
        command: '/venus:release-version patch',
        hint: '整理变更日志并按 SemVer 建议版本号',
    },
];

/** 渲染 onboarding 提示块 */
export function renderOnboardingHints(): string {
    const lines: string[] = [
        '',
        '═══════════════════════════════════════════════════════',
        '  下一步：在 Claude Code 中试试这些指令',
        '═══════════════════════════════════════════════════════',
        '',
    ];
    for (const item of ONBOARDING_HINTS) {
        lines.push(`  ${item.command}`);
        lines.push(`    ${item.hint}`);
        lines.push('');
    }
    lines.push('  也可以直接用自然语言提问，Claude 会自动匹配技能。');
    lines.push('  查看全部：venus list');
    lines.push('');
    return lines.join('\n');
}
