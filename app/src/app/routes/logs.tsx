import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '@/app/router';
import { LogsPage } from '@/features/logs/logs-page';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  component: LogsPage,
});
