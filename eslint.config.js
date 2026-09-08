import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        files: ['src/**/*.ts', 'test/**/*.ts'],
        extends: [...tseslint.configs.recommended],
        rules: {
            // 聚焦关键问题，与 OpenSpec 的取舍一致
            '@typescript-eslint/no-explicit-any': 'off',
            'no-empty': 'off',
            'prefer-const': 'off',
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**', 'skills/**', '.claude/**', '*.js', '*.mjs'],
    }
);
