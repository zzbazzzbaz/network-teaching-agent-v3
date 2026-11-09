import { FileTextOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { Tree } from 'antd';
import type { TreeDataNode } from 'antd';

import { TEXTBOOK_TREE } from './textbook-tree';
import type { TextbookNode } from './types';

interface TextbookTreeProps {
  onPick: (prompt: string) => void;
}

interface TextbookTreeNode extends TreeDataNode {
  prompt: string;
}

function buildTreeData(nodes: TextbookNode[]): TextbookTreeNode[] {
  return nodes.map((node) => ({
    key: node.key,
    title: (
      <span className={node.type === 'dir' ? 'font-medium text-ink' : 'text-ink-muted'}>
        {node.title}
      </span>
    ),
    icon: node.type === 'dir' ? <FolderOpenOutlined /> : <FileTextOutlined />,
    children: node.children.length > 0 ? buildTreeData(node.children) : undefined,
    prompt: node.prompt,
  }));
}

function buildPromptMap(nodes: TextbookNode[], prompts: Map<string, string>): void {
  for (const node of nodes) {
    prompts.set(node.key, node.prompt);
    buildPromptMap(node.children, prompts);
  }
}

const TREE_DATA = buildTreeData(TEXTBOOK_TREE);
const PROMPTS = (() => {
  const result = new Map<string, string>();
  buildPromptMap(TEXTBOOK_TREE, result);
  return result;
})();

export function TextbookTree({ onPick }: TextbookTreeProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium text-ink-muted">计算机网络（第8版）</span>
        <span className="text-[11px] text-ink-subtle">点击目录填入输入框</span>
      </div>
      <div className="max-h-[320px] overflow-y-auto pr-1">
        <Tree
          showIcon
          blockNode
          defaultExpandAll={false}
          selectedKeys={[]}
          treeData={TREE_DATA}
          onSelect={(keys) => {
            const prompt = PROMPTS.get(String(keys[0]));
            if (prompt) {
              onPick(prompt);
            }
          }}
        />
      </div>
    </div>
  );
}
