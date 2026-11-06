import { MenuOutlined } from '@ant-design/icons';
import { App, Button, Layout, Tooltip } from 'antd';
import { useLocation, useParams } from 'react-router';

import { toErrorMessage } from '@/api/client';
import { stopSession } from '@/api/sessions';
import { useIsMobile } from '@/lib/use-media-query';
import { shortId } from '@/lib/format';
import type { SessionPhase } from '@/lib/agentscope/project';
import { useChatStore } from '@/stores/chat-store';
import { useUiStore } from '@/stores/ui-store';

import styles from './AppHeader.module.css';

const PHASE_LABELS: Record<SessionPhase, string> = {
  idle: '空闲',
  running: '生成中',
  awaiting_external_result: '等待作答',
  awaiting_permission: '等待确认',
  reconnecting: '重连中',
  error: '连接断开',
};

const PHASE_TONES: Record<SessionPhase, string> = {
  idle: styles.toneIdle,
  running: styles.toneRunning,
  awaiting_external_result: styles.toneWaiting,
  awaiting_permission: styles.toneWaiting,
  reconnecting: styles.toneWarning,
  error: styles.toneDanger,
};

const PAGE_TITLES: Record<string, string> = {
  '/memory': '记忆',
  '/questions': '题库',
  '/stats': '统计',
};

export function AppHeader() {
  const { message } = App.useApp();
  const location = useLocation();
  const params = useParams();
  const isMobile = useIsMobile();
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const runtime = useChatStore((state) => state.runtime);
  const phase = runtime?.phase ?? 'idle';

  const isQuestionDetail = location.pathname.startsWith('/questions/');
  const pageTitle = isQuestionDetail
    ? '题目详情'
    : (PAGE_TITLES[location.pathname] ?? (params.sessionId ? '对话' : '对话'));

  const showSession = Boolean(params.sessionId) && location.pathname.startsWith('/chat');

  const handleStop = async () => {
    if (!params.sessionId) {
      return;
    }
    try {
      await stopSession(params.sessionId);
      message.info('已停止生成');
    } catch (error) {
      message.error(toErrorMessage(error, '终止失败，请重试'));
    }
  };

  return (
    <Layout.Header className={styles.header}>
      <div className={styles.left}>
        {isMobile ? (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={toggleSidebar}
            aria-label="打开导航"
          />
        ) : null}
        <h1 className={styles.title}>{pageTitle}</h1>
      </div>

      {showSession && runtime ? (
        <div className={styles.instrument} role="status" aria-live="polite">
          <span className={`data-text ${styles.sessionId}`}>
            session/{shortId(params.sessionId, 6)}
          </span>
          <span className={`${styles.dot} ${PHASE_TONES[phase]}`} aria-hidden="true" />
          <span className={styles.phase}>{PHASE_LABELS[phase]}</span>
          {phase === 'running' ? (
            <Tooltip title="终止本轮生成">
              <Button size="small" onClick={() => void handleStop()}>
                停止生成
              </Button>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
    </Layout.Header>
  );
}
