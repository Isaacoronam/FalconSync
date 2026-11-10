import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = process.cwd();
const src = path.resolve(root, 'public/brand/falconsync-logo.png');
const outDir = path.resolve(root, 'public');

if (!fs.existsSync(src)) {
  throw new Error(`No se encontró el logo maestro: ${src}`);
}

const sizes = [16, 32, 48];
const faviconPngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(src)
      .resize(size, size, { fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer(),
  ),
);
const faviconIco = await pngToIco(faviconPngBuffers);

await sharp(src)
  .resize(48, 48, { fit: 'inside', withoutEnlargement: false })
  .png()
  .toFile(path.resolve(outDir, 'brand/falconsync-logo-48.png'));

await sharp(src)
  .resize(180, 180, { fit: 'inside', withoutEnlargement: false })
  .png()
  .toFile(path.resolve(outDir, 'apple-touch-icon.png'));

await sharp(src)
  .resize(32, 32, { fit: 'inside', withoutEnlargement: false })
  .png()
  .toFile(path.resolve(outDir, 'favicon-32.png'));

await fs.promises.writeFile(path.resolve(outDir, 'favicon.ico'), faviconIco);

console.log(
  '[brand:assets] Generados favicon.ico (16/32/48), favicon-32.png, ' +
    'apple-touch-icon.png (180x180) y brand/falconsync-logo-48.png desde ' +
    src,
);
