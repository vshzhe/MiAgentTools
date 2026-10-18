/**
 * legacy 下划线技能产物 → canonical kebab-case 迁移。
 *
 * 变更 add-host-orchestration-adapters 引入新的宿主技能 ID 形态 `iagent-<workflowId>`。
 * 存量装机的技能目录以旧下划线形态 `iagent_<name>` 存在，init/update 入口 MUST 在产物
 * 生成之前把它们迁移到 canonical 目录，否则同一技能会以两种形态重复存在。
 *
 * 迁移策略（安全优先）：
 *   - 只处理本工具管理的 legacy 目录（`iagent_` 前缀且非 canonical）；
 *   - 目标已存在时不覆盖、保留两者并记告警（禁止静默丢内容）；
 *   - 迁移同时把 SKILL.md 的 frontmatter `name` 改写为 canonical 并重算内容指纹，
 *     使产物在迁移后仍被判为「未手改」，`iagent update` 可安全刷新；
 *   - 非 iagent 产物完全不触碰。
 *
 * 幂等：迁移完成后无 legacy 目录，二次执行零改动。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { AI_TOOLS, TOOL_SKILLS_SUBDIR } from './config.js';
import { isLegacySkillId, toCanonicalSkillId } from './skill-id.js';
import { fingerprintOf } from './command-generation/fingerprint.js';

/** 技能 ID 迁移报告 */
export interface SkillIdMigrationReport {
    /** 是否发生了至少一次迁移 */
    migrated: boolean;
    /** 迁移明细（源 → 目标） */
    moved: string[];
    /** 跳过明细（目标已存在、非目录等，含原因） */
    skipped: string[];
    /** 告警（冲突、失败等，非阻断） */
    warnings: string[];
}

/** 项目相对路径（正斜杠归一化） */
function toPosix(relativePath: string): string {
    return relativePath.replaceAll('\\', '/');
}

/**
 * 改写 SKILL.md 内容：frontmatter `name` 改为 canonical，并重算内容指纹。
 *
 * 无指纹字段（存量旧产物）时只改 name，不凭空补指纹。
 */
function rewriteSkillContent(content: string, canonicalId: string): string {
    let out = content.replace(/^name: .*$/m, `name: ${canonicalId}`);
    if (/^ {0,2}generatedFingerprint: "/m.test(out)) {
        const fp = fingerprintOf(out);
        out = out.replace(/^ {0,2}generatedFingerprint: ".*"$/m, `  generatedFingerprint: "${fp}"`);
    }
    return out;
}

/**
 * 执行 legacy 技能目录迁移。
 *
 * 失败降级为报告告警，MUST NOT 抛出（不阻断 init/update 主流程）。
 *
 * @param projectRoot - 项目根目录
 */
export function runSkillIdMigration(projectRoot: string): SkillIdMigrationReport {
    const report: SkillIdMigrationReport = { migrated: false, moved: [], skipped: [], warnings: [] };

    for (const tool of AI_TOOLS) {
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        if (!fs.existsSync(skillsRoot)) {
            continue;
        }
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
        } catch (error) {
            report.warnings.push(`扫描 ${toPosix(path.relative(projectRoot, skillsRoot))} 失败（已跳过）：${(error as Error).message}`);
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() && !entry.isSymbolicLink()) {
                continue;
            }
            if (!isLegacySkillId(entry.name)) {
                continue;
            }
            const canonical = toCanonicalSkillId(entry.name);
            const src = path.join(skillsRoot, entry.name);
            const dst = path.join(skillsRoot, canonical);
            const isSymlink = entry.isSymbolicLink();
            const srcRel = toPosix(path.relative(projectRoot, src));
            const dstRel = toPosix(path.relative(projectRoot, dst));

            if (fs.existsSync(dst)) {
                report.skipped.push(`${srcRel}（目标 ${dstRel} 已存在，保留 legacy 未迁移）`);
                report.warnings.push(
                    `技能目录未迁移：${dstRel} 已存在；legacy ${srcRel} 保留未删，请人工比对后删除多余副本`
                );
                continue;
            }

            try {
                fs.renameSync(src, dst);
            } catch (error) {
                report.skipped.push(`${srcRel}（重命名失败：${(error as Error).message}）`);
                report.warnings.push(`技能目录迁移失败：${srcRel} → ${dstRel}（${(error as Error).message}）`);
                continue;
            }

            // 同步 frontmatter name 与指纹，使迁移产物仍被判为未手改
            const skillFile = path.join(dst, 'SKILL.md');
            // 符号链接只迁移链接本身：MUST NOT 跟随链接写入其指向的外部内容。
            if (!isSymlink && fs.existsSync(skillFile)) {
                try {
                    const content = fs.readFileSync(skillFile, 'utf8');
                    fs.writeFileSync(skillFile, rewriteSkillContent(content, canonical), 'utf8');
                } catch (error) {
                    report.warnings.push(
                        `${dstRel}/SKILL.md 的 name/指纹未同步（${(error as Error).message}），update 时可能被判定为手改`
                    );
                }
            }

            report.moved.push(`${srcRel} → ${dstRel}`);
        }
    }

    report.migrated = report.moved.length > 0;
    return report;
}

/** 渲染技能 ID 迁移报告（无迁移时返回空字符串） */
export function renderSkillIdMigrationReport(report: SkillIdMigrationReport): string {
    if (!report.migrated) {
        return '';
    }
    const lines: string[] = ['技能 ID 迁移（下划线 → kebab-case）：'];
    lines.push(`  迁移项：${report.moved.length} 项`);
    for (const item of report.moved) {
        lines.push(`    → ${item}`);
    }
    for (const item of report.skipped) {
        lines.push(`    · ${item}`);
    }
    for (const warning of report.warnings) {
        lines.push(`  ! ${warning}`);
    }
    return lines.join('\n');
}
