import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/lib/**',
      '**/node_modules/**',
      'frontend/public/**',
      'docs/openapi.*',
      'functions/test/**/*.js',
      'functions/**/*.test.js',
      'functions/vitest.config.js',
      // Vue files with TypeScript parser issues - temporary ignores
      'frontend/src/features/game/TarkovItem.vue',
      'frontend/src/features/maps/TarkovMap.vue', 
      'frontend/src/features/ui/TrackerTip.vue',
      'frontend/src/features/neededitems/components/ItemCountControls.vue',
      'frontend/src/features/neededitems/components/ItemImage.vue',
      'frontend/src/features/neededitems/components/RequirementInfo.vue',
      'frontend/src/features/neededitems/components/TeamNeedsDisplay.vue',
      'frontend/src/features/tasks/TaskMapPanel.vue',
      'frontend/src/features/tasks/TaskMapTabs.vue',
    ],
  },

  // Base configuration for all files
  js.configs.recommended,

  // TypeScript configuration
  ...tseslint.configs.recommended,

  // Vue configuration
  ...pluginVue.configs['flat/recommended'],

  // Project-specific overrides
  {
    files: ['frontend/**/*.{ts,js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        project: 'frontend/tsconfig.eslint.json',
        tsconfigRootDir: '.',
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
      'vue/no-unused-vars': 'off',
      'no-debugger': 'off',
      'max-len': ['warn', { code: 100 }],
    },
  },

  {
    files: ['functions/**/*.{ts,js}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        project: 'functions/tsconfig.json',
        tsconfigRootDir: '.',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'max-len': ['warn', { code: 120 }],
    },
  },

  // Node.js scripts configuration (CommonJS)
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },

  // Apollo config (CommonJS)
  {
    files: ['apollo.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Prettier must be last to override style rules
  eslintConfigPrettier,
];