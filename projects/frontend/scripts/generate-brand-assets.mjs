import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = process.cwd();
const sourceDir = path.resolve(root, 'design/source');
const brandDir = path.resolve(root, 'src/assets/brand');
const assetsDir = path.resolve(root, 'src/assets');
const imagesDir = path.resolve(root, 'src/assets/images');

const logoSource = path.join(sourceDir, 'falconsync-logo-source.png');
const chivitoSource = path.join(sourceDir, 'chivito-sheet.png');
const fondoSource = path.join(sourceDir, 'fondo-medanos-source.png');

for (const file of [logoSource, chivitoSource, fondoSource]) {
  if (!fs.existsSync(file)) {
    throw new Error(`No se encontró el recurso maestro: ${file}`);
  }
}

await fs.promises.mkdir(brandDir, { recursive: true });
await fs.promises.mkdir(imagesDir, { recursive: true });

/**
 * El PNG del logo trae un damero incrustado alrededor del badge. Se recorta el
 * borde oscuro, se centra en un lienzo transparente y se aplica una máscara
 * circular con un aro del mismo marrón del logo. Así el damero desaparece y el
 * archivo puede usarse sobre fondos oscuros.
 */
const LOGO_BBOX = { left: 59, top: 27, width: 1109, height: 1135 };
const LOGO_RING = '#3a1a0c';
const logoSide = Math.max(LOGO_BBOX.width, LOGO_BBOX.height);
const logoPadLeft = Math.floor((logoSide - LOGO_BBOX.width) / 2);
const logoSquare = await sharp(logoSource)
  .extract(LOGO_BBOX)
  .extend({
    top: 0,
    bottom: 0,
    left: logoPadLeft,
    right: logoSide - LOGO_BBOX.width - logoPadLeft,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();
const logoMaskRadius = logoSide / 2 - 8;
const logoMask = Buffer.from(
  `<svg width="${logoSide}" height="${logoSide}" viewBox="0 0 ${logoSide} ${logoSide}"><circle cx="${logoSide / 2}" cy="${logoSide / 2}" r="${logoMaskRadius}" fill="#ffffff"/></svg>`,
);
const logoRing = Buffer.from(
  `<svg width="${logoSide}" height="${logoSide}" viewBox="0 0 ${logoSide} ${logoSide}"><circle cx="${logoSide / 2}" cy="${logoSide / 2}" r="${logoMaskRadius - 6}" fill="none" stroke="${LOGO_RING}" stroke-width="12"/></svg>`,
);
const logoMaster = await sharp(logoSquare)
  .ensureAlpha()
  .composite([{ input: logoMask, blend: 'dest-in' }, { input: logoRing }])
  .png()
  .toBuffer();

await sharp(logoMaster)
  .resize(512, 512)
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(path.join(brandDir, 'falconsync-logo.png'));

await sharp(logoMaster)
  .resize(128, 128)
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandDir, 'falconsync-logo-128.png'));

await sharp(logoMaster)
  .resize(48, 48)
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandDir, 'falconsync-logo-48.png'));

// Variante compacta de la cabeza: se conserva para contextos donde el badge
// completo no sea legible. El header y el favicon usan el logo oficial.
const HEAD_CROP = { left: 200, top: 40, width: 460, height: 460 };
const headMask = Buffer.from(
  '<svg width="460" height="460"><circle cx="230" cy="230" r="228" fill="#ffffff"/></svg>',
);
const headMaster = await sharp(logoMaster)
  .resize(1024, 1024)
  .extract(HEAD_CROP)
  .ensureAlpha()
  .composite([{ input: headMask, blend: 'dest-in' }])
  .png()
  .toBuffer();

await sharp(headMaster)
  .resize(256, 256)
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandDir, 'falconsync-mark.png'));

await sharp(headMaster)
  .resize(96, 96)
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandDir, 'falconsync-mark-96.png'));

// El favicon usa el logo oficial completo: su aro oscuro, el sol naranja y la
// silueta del personaje se reconocen mejor en la pestaña que un recorte de cara.
await sharp(logoMaster)
  .resize(32, 32)
  .png({ compressionLevel: 9 })
  .toFile(path.join(assetsDir, 'favicon-32.png'));

const faviconSizes = [16, 32, 48];
const faviconPngBuffers = await Promise.all(
  faviconSizes.map((size) =>
    sharp(logoMaster).resize(size, size, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer(),
  ),
);
await fs.promises.writeFile(path.join(assetsDir, 'favicon.ico'), await pngToIco(faviconPngBuffers));

const appleLogo = await sharp(logoMaster).resize(140, 140).png().toBuffer();
await sharp({
  create: {
    width: 180,
    height: 180,
    channels: 4,
    background: '#fbf7ef',
  },
})
  .composite([{ input: appleLogo, gravity: 'center' }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(assetsDir, 'apple-touch-icon.png'));

/**
 * Recortes de la hoja de personaje. Se conserva la pose completa en un marco
 * claro; el avatar se recorta en círculo y la bienvenida se aplana sobre blanco.
 * El resto de las ilustraciones conserva el fondo claro y el CSS las mezcla
 * sobre superficies crema.
 */
async function cropChivito({
  name,
  left,
  top,
  width,
  height,
  format = 'webp',
  whiteBackground = false,
}) {
  const pipeline = sharp(chivitoSource).extract({ left, top, width, height });
  if (format === 'webp') {
    if (whiteBackground) {
      const cropped = await pipeline.png().toBuffer();
      await fs.promises.writeFile(
        path.join(brandDir, `${name}.webp`),
        await flattenWelcomeBackground(cropped),
      );
      return;
    }

    await pipeline.webp({ quality: 90, effort: 6 }).toFile(path.join(brandDir, `${name}.webp`));
    return;
  }

  await pipeline.png({ compressionLevel: 9 }).toFile(path.join(brandDir, `${name}.png`));
}

/**
 * La hoja de personaje trae un marco gris (#f0f0f0). La bienvenida se muestra
 * sobre una tarjeta blanca, así que se retira el fondo conectado a los bordes
 * con una tolerancia baja, se suaviza la máscara para evitar halos y se aplana
 * sobre blanco. Los colores del personaje no se tocan.
 */
async function flattenWelcomeBackground(input) {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const background = [240, 240, 240];
  const tolerance = 14;
  const isBackground = (offset) => {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];

    return (
      Math.max(
        Math.abs(red - background[0]),
        Math.abs(green - background[1]),
        Math.abs(blue - background[2]),
      ) <= tolerance
    );
  };

  const visited = new Uint8Array(width * height);
  const queue = [];
  const enqueue = (x, y) => {
    const pixel = y * width + x;

    if (visited[pixel] || !isBackground(pixel * channels)) {
      return;
    }

    visited[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const pixel = queue[index];
    const x = pixel % width;
    const y = Math.floor(pixel / width);

    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }

  const mask = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    mask[offset] = 255;
    mask[offset + 1] = 255;
    mask[offset + 2] = 255;
    mask[offset + 3] = visited[pixel] ? 0 : 255;
  }

  const softMask = await sharp(mask, { raw: { width, height, channels: 4 } })
    .blur(0.8)
    .png()
    .toBuffer();

  const cutout = await sharp(input)
    .ensureAlpha()
    .composite([{ input: softMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  return sharp(cutout)
    .flatten({ background: '#ffffff' })
    .webp({ quality: 90, effort: 6 })
    .toBuffer();
}

await cropChivito({
  name: 'chivito-avatar-raw',
  left: 1160,
  top: 0,
  width: 330,
  height: 300,
  format: 'png',
});
await cropChivito({
  name: 'chivito-welcome',
  left: 10,
  top: 20,
  width: 380,
  height: 930,
  whiteBackground: true,
});
await cropChivito({ name: 'chivito-thinking', left: 1120, top: 600, width: 330, height: 180 });
await cropChivito({ name: 'chivito-surprise', left: 1120, top: 305, width: 340, height: 250 });
await cropChivito({ name: 'chivito-celebration', left: 1160, top: 810, width: 376, height: 214 });

// El avatar se recorta en círculo para que el fondo claro de la hoja no compita
// con el encabezado del chat.
const avatarSize = 300;
const avatarMask = Buffer.from(
  `<svg width="${avatarSize}" height="${avatarSize}"><circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2 - 1}" fill="#ffffff"/></svg>`,
);
const avatarMasked = await sharp(path.join(brandDir, 'chivito-avatar-raw.png'))
  .extract({ left: 0, top: 0, width: avatarSize, height: avatarSize })
  .ensureAlpha()
  .composite([{ input: avatarMask, blend: 'dest-in' }])
  .png()
  .toBuffer();
await sharp(avatarMasked)
  .resize(256, 256)
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandDir, 'chivito-avatar.png'));
await fs.promises.unlink(path.join(brandDir, 'chivito-avatar-raw.png'));

// Fondo de Médanos: se sirve optimizado y sin deformar.
await sharp(fondoSource)
  .webp({ quality: 82, effort: 6 })
  .toFile(path.join(imagesDir, 'fondo-medanos.webp'));

console.log(
  '[brand:assets] Generados logo circular, marca de cabeza, favicons, avatar, poses de Chivito (bienvenida sobre blanco) y fondo de Médanos.',
);
