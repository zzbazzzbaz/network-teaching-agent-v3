import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';

import { RouteErrorBoundary } from '@/app/error-boundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminLayout } from '@/features/admin';
import { RequireAdmin } from '@/features/auth/RequireAdmin';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequirePasswordChange } from '@/features/auth/RequirePasswordChange';
import { ChangePasswordPage } from '@/pages/change-password';
import { ChatPage } from '@/pages/chat/ChatPage';
import { LoginPage } from '@/pages/login/LoginPage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';

const MemoryPage = lazy(() =>
  import('@/pages/memory/MemoryPage').then((module) => ({ default: module.MemoryPage })),
);

const QuestionsPage = lazy(() =>
  import('@/pages/questions/QuestionsPage').then((module) => ({
    default: module.QuestionsPage,
  })),
);

const QuestionDetailPage = lazy(() =>
  import('@/pages/questions/QuestionDetailPage').then((module) => ({
    default: module.QuestionDetailPage,
  })),
);

const StatsPage = lazy(() =>
  import('@/pages/stats/StatsPage').then((module) => ({ default: module.StatsPage })),
);

const AdminOverviewPage = lazy(() =>
  import('@/pages/admin/AdminOverviewPage').then((module) => ({
    default: module.AdminOverviewPage,
  })),
);

const AdminUsersPage = lazy(() =>
  import('@/pages/admin/AdminUsersPage').then((module) => ({
    default: module.AdminUsersPage,
  })),
);

const AdminUserDetailPage = lazy(() =>
  import('@/pages/admin/AdminUserDetailPage').then((module) => ({
    default: module.AdminUserDetailPage,
  })),
);

const AdminSessionDetailPage = lazy(() =>
  import('@/pages/admin/AdminSessionDetailPage').then((module) => ({
    default: module.AdminSessionDetailPage,
  })),
);

const AdminQuestionsPage = lazy(() =>
  import('@/pages/admin/AdminQuestionsPage').then((module) => ({
    default: module.AdminQuestionsPage,
  })),
);

const AdminQuestionDetailPage = lazy(() =>
  import('@/pages/admin/AdminQuestionDetailPage').then((module) => ({
    default: module.AdminQuestionDetailPage,
  })),
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/change-password',
    element: (
      <RequireAuth>
        <ChangePasswordPage />
      </RequireAuth>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <RequirePasswordChange>
          <AppLayout />
        </RequirePasswordChange>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/chat" replace />,
      },
      {
        path: 'chat',
        element: <ChatPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'chat/:sessionId',
        element: <ChatPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'memory',
        element: <MemoryPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'questions',
        element: <QuestionsPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'questions/:questionId',
        element: <QuestionDetailPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'stats',
        element: <StatsPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'admin',
        element: (
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        ),
        children: [
          {
            index: true,
            element: <AdminOverviewPage />,
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'users',
            element: <AdminUsersPage />,
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'users/:userId',
            element: <AdminUserDetailPage />,
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'users/:userId/sessions/:sessionId',
            element: <AdminSessionDetailPage />,
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'questions',
            element: <AdminQuestionsPage />,
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'questions/:questionId',
            element: <AdminQuestionDetailPage />,
            errorElement: <RouteErrorBoundary />,
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
