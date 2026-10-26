import { useState } from 'react';
import { LogTabSwitcher, type LogTab } from './log-tab-switcher';
import { RimWorldLogTab } from './rim-world-log-tab';
import { SteamWorkshopTab } from './steam-workshop-tab';

export function LogsPage() {
  const [tab, setTab] = useState<LogTab>('steam');
  return (
    <div className="mx-auto max-w-6xl space-y-2 p-3">
      <LogTabSwitcher tab={tab} onTabChange={setTab} />
      {tab === 'steam' ? <SteamWorkshopTab /> : <RimWorldLogTab />}
    </div>
  );
}
