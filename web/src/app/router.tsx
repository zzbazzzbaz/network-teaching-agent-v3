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

const KnowledgePage = lazy(() =>
  import('@/pages/knowledge/KnowledgePage').then((module) => ({
    default: module.KnowledgePage,
  })),
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

const AdminKnowledgePage = lazy(() =>
  import('@/pages/admin/AdminKnowledgePage').then((module) => ({
    default: module.AdminKnowledgePage,
  })),
);

const AdminMaterialsPage = lazy(() =>
  import('@/pages/admin/AdminMaterialsPage').then((module) => ({
    default: module.AdminMaterialsPage,
  })),
);

const LearnIndexPage = lazy(() =>
  import('@/pages/learn').then((module) => ({ default: module.LearnIndexPage })),
);

const LearnPage = lazy(() =>
  import('@/pages/learn').then((module) => ({ default: module.LearnPage })),
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
        path: 'knowledge',
        element: <KnowledgePage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'learn',
        element: <LearnIndexPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'learn/:nodeId',
        element: <LearnPage />,
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
            path: 'knowledge',
            element: <AdminKnowledgePage />,
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'materials',
            element: <AdminMaterialsPage />,
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
