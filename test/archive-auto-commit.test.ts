/**
 * archive-auto-commit + project-init-git：模板正文契约。
 *
 * 覆盖能力 `archive-auto-commit`、`project-init-git`、`init-project-scan` 的 Scenario。
 */

import { describe, it, expect } from 'vitest';
import { getSpecArchiveChangeSkillTemplate } from '../src/core/templates/workflows/spec-archive.js';
import { getSpecBulkArchiveSkillTemplate } from '../src/core/templates/workflows/spec-bulk-archive.js';
import { getProjectInitSkillTemplate } from '../src/core/templates/workflows/project-init.js';
import { getCommitSkillTemplate } from '../src/core/templates/workflows/commit.js';

/** 把 references 一并拼入（渐进披露） */
function fullText(skill: { instructions: string; references?: { content: string }[] }): string {
    return [skill.instructions, ...(skill.references ?? []).map((ref) => ref.content)].join('\n');
}

describe('单变更归档自动提交', () => {
    const text = fullText(getSpecArchiveChangeSkillTemplate());

    it('Scenario: 提交成功（Step 7.5 存在且顺序正确）', () => {
        expect(text).toContain('7.5');
        expect(text).toContain('归档自动提交');
        // 位置：索引更新之后、展示摘要之前
        const idxStep7 = text.indexOf('7. **更新分片归档索引');
        const idxStep75 = text.indexOf('7.5 **归档自动提交');
        const idxStep8 = text.indexOf('8. **展示摘要');
        expect(idxStep7).toBeGreaterThan(-1);
        expect(idxStep75).toBeGreaterThan(idxStep7);
        expect(idxStep8).toBeGreaterThan(idxStep75);
        // 提交信息尾行
        expect(text).toContain('提案: <change-name>');
    });

    it('Scenario: 无路径可提交 → 跳过并说明', () => {
        expect(text).toContain('无路径 → 跳过并说明');
    });

    it('Scenario: 只暂存固定清单', () => {
        expect(text).toContain('MUST NOT 使用');
        expect(text).toContain('git add -A');
        expect(text).toContain('目录通配');
        expect(text).toContain('排除');
        expect(text).toContain('attachments');
    });

    it('Scenario: 提交失败不阻断归档', () => {
        expect(text).toContain('MUST NOT 回滚归档');
        expect(text).toContain('WARN');
        expect(text).toContain('detached HEAD');
    });

    it('Scenario: 推送确认门拒绝 → 保留本地提交', () => {
        expect(text).toContain('推送确认门');
        expect(text).toContain('保留本地提交');
        // 未配置 remote 非失败
        expect(text).toContain('未配置 remote');
    });

    it('Scenario: 推送确认门不可跳过', () => {
        expect(text).toContain('destructive-change');
        expect(text).toContain('MUST NOT 被');
        expect(text).toContain('gate-skip');
        expect(text).toContain('跳过');
    });
});

describe('批量归档自动提交', () => {
    const text = fullText(getSpecBulkArchiveSkillTemplate());

    it('Scenario: 整批一次提交', () => {
        expect(text).toContain('10.5');
        expect(text).toContain('批量归档自动提交');
        expect(text).toContain('整批一次');
        expect(text).toContain('MUST NOT 逐变更分别提交');
    });

    it('Scenario: 部分归档失败只提交成功者', () => {
        expect(text).toContain('只提交成功归档者');
        expect(text).toContain('MUST NOT 纳入提交');
    });

    it('推送确认门与失败不阻断同语义', () => {
        expect(text).toContain('推送确认门');
        expect(text).toContain('保留本地提交');
        expect(text).toContain('WARN');
    });
});

describe('project-init Step 0 前置 Git 检查', () => {
    const text = fullText(getProjectInitSkillTemplate());

    it('Scenario: Step 0 先于扫描', () => {
        const idxStep0 = text.indexOf('### 0. 前置环境检查');
        const idxStep1 = text.indexOf('### 1. 读取扫描基线');
        expect(idxStep0).toBeGreaterThan(-1);
        expect(idxStep1).toBeGreaterThan(idxStep0);
    });

    it('Scenario: Git 已安装且项目未初始化 → 执行 init', () => {
        expect(text).toContain('iagent git init');
        expect(text).toContain('Git 仓库已初始化');
    });

    it('Scenario: 已是仓库 → 跳过（零改动）', () => {
        expect(text).toContain('action=skipped');
        expect(text).toContain('零改动');
    });

    it('Scenario: 未安装且用户确认安装', () => {
        expect(text).toContain('安装确认门');
        expect(text).toContain('destructive-change');
        expect(text).toContain('确切命令');
    });

    it('Scenario: 未安装且用户拒绝 → 跳过 + WARN 不阻断', () => {
        expect(text).toContain('跳过 Git 能力');
        expect(text).toContain('WARN');
        expect(text).toContain('继续第 1 步');
    });

    it('Scenario: 上级仓库防护', () => {
        expect(text).toContain('上级仓库');
        expect(text).toContain('MUST NOT 创建嵌套仓库');
    });

    it('Scenario: Git 不可用时不阻断后续扫描', () => {
        expect(text).toContain('MUST NOT 影响后续扫描');
    });
});

describe('commit.ts 约束收窄', () => {
    const text = getCommitSkillTemplate().instructions;

    it('Scenario: 交互式提交仍需确认', () => {
        expect(text).toContain('MUST NOT 自动 commit（交互式）');
        expect(text).toContain('/iagent:commit');
        expect(text).toContain('确认前 MUST NOT 执行');
    });

    it('Scenario: 归档收尾自动提交不受交互约束（窄通道三项前提）', () => {
        expect(text).toContain('窄通道例外');
        expect(text).toContain('iagent_spec_archive');
        expect(text).toContain('iagent_spec_bulk_archive');
        // 三项前提
        expect(text).toContain('① ' + '只暂存固定清单'.slice(0, 0) + '只暂存固定清单');
        expect(text).toContain('② 推送前 MUST 经推送确认门');
        expect(text).toContain('③ 提交失败 MUST NOT 阻断归档');
        // 排他性
        expect(text).toContain('除上述窄通道外');
    });
});
