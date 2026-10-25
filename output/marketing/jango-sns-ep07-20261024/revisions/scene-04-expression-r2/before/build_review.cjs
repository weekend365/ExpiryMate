/* global require, __dirname, Buffer, console, process */
const path = require('node:path');
const sharp = require('../../../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');

(async () => {
  const width = 360, height = 640, gutter = 18, top = 38;
  const layers = [];
  for (let i = 1; i <= 5; i++) {
    const number = String(i).padStart(2, '0');
    const source = path.join(__dirname, 'source-art', `scene-${number}-r1.png`);
    const preview = path.join(__dirname, 'review', `${number}-360.png`);
    await sharp(source)
      .resize(width, height, { fit: 'contain', background: '#f6f2e9' })
      .png()
      .toFile(preview);
    const x = gutter + (i - 1) * (width + gutter);
    layers.push({ input: preview, left: x, top });
    const label = Buffer.from(`<svg width="360" height="30"><text x="0" y="23" font-family="Arial,sans-serif" font-size="18" fill="#38453e">${number}</text></svg>`);
    layers.push({ input: label, left: x, top: 3 });
  }
  await sharp({ create: {
    width: gutter + 5 * (width + gutter), height: top + height + gutter,
    channels: 3, background: '#f6f2e9',
  } })
    .composite(layers)
    .jpeg({ quality: 92 })
    .toFile(path.join(__dirname, 'review', 'overview.jpg'));
  console.log('Saved five uniform-fit 360x640 previews and contact sheet; source bytes unchanged.');
})().catch(error => { console.error(error); process.exit(1); });
