import { UPLOAD_MAX_BYTES, UPLOAD_MAX_COUNT } from '@/lib/config';

export const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/bmp';

const ALLOWED_TYPES = new Set(ACCEPTED_IMAGE_TYPES.split(','));

export interface FileSelection {
  accepted: File[];
  rejection: string | null;
}

export function selectFiles(files: File[], existingCount: number): FileSelection {
  const accepted: File[] = [];
  let rejection: string | null = null;

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      rejection = '只支持 PNG、JPG、WebP、GIF、BMP 图片';
      continue;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      rejection = '单张图片不能超过 100MB';
      continue;
    }
    accepted.push(file);
  }

  const remaining = Math.max(UPLOAD_MAX_COUNT - existingCount, 0);
  if (accepted.length > remaining) {
    rejection = `单条消息最多 ${UPLOAD_MAX_COUNT} 张图片`;
    accepted.splice(remaining);
  }

  return { accepted, rejection };
}
