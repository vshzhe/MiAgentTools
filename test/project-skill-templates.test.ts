/**
 * 项目技能接入：技能模板正文断言（蒸馏 / 探索 / 提案 / 实现 / 编排 / 验证）。
 *
 * 模板为生成源；skills/ 快照由 `pnpm generate:skills` 派生，本测试只针对模板正文。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/index.js';

const templates = new Map(
    getSkillTemplates().map((entry) => [entry.template.name, entry.template.instructions])
);

function instructionsOf(name: string): string {
    const content = templates.get(name);
    expect(content, `${name} 模板缺失`).toBeDefined();
    return content ?? '';
}

describe('项目技能蒸馏（project-init）', () => {
    const init = instructionsOf('iagent_project_init');

    it('包含第 11 步技能蒸馏与固定顺序', () => {
        expect(init).toContain('### 11. 项目前后端技能蒸馏');
        expect(init).toContain('规则蒸馏 → 技能蒸馏');
    });

    it('包含 C1-C6 自检与必需章节清单', () => {
        expect(init).toContain('C1-C6');
        for (const section of [
            '## 框架与版本',
            '## 目录与分层',
            '## 设计规范',
            '## 实现规范',
            '## 约定与禁止项',
            '## 证据索引',
            '## 不适用项',
        ]) {
            expect(init).toContain(section);
        }
        expect(init).toContain('不适用 + 探测依据');
        expect(init).toContain('[待补充]');
        expect(init).toContain('MUST NOT 写入该侧');
    });

    it('包含单侧缺失不生成与候选不等于使用', () => {
        expect(init).toContain('该侧**不生成**');
        expect(init).toContain('MUST NOT 据此断言使用');
    });

    it('包含默认单文档 / 拆分判定 / 多框架分节', () => {
        expect(init).toContain('默认每侧一份');
        expect(init).toContain('phases: design');
        expect(init).toContain('phases: implement');
        expect(init).toContain('frameworks');
    });

    it('包含已存在逐份确认、人工域与自动注册', () => {
        expect(init).toContain('逐份确认（确认重新生成 / 修改 / 跳过）');
        expect(init).toContain('人工域标记');
        expect(init).toContain('skills:');
        expect(init).toContain('幂等');
    });

    it('包含安全边界与非阻断报告', () => {
        expect(init).toContain('MUST NOT 写入凭据值');
        expect(init).toContain('非阻断');
        expect(init).toContain('未生成侧写明原因');
    });
});

describe('项目技能基线（spec-explore）', () => {
    const explore = instructionsOf('iagent_spec_explore');

    it('包含 1.1.1.5 技能基线检查点与阶段筛选', () => {
        expect(explore).toContain('## 项目技能基线（强制检查点）');
        expect(explore).toContain('iagent skills --json');
        expect(explore).toContain('## 项目技能基线');
        expect(explore).toContain('phases');
        expect(explore).toContain('design');
        expect(explore).toContain('implement');
    });

    it('包含无配置合法终态、读取失败与不完整处置', () => {
        expect(explore).toContain('无技能配置');
        expect(explore).toContain('未读');
        expect(explore).toContain('validation.status=incomplete');
        expect(explore).toContain('MUST NOT 当作完整规范使用');
    });

    it('包含与规则基线并列', () => {
        expect(explore).toContain('与 `## 项目规则基线` 并列');
    });
});

describe('handoff 技能要点（spec-propose）', () => {
    const propose = instructionsOf('iagent_spec_propose');

    it('包含技能要点子节与来源标注', () => {
        expect(propose).toContain('技能要点');
        expect(propose).toContain('## 项目技能基线');
        expect(propose).toContain('逐条标注来源路径');
    });

    it('包含复用基线、缺失降级与无配置显式记录', () => {
        expect(propose).toContain('MUST NOT 重新枚举');
        expect(propose).toContain('执行一次 `iagent skills --json`');
        expect(propose).toContain('无技能配置');
    });
});

describe('实现消费（spec-apply）', () => {
    const apply = instructionsOf('iagent_spec_apply');

    it('包含实现前读取 implement|both 技能与回执字段', () => {
        expect(apply).toContain('iagent skills --json');
        expect(apply).toContain('skillsRead');
        expect(apply).toContain('skillsIncomplete');
        expect(apply).toContain('implement');
    });

    it('包含 skills-not-read / skills-incomplete 判定', () => {
        expect(apply).toContain('skills-not-read');
        expect(apply).toContain('skills-incomplete');
        expect(apply).toContain('design-only 不要求');
    });
});

describe('编排透传（workflow / auto-workflow）', () => {
    for (const name of ['iagent_workflow', 'iagent_auto_workflow']) {
        it(`${name} 包含技能基线透传与回执核对`, () => {
            const content = instructionsOf(name);
            expect(content).toContain('项目技能基线');
            expect(content).toContain('skillsRead');
            expect(content).toContain('skillsIncomplete');
            expect(content).toContain('技能基线状态');
        });
    }
});

describe('调试消费（debug）', () => {
    const debug = instructionsOf('iagent_debug');

    it('包含 2.1.7 技能基线与阶段筛选', () => {
        expect(debug).toContain('2.1.7 项目技能基线');
        expect(debug).toContain('iagent skills --json');
        expect(debug).toContain('design');
    });

    it('包含修复阶段读取实现技能与回执', () => {
        expect(debug).toContain('修复前读取');
        expect(debug).toContain('skillsRead');
        expect(debug).toContain('skillsIncomplete');
    });

    it('包含一致性门阶段过滤', () => {
        expect(debug).toContain('skills-not-read');
        expect(debug).toContain('skills-incomplete');
        expect(debug).toContain('design-only 不要求');
    });
});

describe('实现验证（spec-verify）', () => {
    const verify = instructionsOf('iagent_spec_verify');

    it('包含技能一致性与两条诊断', () => {
        expect(verify).toContain('项目技能一致性');
        expect(verify).toContain('skills-not-read');
        expect(verify).toContain('skills-incomplete');
        expect(verify).toContain('iagent skills --json');
    });
});
