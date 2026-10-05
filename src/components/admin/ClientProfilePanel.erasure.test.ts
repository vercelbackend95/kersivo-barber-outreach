import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { can } from '@/lib/admin/rbac/can';

describe('Client erasure UI danger zone', () => {
  const panelSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/admin/ClientProfilePanel.tsx'),
    'utf8',
  );
  const dangerZoneSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/admin/ClientErasureDangerZone.tsx'),
    'utf8',
  );
  const corePanelSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/admin/ClientCoreProfilePanel.tsx'),
    'utf8',
  );
  const clientsPanelSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/admin/ClientsAdminPanel.tsx'),
    'utf8',
  );

  it('gates the action on clients.erase / OWNER / MANAGER (BARBER cannot)', () => {
    expect(can('BARBER', 'clients.erase')).toBe(false);
    expect(can('OWNER', 'clients.erase')).toBe(true);
    expect(can('MANAGER', 'clients.erase')).toBe(true);
    expect(panelSource).toMatch(/clients\.erase/);
    expect(dangerZoneSource).toMatch(/Erase customer data/);
    expect(panelSource).toContain("import ClientErasureDangerZone from './ClientErasureDangerZone';");
    expect(corePanelSource).toContain("import ClientErasureDangerZone from './ClientErasureDangerZone';");
    expect(corePanelSource).toMatch(/\{canErase \? \(\s*<ClientErasureDangerZone/);
    expect(panelSource).toMatch(/canErase/);
    expect(panelSource).not.toMatch(/clients\.write.*erase|erase.*clients\.write/);
  });

  it('requires explicit DELETE confirmation and explains history retention', () => {
    expect(dangerZoneSource).toMatch(/confirmText\.trim\(\) === 'DELETE'/);
    expect(dangerZoneSource).toMatch(/Completed appointments and payment records/);
    expect(dangerZoneSource).toMatch(/cannot be undone/i);
    expect(dangerZoneSource).toMatch(/Active or unpaid appointments must be finished or cancelled first/);
    expect(dangerZoneSource).toMatch(/method:\s*'DELETE'/);
  });

  it('closes profile and refreshes client list after success', () => {
    expect(clientsPanelSource).toMatch(/<ClientCoreProfilePanel[\s\S]*?onErased/);
    expect(clientsPanelSource).toMatch(/<ClientProfilePanel[\s\S]*?onErased/);
    expect(clientsPanelSource).toMatch(/setListVersion/);
    expect(clientsPanelSource).toMatch(/setOpenClientId\(null\)/);
  });
});
