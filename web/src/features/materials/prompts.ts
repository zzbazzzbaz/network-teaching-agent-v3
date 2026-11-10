import type { MaterialCollectionKind, MaterialNodeDetail } from '@/api/types';

export type MaterialChatMode = 'course' | 'exam';

export function materialChatMode(kind: MaterialCollectionKind): MaterialChatMode {
  return kind === 'question_bank' ? 'exam' : 'course';
}

function scopedTitle(detail: MaterialNodeDetail): string {
  const folders = detail.breadcrumbs
    .filter((item) => item.kind === 'folder')
    .map((item) => item.title);
  return [...folders, detail.title].join(' / ');
}

export function buildNodePrompt(detail: MaterialNodeDetail, selectedText?: string): string {
  const lines = [
    `我正在学习《${detail.collection.title}》「${scopedTitle(detail)}」。`,
    `资料路径：${detail.path}`,
    '',
    '请先阅读这一节，再回答我的问题：',
  ];
  const selection = selectedText?.trim();
  if (selection) {
    lines.push('', '我选中的内容是：', selection, '', '请解释这段内容。');
  }
  return lines.join('\n');
}

export function buildImagePrompt(detail: MaterialNodeDetail, filename: string): string {
  return [
    `请解释《${detail.collection.title}》「${detail.title}」里的图片 \`${filename}\`，`,
    '并结合这一节内容说明它想表达什么。',
    `资料路径：${detail.path}`,
  ].join('\n');
}

export function materialChatHref(detail: MaterialNodeDetail, prompt: string): string {
  const params = new URLSearchParams({
    mode: materialChatMode(detail.collection.kind),
    prompt,
  });
  return `/chat?${params.toString()}`;
}
