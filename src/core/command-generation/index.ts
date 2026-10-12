/**
 * 生成层统一导出。
 */

export type {
    CommandContent,
    ToolCommandAdapter,
    GeneratedCommand,
    GeneratedSkill,
} from './types.js';
export { escapeYamlValue, formatTagsArray } from './yaml.js';
export {
    FINGERPRINT_FIELD,
    fingerprintOf,
    readGeneratedBy,
    readGeneratedFingerprint,
} from './fingerprint.js';
export { generateCommand, generateCommands, generateSkillContent } from './generator.js';
export { claudeAdapter } from './adapters/claude.js';
export { piAdapter } from './adapters/pi.js';
export { CommandAdapterRegistry } from './adapters/registry.js';
