#!/usr/bin/env node
/* eslint-env node */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local and .env.production
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${filePath} not found`);
    return {};
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return env;
}

// Paths relative to project root
const frontendDir = path.join(__dirname, '..', 'frontend');
const projectRoot = path.join(__dirname, '..');

const envLocal = loadEnvFile(path.join(frontendDir, '.env.local'));
const envProduction = loadEnvFile(path.join(frontendDir, '.env.production'));

const devProjectId = envLocal.VITE_FIREBASE_PROJECT_ID;
const prodProjectId = envProduction.VITE_FIREBASE_PROJECT_ID;

if (!devProjectId) {
  console.error('Error: VITE_FIREBASE_PROJECT_ID not found in frontend/.env.local');
  process.exit(1);
}

if (!prodProjectId) {
  console.error('Error: VITE_FIREBASE_PROJECT_ID not found in frontend/.env.production');
  process.exit(1);
}

const firebaserc = {
  projects: {
    default: devProjectId,
    dev: devProjectId,
    prod: prodProjectId
  },
  targets: {},
  etags: {}
};

const firebasercPath = path.join(projectRoot, '.firebaserc');
fs.writeFileSync(firebasercPath, JSON.stringify(firebaserc, null, 2) + '\n');

console.log('Generated .firebaserc with:');
console.log(`  dev/default: ${devProjectId}`);
console.log(`  prod: ${prodProjectId}`);