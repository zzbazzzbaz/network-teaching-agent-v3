import { Typography } from 'antd';
import type { ReactNode } from 'react';

import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      <div className={styles.mark} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <Typography.Text strong>{title}</Typography.Text>
      {description ? (
        <Typography.Paragraph type="secondary" className={styles.description}>
          {description}
        </Typography.Paragraph>
      ) : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
