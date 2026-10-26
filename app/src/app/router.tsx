import { createRootRoute, createRouter, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { AppShell } from '@/app/AppShell';
import { Route as IndexRoute } from '@/app/routes/index';
import { Route as SetupRoute } from '@/app/routes/setup';
import { Route as LogsRoute } from '@/app/routes/logs';
import { Route as OrderRoute } from '@/app/routes/order';
import { Route as SettingsRoute } from '@/app/routes/settings';

export const rootRoute = createRootRoute({
  component: () => (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <TanStackRouterDevtools />
    </>
  ),
});

const routeTree = rootRoute.addChildren([
  IndexRoute,
  SetupRoute,
  OrderRoute,
  LogsRoute,
  SettingsRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
