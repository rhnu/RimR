import { createContext } from 'react';
import type { AppUpdater } from './use-app-updater';

export const AppUpdaterContext = createContext<AppUpdater | null>(null);
