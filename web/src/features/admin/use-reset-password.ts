import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useNavigate } from 'react-router';

import { resetPassword } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import { defaultPassword } from '@/lib/password';
import { useAuthStore } from '@/stores/auth-store';

export function useResetPassword() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const markPasswordChangeRequired = useAuthStore(
    (state) => state.markPasswordChangeRequired,
  );

  return (target: { id: string; username: string }) => {
    modal.confirm({
      title: `确认重置 ${target.username} 的密码？`,
      content: `重置后密码为：${defaultPassword(target.username)}，用户下次登录需要修改密码。`,
      okText: '重置密码',
      cancelText: '取消',
      onOk: async () => {
        try {
          await resetPassword(target.id);
          message.success('密码已重置');
          void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
          void queryClient.invalidateQueries({ queryKey: ['admin-user', target.id] });
          if (target.id === currentUser?.id) {
            markPasswordChangeRequired();
            navigate('/change-password');
          }
        } catch (error) {
          message.error(toErrorMessage(error, '重置密码失败'));
          throw error;
        }
      },
    });
  };
}
