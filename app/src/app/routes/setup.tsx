import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '@/app/router';
import { SetupPage } from '@/features/setup/setup-page';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: SetupPage,
});
