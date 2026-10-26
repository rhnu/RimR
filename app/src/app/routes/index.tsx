import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '@/app/router';
import { IndexPage } from '@/app/IndexPage';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});
