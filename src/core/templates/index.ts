/**
 * 模板层统一导出。
 */

export type { SkillTemplate, CommandTemplate, SkillTemplateEntry } from './types.js';
export { getSkillTemplates, getCommandTemplates, countSkillsByType, deriveCommandId } from './registry.js';
