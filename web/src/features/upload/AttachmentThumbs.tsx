import { CloseOutlined, ReloadOutlined } from '@ant-design/icons';

export interface AttachmentThumbItem {
  uid: string;
  previewUrl: string;
  status: 'uploading' | 'completing' | 'ready' | 'error';
  percent?: number;
}

export interface AttachmentThumbsProps {
  items: AttachmentThumbItem[];
  disabled?: boolean;
  onRemove: (uid: string) => void;
  onRetry?: (uid: string) => void;
}

export function AttachmentThumbs({ items, disabled, onRemove, onRetry }: AttachmentThumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-2.5">
      {items.map((item) => (
        <div
          key={item.uid}
          className="group relative size-14 overflow-hidden rounded-chip border border-line bg-surface-sunken"
        >
          <img src={item.previewUrl} alt="" className="size-full object-cover" />
          {item.status === 'error' ? (
            <button
              type="button"
              className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/55 text-[10px] text-white"
              onClick={() => onRetry?.(item.uid)}
              disabled={disabled}
            >
              <ReloadOutlined aria-hidden="true" />
              <span>重试</span>
            </button>
          ) : item.status === 'ready' ? null : (
            <div className="absolute inset-0 grid place-items-center bg-black/45 font-code text-[10px] text-white">
              {item.status === 'completing' ? '处理中' : `${item.percent ?? 0}%`}
            </div>
          )}
          <button
            type="button"
            aria-label="移除图片"
            className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => onRemove(item.uid)}
            disabled={disabled}
          >
            <CloseOutlined style={{ fontSize: 8 }} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
