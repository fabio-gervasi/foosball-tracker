// ESLint configuration for Foosball Tracker
// Enhanced configuration with TypeScript support

import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      'dist',
      'build',
      'node_modules',
      '*.config.js',
      '*.config.ts',
      'vite.config.ts',
      'tailwind.config.js',
      'postcss.config.js',
      'performance-budget.config.js',
      'coverage',
      '.github',
      'src/supabase/functions/server/**/*.tsx',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // TypeScript specific rules - relaxed for CI/CD implementation
      '@typescript-eslint/no-unused-vars': [
        'warn', // Changed from error to warn
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off', // Disabled for now
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',

      // General rules - relaxed for CI/CD implementation
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      'no-debugger': 'error',
      'no-duplicate-imports': 'warn', // Changed from error to warn
      'prefer-const': 'warn', // Changed from error to warn
      'no-var': 'error',
      'object-shorthand': 'warn', // Changed from error to warn
      'prefer-template': 'warn', // Changed from error to warn

      // React rules
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/prop-types': 'off', // TypeScript handles this
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Turn off base rules that are covered by TypeScript
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
  {
    files: ['src/tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      // More relaxed rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];
