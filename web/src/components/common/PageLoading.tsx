import { Spin, Typography } from 'antd';

import styles from './PageLoading.module.css';

export function PageLoading({ text = '正在加载' }: { text?: string }) {
  return (
    <div className={styles.root} role="status" aria-live="polite">
      <Spin />
      <Typography.Text type="secondary">{text}</Typography.Text>
    </div>
  );
}

export function InlineLoading({ text = '正在加载' }: { text?: string }) {
  return (
    <div className={styles.inline} role="status" aria-live="polite">
      <Spin size="small" />
      <span>{text}</span>
    </div>
  );
}
