const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the workspace root (parent directory)
const workspaceRoot = path.resolve(__dirname, '..');
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Watch all files in the workspace
config.watchFolders = [workspaceRoot];

// Resolve modules from the workspace node_modules first
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Ensure Metro can resolve packages that are hoisted to the workspace root
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
