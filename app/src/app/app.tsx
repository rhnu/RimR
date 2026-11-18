import { RouterProvider } from '@tanstack/react-router';
import { AppBootstrap } from './app-bootstrap';
import { AppUpdaterContext } from './app-updater-context';
import { LocaleBootstrap } from './locale-bootstrap';
import { router } from './router';
import { ThemeBootstrap } from './theme-bootstrap';
import { useAppUpdater } from './use-app-updater';

export function App() {
  return (
    <>
      <ThemeBootstrap />
      <LocaleBootstrap />
      <AppBootstrap>
        <ReadyApp />
      </AppBootstrap>
    </>
  );
}

function ReadyApp() {
  const updater = useAppUpdater();
  return (
    <AppUpdaterContext value={updater}>
      <RouterProvider router={router} />
    </AppUpdaterContext>
  );
}
