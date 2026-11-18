import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { LogsPage } from '@/features/logs/logs-page';
import { OrderPage } from '@/features/order/order-page';
import { PathSettingsProvider } from '@/features/settings/path-settings-provider';
import { SettingsPage } from '@/features/settings/settings-page';
import { SetupPage } from '@/features/setup/setup-page';
import { AppShell } from './app-shell';
import { IndexPage } from './index-page';

const rootRoute = createRootRoute({
  component: () => (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <TanStackRouterDevtools />
    </>
  ),
});

const pathSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'path-settings',
  component: () => (
    <PathSettingsProvider>
      <Outlet />
    </PathSettingsProvider>
  ),
});

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: IndexPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/order', component: OrderPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/logs', component: LogsPage }),
  pathSettingsRoute.addChildren([
    createRoute({ getParentRoute: () => pathSettingsRoute, path: '/setup', component: SetupPage }),
    createRoute({
      getParentRoute: () => pathSettingsRoute,
      path: '/settings',
      component: SettingsPage,
    }),
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
