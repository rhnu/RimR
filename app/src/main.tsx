import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { App } from '@/app/app';
import { Toast } from '@/components/ui/toast';
import { queryClient } from '@/queries/client';
import { disableDefaultContextMenu } from '@/app/native-context-menu';
import '@/i18n';

disableDefaultContextMenu();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toast />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
