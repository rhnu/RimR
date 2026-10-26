import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '@/app/router';
import { LogsPage } from '@/features/logs/LogsPage';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  component: LogsPage,
});
