import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        environment: 'node',
        // 默认 5s 对 shell 调用外部 CLI 的用例（如 spec-commands 的 venus↔openspec
        // 互认校验，单跑约 3.9s）余量不足，全量并发下会间歇性超时失败
        testTimeout: 20000,
    },
});
