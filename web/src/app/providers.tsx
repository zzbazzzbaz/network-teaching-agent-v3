import { StyleProvider } from '@ant-design/cssinjs';
import { XProvider } from '@ant-design/x';
import xZhCN from '@ant-design/x/locale/zh_CN';
import { QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp } from 'antd';
import type { ThemeConfig } from 'antd';
import antdZhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';

import { queryClient } from '@/lib/query-client';

const locale = { ...antdZhCN, ...xZhCN };

const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#0E6B60',
    colorPrimaryHover: '#0A4F47',
    colorPrimaryActive: '#083E38',
    colorPrimaryBg: '#E7F1EE',
    colorPrimaryBgHover: '#D9EAE5',
    colorPrimaryBorder: '#B9D8D1',
    colorPrimaryBorderHover: '#8DBFB5',
    colorPrimaryText: '#0E6B60',
    colorPrimaryTextHover: '#0A4F47',
    colorInfo: '#0E6B60',
    colorInfoBg: '#E7F1EE',
    colorInfoBorder: '#B9D8D1',
    colorInfoText: '#0E6B60',
    colorSuccess: '#1E7A52',
    colorSuccessBg: '#E9F3EE',
    colorSuccessBorder: '#BBDCC9',
    colorSuccessText: '#1E7A52',
    colorWarning: '#9A5900',
    colorWarningBg: '#FBF1DC',
    colorWarningBorder: '#E6CD9B',
    colorWarningText: '#8A5E12',
    colorError: '#B42318',
    colorErrorBg: '#FDECEB',
    colorErrorBorder: '#F2C3BF',
    colorErrorText: '#B42318',
    colorTextBase: '#121A1C',
    colorText: '#121A1C',
    colorTextSecondary: '#46575A',
    colorTextTertiary: '#5C6E70',
    colorTextQuaternary: '#8A999A',
    colorBgLayout: '#F3F5F3',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBgSpotlight: '#121A1C',
    colorBorder: '#DCE4E2',
    colorBorderSecondary: '#E7ECEA',
    colorSplit: '#E7ECEA',
    colorFillAlter: '#F0F4F2',
    colorFillSecondary: '#EFF3F1',
    colorFillTertiary: '#F4F7F5',
    colorFillQuaternary: '#F7F9F8',
    colorLink: '#0E6B60',
    colorLinkHover: '#0A4F47',
    colorLinkActive: '#083E38',
    controlOutline: 'rgba(14, 107, 96, 0.18)',
    borderRadius: 6,
    borderRadiusSM: 4,
    borderRadiusLG: 10,
    borderRadiusXS: 3,
    fontFamily:
      '"IBM Plex Sans", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif',
    fontFamilyCode: '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 17,
    fontSizeHeading5: 15,
    lineHeight: 1.6,
    lineHeightSM: 1.55,
    lineHeightLG: 1.5,
    controlHeight: 32,
    controlHeightSM: 24,
    controlHeightLG: 40,
    boxShadow: '0 1px 2px rgba(18, 26, 28, 0.04)',
    boxShadowSecondary:
      '0 12px 32px -12px rgba(18, 26, 28, 0.22), 0 2px 8px rgba(18, 26, 28, 0.06)',
    wireframe: false,
  },
  components: {
    Layout: {
      bodyBg: '#F3F5F3',
      headerBg: '#FFFFFF',
      siderBg: '#F3F5F3',
      headerHeight: 60,
      headerPadding: '0 24px',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: '#E7F1EE',
      itemSelectedColor: '#0A4F47',
      itemHoverBg: '#F0F4F2',
      itemHoverColor: '#121A1C',
      itemHeight: 36,
      itemBorderRadius: 6,
      itemMarginInline: 0,
    },
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      fontWeight: 500,
      defaultBg: '#FFFFFF',
      defaultColor: '#2E4044',
      defaultBorderColor: '#DCE4E2',
      defaultHoverBg: '#F4F7F5',
      defaultHoverColor: '#0A4F47',
      defaultHoverBorderColor: '#B9D8D1',
      defaultActiveBg: '#E7F1EE',
      defaultActiveColor: '#0A4F47',
      defaultActiveBorderColor: '#8DBFB5',
      textHoverBg: '#EDF2F0',
    },
    Card: {
      headerBg: 'transparent',
      bodyPadding: 20,
      bodyPaddingSM: 16,
      headerHeight: 52,
      headerHeightSM: 44,
    },
    Segmented: {
      trackBg: '#EDF2F0',
      trackPadding: 2,
      itemColor: '#46575A',
      itemHoverBg: '#E4EBE8',
      itemHoverColor: '#121A1C',
      itemActiveBg: '#E4EBE8',
      itemSelectedBg: '#FFFFFF',
      itemSelectedColor: '#121A1C',
    },
    Table: {
      headerBg: '#F0F4F2',
      headerColor: '#2E4044',
      headerSplitColor: 'transparent',
      headerSortActiveBg: '#E7ECEA',
      headerSortHoverBg: '#E7ECEA',
      borderColor: '#E7ECEA',
      rowHoverBg: '#F7F9F8',
      cellPaddingBlock: 9,
      cellPaddingInline: 14,
      cellPaddingBlockMD: 9,
      cellPaddingInlineMD: 12,
      cellPaddingBlockSM: 7,
      cellPaddingInlineSM: 10,
      cellFontSize: 13,
      cellFontSizeMD: 13,
      cellFontSizeSM: 12,
      headerBorderRadius: 0,
      footerBg: 'transparent',
      footerColor: '#5C6E70',
    },
    Tag: {
      defaultBg: '#EDF2F0',
      defaultColor: '#46575A',
      solidTextColor: '#FFFFFF',
    },
    Tabs: {
      itemColor: '#46575A',
      itemHoverColor: '#121A1C',
      itemSelectedColor: '#0A4F47',
      inkBarColor: '#0E6B60',
      titleFontSize: 13,
      titleFontSizeSM: 12,
      cardBg: '#F0F4F2',
    },
    Alert: {
      withDescriptionPadding: '14px 16px',
      defaultPadding: '10px 14px',
    },
    Collapse: {
      headerBg: 'transparent',
      contentBg: 'transparent',
    },
    Tooltip: {
      colorBgSpotlight: '#121A1C',
    },
  },
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StyleProvider layer>
      <QueryClientProvider client={queryClient}>
        <XProvider
          theme={themeConfig}
          locale={locale}
          direction="ltr"
          button={{ autoInsertSpace: false }}
          wave={{ disabled: true }}
        >
          <AntdApp>{children}</AntdApp>
        </XProvider>
      </QueryClientProvider>
    </StyleProvider>
  );
}
