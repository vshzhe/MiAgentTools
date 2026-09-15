#!/usr/bin/env node

/**
 * 生成 skills/ 静态快照。
 *
 * 将内置技能模板生成为提交到仓库的 skills/<name>/SKILL.md 树，
 * 供 git 分发与直接浏览。快照与模板的一致性由
 * test/skills-parity.test.ts 防漂移测试保证：
 * 修改模板后必须运行 `pnpm build && pnpm generate:skills`。
 */

import { writeFileSync, existsSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSkillTemplates } from '../dist/core/templates/index.js';
import { generateSkillContent } from '../dist/core/command-generation/index.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'skills');

/** 清理 skills/ 下全部技能子目录（保留 README.md 等非目录文件） */
function cleanSkillSubdirectories() {
    if (!existsSync(outDir)) {
        return;
    }
    for (const entry of readdirSync(outDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            rmSync(join(outDir, entry.name), { recursive: true, force: true });
        }
    }
}

cleanSkillSubdirectories();

let count = 0;
let refCount = 0;
for (const { template } of getSkillTemplates()) {
    const generated = generateSkillContent(template, 'snapshot');
    const skillDir = join(outDir, generated.dirName);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), generated.fileContent, 'utf8');
    // 附加参考文件（references/*.md 等）
    if (generated.references) {
        for (const ref of generated.references) {
            const refPath = join(skillDir, ref.path);
            mkdirSync(dirname(refPath), { recursive: true });
            writeFileSync(refPath, ref.content, 'utf8');
            refCount++;
        }
    }
    count++;
}

console.log(`已生成 ${count} 个技能到 skills/（含 ${refCount} 个参考文件）`);
