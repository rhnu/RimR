import { useState } from 'react';
import { Col } from '@/components/ui/layout';
import { LogTabSwitcher, type LogTab } from './log-tab-switcher';
import { RimWorldLogTab } from './rim-world-log-tab';
import { SteamWorkshopTab } from './steam-workshop-tab';

export function LogsPage() {
  const [tab, setTab] = useState<LogTab>('steam');
  return (
    <Col className="mx-auto max-w-6xl p-3">
      <LogTabSwitcher tab={tab} onTabChange={setTab} />
      {tab === 'steam' ? <SteamWorkshopTab /> : <RimWorldLogTab />}
    </Col>
  );
}
