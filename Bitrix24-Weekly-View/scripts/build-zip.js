/**
 * Build script for Bitrix24 Static App ZIP
 * Creates a ZIP file ready to upload to Bitrix24
 */

import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, copyFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const distDir = join(rootDir, 'dist');
const buildDir = join(rootDir, 'build');
const zipName = 'bitrix24-booking-weekly-view.zip';

// Ensure build directory exists
function ensureDir(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

// Copy directory recursively
function copyDir(src, dest) {
    ensureDir(dest);
    const entries = readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

// Copy file
function copyFile(src, dest) {
    const destDir = dirname(dest);
    ensureDir(destDir);
    copyFileSync(src, dest);
}

console.log('📦 Building Bitrix24 Static App...\n');

// Clean build directory
if (existsSync(buildDir)) {
    console.log('Cleaning build directory...');
    execSync(`rmdir /s /q "${buildDir}"`, { stdio: 'inherit', shell: true });
}
ensureDir(buildDir);

// Copy index.html to root of build (required by Bitrix24)
console.log('Copying index.html...');
const indexContent = readFileSync(join(rootDir, 'public', 'index.html'), 'utf-8');
// Update paths for flat structure
const updatedIndex = indexContent
    .replace('./dist/styles/weekly-view.css', './styles/weekly-view.css')
    .replace('./dist/app.js', './app.js');
    
const fs = await import('fs');
fs.writeFileSync(join(buildDir, 'index.html'), updatedIndex);

// Copy compiled JS files
console.log('Copying JavaScript files...');
function copyJsFiles(srcPath, destPath) {
    ensureDir(destPath);
    const entries = readdirSync(srcPath, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcFile = join(srcPath, entry.name);
        const destFile = join(destPath, entry.name);
        
        if (entry.isDirectory()) {
            copyJsFiles(srcFile, destFile);
        } else if (entry.name.endsWith('.js')) {
            copyFileSync(srcFile, destFile);
            console.log(`  - ${relative(distDir, srcFile)}`);
        }
    }
}
copyJsFiles(distDir, buildDir);

// Copy styles
console.log('Copying styles...');
const stylesDir = join(buildDir, 'styles');
ensureDir(stylesDir);
copyFileSync(
    join(srcDir, 'styles', 'weekly-view.css'),
    join(stylesDir, 'weekly-view.css')
);

// Create ZIP file
console.log('\nCreating ZIP file...');
const zipPath = join(rootDir, zipName);

// Use PowerShell to create ZIP (works on Windows)
try {
    if (existsSync(zipPath)) {
        execSync(`del "${zipPath}"`, { shell: true });
    }
    execSync(
        `powershell -Command "Compress-Archive -Path '${buildDir}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'inherit', shell: true }
    );
    console.log(`\n✅ ZIP created: ${zipName}`);
} catch (error) {
    console.error('Failed to create ZIP. You can manually zip the /build folder.');
    console.log(`\n📁 Build folder ready at: ${buildDir}`);
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 To deploy to Bitrix24:

1. Go to your Bitrix24 portal
2. Navigate to: Developer resources → Add application
3. Select: "Static" (not Server)
4. Upload: ${zipName}
5. Set Menu item text: "Booking Weekly"
6. Add permissions: CRM (crm)
7. Click Save

Your app will appear in the left menu!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
