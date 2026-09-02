import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Le code NestJS/Prisma utilise massivement `any` pour les types
      // dynamiques (Prisma extensions, callbacks, DTOs) : on passe en
      // avertissement pour ne pas noyer les vrais problèmes.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Variables non utilisées : erreur, mais on autorise les prefixes
      // underscore pour les paramètres intentionnellement non utilisés.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Le code NestJS/Prisma génère des méthodes qui ne renvoient rien
      // explicitement mais sont utilisées comme handlers : on garde la
      // règle par défaut (empty function) mais on permet les expressions
      // en position de statement.
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
    },
  },
);
