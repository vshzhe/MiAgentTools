/**
 * 模板层统一导出。
 */

export type { SkillTemplate, CommandTemplate, SkillTemplateEntry } from './types.js';
export {
    getSkillTemplates,
    getCommandTemplates,
    countSkillsByType,
    deriveCommandId,
    getKnownCommandIds,
} from './registry.js';
export {
    COMMAND_REF_PREFIX,
    COMMAND_REF_RE,
    commandRef,
    prefixedCommandRef,
    rewriteCommandRefs,
    extractCommandRefIds,
} from './command-references.js';
