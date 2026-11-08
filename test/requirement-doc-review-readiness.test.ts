/**
 * 需求文档面向人工评审的结构与内容契约。
 *
 * 对应变更 improve-requirement-doc-review-readiness（任务 4.1–4.9、4.12、4.16）：
 * 锁定 skill 版唯一源正文的评审摘要、验收标准与来源列、风险 / 待确认集中表、
 * 文档元信息块、结构化评审记录、伪代码上限、人工域保护与失败语义。
 *
 * command 版由 deriveCommandContent 派生（见 template-derivation.test.ts），
 * 本文件只校验派生结果保留新关键词，不另立第二份正文断言。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    getRequirementDocSkillTemplate,
    getRequirementDocCommandTemplate,
} from '../src/core/templates/workflows/requirement-doc.js';
import { generateSkillContent } from '../src/core/command-generation/index.js';
import { deriveSkillId } from '../src/core/skill-id.js';

const body = getRequirementDocSkillTemplate().instructions;
const commandBody = getRequirementDocCommandTemplate().content;

describe('需求文档评审可用性（skill 版唯一源）', () => {
    it('4.1 评审摘要在基本信息之后、一、原始需求之前，且含六个派生字段', () => {
        // 位置：在输出骨架内判定（规则段落中的同类标题不参与）
        const skeletonStart = body.indexOf('# 需求文档: {变更名称}');
        const skeletonEnd = body.indexOf('## 输出路径');
        expect(skeletonStart).toBeGreaterThan(-1);
        expect(skeletonEnd).toBeGreaterThan(skeletonStart);
        const skeleton = body.slice(skeletonStart, skeletonEnd);

        const basicInfo = skeleton.indexOf('## 基本信息');
        const summary = skeleton.indexOf('## 评审摘要');
        const original = skeleton.indexOf('## 一、原始需求');
        expect(basicInfo).toBeGreaterThan(-1);
        expect(summary).toBeGreaterThan(basicInfo);
        expect(original).toBeGreaterThan(summary);

        // 无编号（不得写成「## 编号」形式）
        expect(body).not.toMatch(/#{2,}\s*\d+[.、]\s*评审摘要/);

        for (const field of [
            '结论',
            '范围',
            'Top3',
            '待拍板问题',
            '评审要点建议',
            '待确认计数',
        ]) {
            expect(body, `评审摘要缺字段：${field}`).toContain(field);
        }

        // 五条派生来源固定
        expect(body).toContain('Why 目标句');
        expect(body).toContain('Capabilities');
        expect(body).toContain('7.7');
        expect(body).toContain('未定');
        expect(body).toContain('至多 5 条');
        expect(body).toContain('MUST NOT 自行评级');
    });

    it('4.2 需求拆解含验收标准与来源列，短 ID 与无 specs 降级齐备', () => {
        expect(body).toContain(
            '| 需求项 | 功能描述 | 优先级 | 类型 | 验收标准 | 来源 |'
        );
        expect(body).toContain('proposal:WC2');
        expect(body).toContain('spec:<cap>:S1');
        expect(body).toContain('task:T3.2');
        expect(body).toContain('MUST NOT 使用完整路径或仅章节名');
        // 无 specs 降级
        expect(body).toContain('无 specs 降级');
        expect(body).toContain('整列标 `[待确认]`');
    });

    it('4.3 7.6 风险与 7.7 待确认集中表存在，含未声明风险与不截断规则', () => {
        expect(body).toContain('### 7.6 风险');
        expect(body).toContain('### 7.7 待确认');
        expect(body).toContain('制品未声明风险');
        expect(body).toContain('MUST 完整列出');
        expect(body).toContain('MUST NOT 截断');
        // 风险等级仅在 design 明示时使用
        expect(body).toContain('等级仅在 `design.md` 明示时填写');
        expect(body).toContain('未分级');
        expect(body).toContain('MUST NOT 自行评级');
    });

    it('4.4 无 specs 时整列 [待确认]，缺口计入 7.7 与摘要计数', () => {
        expect(body).toContain('无 specs 降级');
        expect(body).toContain('覆盖自检跳过并记 WARN');
        expect(body).toContain('计入 7.7 与摘要待确认计数');
    });

    it('4.5 伪代码上限为 ≤2 块/文档、≤12 行/块，校验仅保留 1 条按需项', () => {
        expect(body).toContain('≤2 块/文档、≤12 行/块');
        expect(body).not.toContain('15 行');
        expect(body).not.toContain('3 块/章节');
        expect(body).toContain('仅当表格或流程图无法表达判定逻辑时');
        // 校验清单中伪代码相关项只有按需一条（旧专项强制项已删除）
        expect(body).toContain('- [ ] 伪代码按需使用且符合上限');
        expect(body).not.toContain('伪代码行数（≤15 行/块）与块数（≤3 块/章节）符合上限');
        expect(body).not.toContain('伪代码块使用 ```pseudocode 语法且块首标注 artifacts 来源');
    });

    it('4.6 人工域保护与增量对齐存在，旧静默覆盖口径已移除', () => {
        expect(body).toContain('人工域');
        expect(body).toContain('增量对齐');
        expect(body).toContain('保留至**文件末尾**');
        expect(body).toContain('占位符不保留');
        expect(body).toContain('缺失的行按占位符处理');
        expect(body).not.toContain('静默覆盖');
        expect(body).not.toContain('MUST NOT 弱化');
    });

    it('4.7 解析失败不写入，保留原文件并报告路径与原因', () => {
        expect(body).toContain('解析失败不写入');
        expect(body).toContain('MUST NOT 写入目标文件');
        expect(body).toContain('保留原文件');
        expect(body).toContain('报告期望路径与解析失败原因');
    });

    it('4.8 只读 / IO 写入失败保留原文件并报错，不声称成功', () => {
        expect(body).toContain('写入失败');
        expect(body).toContain('只读');
        expect(body).toContain('IO 错误');
        expect(body).toContain('MUST NOT 声称生成成功');
    });

    it('4.9 重复运行幂等：除生成时间外一致', () => {
        expect(body).toContain('幂等');
        expect(body).toContain('除生成时间外');
        expect(body).toContain('MUST NOT 视为内容漂移');
    });

    it('4.16 元信息块、结构化评审记录与失败报错三项契约', () => {
        // 文档元信息块与指纹取值规则
        expect(body).toContain('生成元信息');
        expect(body).toContain('sourceFingerprint');
        expect(body).toContain('未提供');
        expect(body).toContain('文档版本：v1');
        expect(body).toContain('MUST NOT 自行计算');
        // 结构化评审记录骨架
        expect(body).toContain('| 评审日期 |');
        expect(body).toContain('| 参与人 |');
        expect(body).toContain('| 评审结论 |');
        expect(body).toContain('遗留事项与处置');
        // 失败必须报错，不再是「非阻断」口径
        expect(body).toContain('MUST NOT 降级为告警');
        expect(body).not.toContain('生成失败为非阻断');
        expect(body).not.toContain('绝不因提问阻塞');
    });

    it('4.10 / 4.11 派生指令版保留评审摘要、验收标准与人工域保护关键词', () => {
        for (const marker of ['评审摘要', '验收标准', '人工域', '人工域保护']) {
            expect(commandBody, `指令版缺失关键词：${marker}`).toContain(marker);
        }
        expect(commandBody).not.toContain('requirementDocStatus');
    });
});

describe('需求文档生成快照（任务 4.12）', () => {
    it('skills 快照与模板生成结果一致（忽略版本元数据行）且含新结构关键词', () => {
        const skillId = deriveSkillId(getRequirementDocSkillTemplate().name);
        const snapshotPath = path.join(process.cwd(), 'skills', skillId, 'SKILL.md');
        expect(
            fs.existsSync(snapshotPath),
            `缺少快照：skills/${skillId}/SKILL.md（先运行 pnpm build && pnpm generate:skills）`
        ).toBe(true);

        const stripVersionMeta = (content: string): string =>
            content
                .split('\n')
                .filter((line) => !/^\s*(generatedBy|generatedFingerprint):/.test(line))
                .join('\n');

        const snapshot = fs.readFileSync(snapshotPath, 'utf8');
        const generated = generateSkillContent(
            getRequirementDocSkillTemplate(),
            'snapshot'
        ).fileContent;
        expect(stripVersionMeta(snapshot)).toBe(stripVersionMeta(generated));

        for (const marker of ['评审摘要', '验收标准', '人工域', '7.6 风险', '7.7 待确认']) {
            expect(snapshot, `快照缺失新结构关键词：${marker}`).toContain(marker);
        }
    });
});
