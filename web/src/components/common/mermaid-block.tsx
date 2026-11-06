import { Mermaid } from '@ant-design/x';

export default function MermaidBlock({ code }: { code: string }) {
  return (
    <div className="my-3 overflow-x-auto rounded-card border border-line bg-surface p-2">
      <Mermaid>{code}</Mermaid>
    </div>
  );
}
