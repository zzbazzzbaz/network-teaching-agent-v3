import { MenuOutlined } from '@ant-design/icons';
import { Button, Layout } from 'antd';
import { useLocation } from 'react-router';

import { useIsMobile } from '@/lib/use-media-query';
import { useUiStore } from '@/stores/ui-store';

import styles from './AppHeader.module.css';

const PAGE_TITLES: Record<string, string> = {
  '/memory': '记忆',
  '/questions': '题库',
  '/stats': '统计',
};

export function AppHeader() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  const isQuestionDetail = location.pathname.startsWith('/questions/');
  const pageTitle = isQuestionDetail ? '题目详情' : (PAGE_TITLES[location.pathname] ?? '对话');

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
    </Layout.Header>
  );
}
