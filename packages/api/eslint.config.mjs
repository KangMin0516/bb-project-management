// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'generated/**', 'dist/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  // Test files — relax the type-checked rules. ESLint's parser cannot
  // resolve types from `@jest/globals` under our ts-jest ESM setup, so
  // every `describe()`/`it()`/`expect(...).toBe(...)` is flagged as
  // "unsafe call of a type that could not be resolved". ts-jest itself
  // resolves them correctly (the suite runs); only the IDE/lint view
  // is wrong. Turning these rules off here keeps the production code
  // strict while letting test code pass.
  {
    files: ['src/**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  // Layer boundaries (M0 refactor per refactor-plan.md §3.2). Files
  // outside the new layer patterns stay "untyped" — the plugin skips
  // them entirely, so existing services keep compiling unchanged.
  // Currently `warn`; flip to `error` once a full module migrates.
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/*/domain/**/*' },
        { type: 'application', pattern: 'src/*/application/**/*' },
        { type: 'infrastructure', pattern: 'src/*/infrastructure/**/*' },
        { type: 'interface', pattern: 'src/*/interface/**/*' },
        { type: 'shared', pattern: 'src/common/**/*' },
      ],
      'boundaries/ignore': ['**/*.spec.ts', '**/*.test.ts'],
    },
    rules: {
      'boundaries/dependencies': [
        'warn',
        {
          default: 'allow',
          rules: [
            {
              from: { type: 'domain' },
              disallow: {
                to: {
                  type: [
                    'application',
                    'infrastructure',
                    'interface',
                    'shared',
                  ],
                },
              },
              message:
                'Domain layer must be framework-free. Move infra/orchestration to application/infrastructure.',
            },
            {
              from: { type: 'application' },
              disallow: { to: { type: ['infrastructure', 'interface'] } },
              message:
                'Application must depend on domain + ports only. Inject infrastructure via DI.',
            },
            {
              from: { type: 'infrastructure' },
              disallow: { to: { type: ['interface'] } },
              message:
                'Infrastructure adapters must not depend on controllers.',
            },
          ],
        },
      ],
    },
  },
);
