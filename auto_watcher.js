const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chokidar = require('chokidar');

const PROJECT_DIR = path.resolve(__dirname);
const CSV_PATH = path.join(PROJECT_DIR, 'products.csv');

console.log('=== nikkis_universe Auto-Watcher ===');
console.log('Watching products.csv for changes...');
console.log('When you update products.csv, it will:');
console.log('  1. Run fetch_all_photos_auto.js to get images');
console.log('  2. Run auto_sync.js to generate catalog.json');
console.log('  3. Push to GitHub');
console.log('Press Ctrl+C to stop.\n');

// Install chokidar if not installed
try {
  require('chokidar');
} catch (e) {
  console.log('Installing chokidar...');
  execSync('npm install chokidar', { cwd: PROJECT_DIR, stdio: 'inherit' });
}

function runCommand(cmd) {
  console.log(`\n>>> Running: ${cmd}`);
  try {
    execSync(cmd, { cwd: PROJECT_DIR, stdio: 'inherit' });
    console.log(`>>> Completed: ${cmd}`);
  } catch (e) {
    console.error(`>>> Failed: ${cmd}`);
    console.error(e.message);
  }
}

function onChange() {
  console.log('\n=== Change detected in products.csv ===');
  console.log('Starting auto-update...');
  
  // Step 1: Fetch images
  runCommand('node fetch_all_photos_auto.js');
  
  // Step 2: Generate catalog and push
  runCommand('node auto_sync.js');
  
  console.log('\n=== Auto-update complete! ===');
  console.log('Watching for next change...');
}

// Check if CSV exists
if (!fs.existsSync(CSV_PATH)) {
  console.error('products.csv not found!');
  process.exit(1);
}

// Start watching
const watcher = chokidar.watch(CSV_PATH, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true
});

watcher.on('change', onChange);
watcher.on('error', (error) => console.error('Watcher error:', error));

console.log('Watcher is running. Update your products.csv to trigger auto-update.');
console.log('(Keep this Command Prompt window open.)');