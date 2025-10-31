const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const config = {
  landscape: {
    dir: path.join(__dirname, '../public/photos/landscape'),
    maxWidth: 2000,
    maxHeight: 1500
  },
  portrait: {
    dir: path.join(__dirname, '../public/photos/portrait'),
    maxWidth: 1500,
    maxHeight: 2000
  }
};

async function resizeImages(type) {
  const { dir, maxWidth, maxHeight } = config[type];

  try {
    const files = await fs.readdir(dir);
    const imageFiles = files.filter(file =>
      /\.(jpg|jpeg|png|webp|avif)$/i.test(file)
    );

    console.log(`\nProcessing ${imageFiles.length} ${type} images...`);

    for (const file of imageFiles) {
      const inputPath = path.join(dir, file);
      const stats = await fs.stat(inputPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      // skip if already small (under 1MB = already resized)
      if (stats.size < 1024 * 1024) {
        console.log(`⊘ ${file}: ${sizeMB}MB (skipped - already optimized)`);
        continue;
      }

      try {
        // resize and optimize
        await sharp(inputPath)
          .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 85, mozjpeg: true })
          .toFile(inputPath + '.tmp');

        // replace original with resized
        await fs.rename(inputPath + '.tmp', inputPath);

        const newStats = await fs.stat(inputPath);
        const newSizeMB = (newStats.size / 1024 / 1024).toFixed(2);

        console.log(`✓ ${file}: ${sizeMB}MB → ${newSizeMB}MB`);
      } catch (err) {
        console.error(`✗ Failed to process ${file}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`Error processing ${type} directory:`, err.message);
  }
}

async function main() {
  console.log('Starting image resize...');
  await resizeImages('landscape');
  await resizeImages('portrait');
  console.log('\nDone!');
}

main();
