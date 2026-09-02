const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const { node } = require('globals');

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'node_modules/*']),
  expoConfig,
  {
    // Fichiers de config exécutés dans Node.js (hors environnement React Native)
    files: ['babel.config.js', 'index.js'],
    languageOptions: {
      globals: node,
    },
  },
]);
