import type { ComponentType } from 'react';
import type { AdminHubAppId } from '@/lib/adminHub/apps';
import { resolveAdminHubApp } from '@/lib/adminHub/apps';
import type { AdminHubAppBodyProps } from './types';

type Loader = () => Promise<{ default: ComponentType<AdminHubAppBodyProps> }>;

const LOADERS: Record<AdminHubAppId, Loader> = {
  logo: () => import('./LogoApp'),
  photos: () => import('./PhotosApp'),
  about: () => import('./AboutApp'),
  services: () => import('./ReviewApp').then((mod) => ({ default: mod.ServicesApp })),
  team: () => import('./ReviewApp').then((mod) => ({ default: mod.TeamApp })),
  hours: () => import('./ReviewApp').then((mod) => ({ default: mod.HoursApp })),
  setup: () => import('./SetupApp'),
  activity: () => import('./ActivityApp'),
  messages: () => import('./MessagesApp'),
  colours: () => import('./ColoursApp'),
  business: () => import('./LaunchApp').then((mod) => ({ default: mod.BusinessApp })),
  domain: () => import('./LaunchApp').then((mod) => ({ default: mod.DomainApp })),
  payments: () => import('./LaunchApp').then((mod) => ({ default: mod.PaymentsApp })),
  approve: () => import('./LaunchApp').then((mod) => ({ default: mod.ApproveApp })),
};

export function loadAdminHubApp(id: AdminHubAppId): ReturnType<Loader> {
  return LOADERS[resolveAdminHubApp(id)]();
}
