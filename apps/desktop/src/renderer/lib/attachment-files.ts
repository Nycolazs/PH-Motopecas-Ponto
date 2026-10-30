/** Same limits as the API (absence-justifications.service.ts). */
export const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_CERTIFICATE = 5;
export const ATTACHMENT_ACCEPT =
  'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf';

/** Photos above this are reduced before upload; the text of an atestado stays legible. */
const MAX_PHOTO_SIDE = 2400;
const REDUCE_PHOTOS_ABOVE_BYTES = 2.5 * 1024 * 1024;

export interface PreparedAttachment {
  fileName: string;
  dataBase64: string;
  byteSize: number;
  isImage: boolean;
}

export class AttachmentFileError extends Error {}

function kindOf(file: File): 'image' | 'pdf' | null {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (/^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/.test(name)) {
    return 'image';
  }
  return null;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new AttachmentFileError('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(blob);
  });
}

/** Re-encodes a large photo as JPEG, respecting the camera orientation. */
async function reducePhoto(file: File): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') return null;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(
    () => null,
  );
  if (bitmap === null) return null;
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= REDUCE_PHOTOS_ABOVE_BYTES) {
    bitmap.close();
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85));
}

export async function prepareAttachment(file: File): Promise<PreparedAttachment> {
  const kind = kindOf(file);
  if (kind === null) {
    throw new AttachmentFileError(
      `"${file.name}" não é aceito. Envie uma foto (JPG, PNG ou WebP) ou um PDF.`,
    );
  }
  let contents: Blob = file;
  let fileName = file.name;
  if (kind === 'image') {
    const reduced = await reducePhoto(file);
    if (reduced !== null) {
      contents = reduced;
      fileName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    }
  }
  if (contents.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentFileError(`"${file.name}" tem mais de 7 MB.`);
  }
  return {
    fileName,
    dataBase64: await readAsDataUrl(contents),
    byteSize: contents.size,
    isImage: kind === 'image',
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}
