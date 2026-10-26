import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '@/app/router';
import { IndexPage } from '@/app/index-page';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});
