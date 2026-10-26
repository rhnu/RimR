import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '@/app/router';
import { SettingsPage } from '@/features/settings/settings-page';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});
