import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';

import { RouteErrorBoundary } from '@/app/error-boundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/features/auth/RequireAuth';
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

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
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
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
