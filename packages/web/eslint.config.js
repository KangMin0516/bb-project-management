import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app',      pattern: 'src/app/**/*' },
        { type: 'pages',    pattern: 'src/pages/**/*' },
        { type: 'widgets',  pattern: 'src/widgets/**/*' },
        { type: 'features', pattern: 'src/features/**/*' },
        { type: 'entities', pattern: 'src/entities/**/*' },
        { type: 'shared',   pattern: 'src/shared/**/*' },
      ],
      'boundaries/ignore': ['**/*.test.*', '**/*.spec.*'],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: { type: 'shared' },   allow: { to: { type: 'shared' } } },
            { from: { type: 'entities' }, allow: { to: { type: ['shared', 'entities'] } } },
            { from: { type: 'features' }, allow: { to: { type: ['shared', 'entities', 'features'] } } },
            { from: { type: 'widgets' },  allow: { to: { type: ['shared', 'entities', 'features', 'widgets'] } } },
            { from: { type: 'pages' },    allow: { to: { type: ['shared', 'entities', 'features', 'widgets', 'pages'] } } },
            { from: { type: 'app' },      allow: { to: { type: ['shared', 'entities', 'features', 'widgets', 'pages', 'app'] } } },
          ],
        },
      ],
    },
  },
])
