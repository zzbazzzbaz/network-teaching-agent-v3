import { Mermaid } from '@ant-design/x';

import styles from './CodeBlock.module.css';

export default function MermaidBlock({ code }: { code: string }) {
  return (
    <div className={styles.mermaid}>
      <Mermaid>{code}</Mermaid>
    </div>
  );
}
