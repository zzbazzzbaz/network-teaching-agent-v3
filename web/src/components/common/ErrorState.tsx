import { Button, Result } from 'antd';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({
  title = '加载失败',
  message = '请检查网络后重试',
  onRetry,
  compact = false,
}: ErrorStateProps) {
  return (
    <Result
      status="warning"
      title={title}
      subTitle={message}
      extra={
        onRetry ? (
          <Button onClick={onRetry} type="primary" ghost>
            重试
          </Button>
        ) : null
      }
      style={compact ? { padding: '24px 12px' } : undefined}
    />
  );
}
