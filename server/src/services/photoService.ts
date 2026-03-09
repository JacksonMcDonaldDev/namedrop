import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const PHOTOS_DIR = path.join(__dirname, '..', '..', 'uploads', 'photos');

export async function processAndSave(file: Express.Multer.File, contactId: string): Promise<string> {
  await fs.mkdir(PHOTOS_DIR, { recursive: true });

  const filename = `${contactId}.jpg`;
  const outputPath = path.join(PHOTOS_DIR, filename);

  await sharp(file.buffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .rotate() // auto-rotate based on EXIF, then strip
    .toFile(outputPath);

  return `/uploads/photos/${filename}`;
}

export async function deletePhoto(contactId: string): Promise<void> {
  const filePath = path.join(PHOTOS_DIR, `${contactId}.jpg`);
  try {
    await fs.unlink(filePath);
  } catch {
    // File may not exist, ignore
  }
}
