import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toast } from '@/components/ui/toast';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/app/router';
import { LocaleBootstrap } from '@/app/LocaleBootstrap';
import { ThemeBootstrap } from '@/app/ThemeBootstrap';
import { SettingsSync } from '@/app/SettingsSync';
import { queryClient } from '@/lib/queryClient';
import { disableDefaultContextMenu } from '@/lib/disableDefaultContextMenu';
import '@/i18n';
import './styles.css';

disableDefaultContextMenu();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeBootstrap />
      <LocaleBootstrap />
      <SettingsSync />
      <RouterProvider router={router} />
      <Toast />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
