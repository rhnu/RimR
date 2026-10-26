import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toast } from '@/components/ui/toast';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/app/router';
import { LocaleBootstrap } from '@/app/locale-bootstrap';
import { ThemeBootstrap } from '@/app/theme-bootstrap';
import { AppBootstrap } from '@/app/app-bootstrap';
import { queryClient } from '@/queries/client';
import { disableDefaultContextMenu } from '@/app/native-context-menu';
import '@/i18n';
import './styles.css';

disableDefaultContextMenu();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeBootstrap />
      <LocaleBootstrap />
      <AppBootstrap>
        <RouterProvider router={router} />
      </AppBootstrap>
      <Toast />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
