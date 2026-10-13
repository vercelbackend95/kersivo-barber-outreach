import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { provisionShopForUser, enqueueRegistrationNotification, recordProductionRegistrationOrigin } =
  vi.hoisted(() => ({
    provisionShopForUser: vi.fn(),
    enqueueRegistrationNotification: vi.fn(),
    recordProductionRegistrationOrigin: vi.fn(),
  }));

vi.mock('@/lib/auth/provisionShop', () => ({ provisionShopForUser }));
vi.mock('@/lib/email/internalSignupNotifications', () => ({
  enqueueRegistrationNotification,
  recordProductionRegistrationOrigin,
}));

import { handleUserCreated, handleUserCreating } from './userCreatedHook';

describe('handleUserCreating (Better Auth user.create.before)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records the origin marker for the email and returns nothing (user data untouched)', async () => {
    recordProductionRegistrationOrigin.mockResolvedValue(undefined);
    await expect(handleUserCreating({ email: 'sam@example.co.uk' })).resolves.toBeUndefined();
    expect(recordProductionRegistrationOrigin).toHaveBeenCalledWith('sam@example.co.uk');
  });

  it('a marker failure never blocks sign-up', async () => {
    recordProductionRegistrationOrigin.mockRejectedValue(new Error('table missing'));
    await expect(handleUserCreating({ email: 'sam@example.co.uk' })).resolves.toBeUndefined();
  });
});

const user = { id: 'user_1', name: 'Sam Owner', email: 'sam@example.co.uk' };

describe('handleUserCreated (Better Auth user.create.after)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    provisionShopForUser.mockResolvedValue({ shopId: 'shop_1' });
    enqueueRegistrationNotification.mockResolvedValue({ status: 'enqueued', outboxId: 'out_1' });
  });

  it('provisions the shop first, then queues one registration notification for the new user id', async () => {
    const order: string[] = [];
    provisionShopForUser.mockImplementation(async () => {
      order.push('provision');
      return { shopId: 'shop_1' };
    });
    enqueueRegistrationNotification.mockImplementation(async () => {
      order.push('notify');
      return { status: 'enqueued', outboxId: 'out_1' };
    });

    await handleUserCreated(user);

    expect(provisionShopForUser).toHaveBeenCalledWith({
      userId: 'user_1',
      name: 'Sam Owner',
      email: 'sam@example.co.uk',
    });
    expect(enqueueRegistrationNotification).toHaveBeenCalledTimes(1);
    expect(enqueueRegistrationNotification).toHaveBeenCalledWith('user_1');
    expect(order).toEqual(['provision', 'notify']);
  });

  it('an invited user (no shop provisioned) is still notified', async () => {
    provisionShopForUser.mockResolvedValue({ shopId: null });
    await handleUserCreated(user);
    expect(enqueueRegistrationNotification).toHaveBeenCalledWith('user_1');
  });

  it('a notification failure never fails account creation', async () => {
    enqueueRegistrationNotification.mockRejectedValue(new Error('resend down'));
    await expect(handleUserCreated(user)).resolves.toBeUndefined();
  });

  it('provisioning errors keep propagating, but the notification is still queued', async () => {
    provisionShopForUser.mockRejectedValue(new Error('db blip'));
    await expect(handleUserCreated(user)).rejects.toThrow('db blip');
    expect(enqueueRegistrationNotification).toHaveBeenCalledWith('user_1');
  });
});

describe('auth.ts wiring', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/lib/auth.ts'), 'utf8');

  it('only the user.create.after hook queues the registration notification', () => {
    const userHooks = source.slice(source.indexOf('databaseHooks'), source.indexOf('account: {'));
    expect(userHooks).toMatch(/user:\s*\{\s*create:\s*\{\s*before:[\s\S]*handleUserCreating\(user\)[\s\S]*after:[\s\S]*handleUserCreated\(user\)/);
    expect(source.match(/handleUserCreated\(/g)).toHaveLength(1);
    expect(source.match(/handleUserCreating\(/g)).toHaveLength(1);
  });

  it('login, session refresh and OAuth account linking/updating never notify', () => {
    const accountHooks = source.slice(source.indexOf('account: {'));
    expect(accountHooks).not.toMatch(/handleUserCreated|enqueueRegistrationNotification/);
    expect(source).not.toMatch(/session:\s*\{\s*create:/);
    expect(source).not.toMatch(/user:\s*\{[\s\S]*update:\s*\{\s*after/);
  });
});
