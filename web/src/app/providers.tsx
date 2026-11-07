import { StyleProvider } from '@ant-design/cssinjs';
import { XProvider } from '@ant-design/x';
import xZhCN from '@ant-design/x/locale/zh_CN';
import { QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp } from 'antd';
import antdZhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';

import { queryClient } from '@/lib/query-client';

const locale = { ...antdZhCN, ...xZhCN };

const themeConfig = {
  token: {
    colorPrimary: '#12586B',
    colorInfo: '#12586B',
    colorSuccess: '#1E7A52',
    colorWarning: '#9A6A16',
    colorError: '#B23A32',
    colorTextBase: '#101720',
    colorBgLayout: '#F6F7F8',
    colorBgContainer: '#FFFFFF',
    colorBorder: '#E4E8ED',
    colorBorderSecondary: '#E4E8ED',
    controlOutline: 'rgba(18, 88, 107, 0.16)',
    colorSuccessBg: '#E9F3EE',
    colorSuccessBorder: '#BBDCC9',
    colorSuccessText: '#1E7A52',
    colorInfoBg: '#EAF2F4',
    colorInfoBorder: '#BCD5DB',
    colorInfoText: '#12586B',
    colorWarningBg: '#FBF4E4',
    colorWarningBorder: '#E5D2A6',
    colorWarningText: '#8A5E12',
    colorErrorBg: '#FAECEB',
    colorErrorBorder: '#E6C2BE',
    colorErrorText: '#B23A32',
    borderRadius: 8,
    borderRadiusSM: 6,
    borderRadiusLG: 10,
    fontFamily:
      'ui-sans-serif, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    fontFamilyCode: 'ui-monospace, "JetBrains Mono", "SF Mono", "Cascadia Mono", monospace',
    fontSize: 15,
    controlHeight: 36,
    wireframe: false,
  },
  components: {
    Layout: {
      bodyBg: '#F6F7F8',
      headerBg: '#FFFFFF',
      siderBg: '#FFFFFF',
      headerHeight: 56,
      headerPadding: '0 24px',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: '#EAF2F4',
      itemSelectedColor: '#12586B',
      itemHoverBg: '#EFF2F4',
      itemHeight: 40,
    },
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
    },
    Card: {
      paddingLG: 20,
    },
    Segmented: {
      trackBg: '#EFF2F4',
      trackPadding: 2,
      itemColor: '#55606E',
      itemHoverBg: '#E4E8ED',
      itemHoverColor: '#101720',
      itemSelectedBg: '#FFFFFF',
      itemSelectedColor: '#101720',
    },
    Table: {
      headerBg: '#EFF2F4',
      headerSplitColor: 'transparent',
    },
  },
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StyleProvider layer>
      <QueryClientProvider client={queryClient}>
        <XProvider theme={themeConfig} locale={locale} direction="ltr">
          <AntdApp>{children}</AntdApp>
        </XProvider>
      </QueryClientProvider>
    </StyleProvider>
  );
}
