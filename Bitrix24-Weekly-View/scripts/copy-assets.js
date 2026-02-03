/**
 * Copy static assets to dist and public folders
 */

import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcDir = join(__dirname, '..', 'src');
const distDir = join(__dirname, '..', 'dist');
const publicDir = join(__dirname, '..', 'public');

// Ensure directories exist
function ensureDir(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

// Copy CSS files to dist
function copyStyles() {
    const stylesDir = join(srcDir, 'styles');
    const distStylesDir = join(distDir, 'styles');

    ensureDir(distStylesDir);

    if (existsSync(stylesDir)) {
        const files = readdirSync(stylesDir);
        for (const file of files) {
            if (file.endsWith('.css')) {
                copyFileSync(
                    join(stylesDir, file),
                    join(distStylesDir, file)
                );
                console.log(`Copied: styles/${file} -> dist/styles/`);
            }
        }
    }
}

// Copy to public directory for deployment
function copyToPublic() {
    const publicDistDir = join(publicDir, 'dist');
    const publicStylesDir = join(publicDistDir, 'styles');

    ensureDir(publicDistDir);
    ensureDir(publicStylesDir);

    // Copy JS files
    if (existsSync(distDir)) {
        const files = readdirSync(distDir);
        for (const file of files) {
            if (file.endsWith('.js') || file.endsWith('.js.map')) {
                copyFileSync(
                    join(distDir, file),
                    join(publicDistDir, file)
                );
                console.log(`Copied: ${file} -> public/dist/`);
            }
        }

        // Copy subdirectories (like api, components, etc.)
        for (const item of files) {
            const itemPath = join(distDir, item);
            try {
                const stats = readdirSync(itemPath);
                // It's a directory
                const targetDir = join(publicDistDir, item);
                ensureDir(targetDir);
                for (const subFile of stats) {
                    if (subFile.endsWith('.js') || subFile.endsWith('.js.map')) {
                        copyFileSync(
                            join(itemPath, subFile),
                            join(targetDir, subFile)
                        );
                        console.log(`Copied: ${item}/${subFile} -> public/dist/${item}/`);
                    }
                }
            } catch {
                // Not a directory, skip
            }
        }
    }

    // Copy styles
    const distStylesDir = join(distDir, 'styles');
    if (existsSync(distStylesDir)) {
        const files = readdirSync(distStylesDir);
        for (const file of files) {
            copyFileSync(
                join(distStylesDir, file),
                join(publicStylesDir, file)
            );
            console.log(`Copied: styles/${file} -> public/dist/styles/`);
        }
    }

    console.log('\n✅ Assets copied to public/ directory for deployment');
}

// Run
console.log('📦 Copying static assets...\n');
copyStyles();
copyToPublic();
console.log('\nDone!');
