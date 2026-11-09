export type TextbookNodeType = 'dir' | 'file';

export interface TextbookNode {
  key: string;
  title: string;
  type: TextbookNodeType;
  prompt: string;
  children: TextbookNode[];
}
