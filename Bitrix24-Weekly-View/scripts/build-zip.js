/**
 * Build script for Bitrix24 Static App ZIP
 * Creates a ZIP file ready to upload to Bitrix24
 */

import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const zipName = 'bitrix24-booking-weekly-view.zip';
const distIndex = join(distDir, 'index.html');
const distAssets = join(distDir, 'assets');

console.log('📦 Packaging Bitrix24 Static App...\n');

if (!existsSync(distDir)) {
   console.error('dist/ not found. Run the build before packaging.');
   process.exit(1);
}

if (!existsSync(distIndex) || !existsSync(distAssets)) {
   console.error('dist/ must include index.html and assets/. Run the build before packaging.');
   process.exit(1);
}

console.log('Creating ZIP file...');
const zipPath = join(rootDir, '..', zipName);

try {
   if (existsSync(zipPath)) {
      unlinkSync(zipPath);
   }
   execSync(
      `powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit', shell: true }
   );
   console.log(`\n✅ ZIP created: ${zipName}`);
} catch (error) {
   console.error('Failed to create ZIP. You can manually zip the dist/ folder.');
   console.log(`\n📁 Build folder ready at: ${distDir}`);
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
