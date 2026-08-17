import { DEMO_SERVICES } from './services';

const ALL_SERVICE_IDS = DEMO_SERVICES.map((service) => service.id);

export type DemoBarberImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type DemoBarber = {
  id: string;
  slug: string;
  name: string;
  specialisation: string;
  selectionCopy: string;
  serviceIds: string[];
  image: DemoBarberImage;
  objectPosition: string;
  rosterObjectPosition: string;
};

export const DEMO_BARBERS: readonly DemoBarber[] = [
  {
    id: 'bl-barber-ellis',
    slug: 'ellis-ward',
    name: 'Ellis Ward',
    specialisation: 'Skin fades · Textured cuts',
    selectionCopy: 'Clean structure, sharp fades and textured movement.',
    serviceIds: [...ALL_SERVICE_IDS],
    image: {
      src: '/demo/barbers/ellis-ward.webp',
      width: 1600,
      height: 1067,
      alt: 'Portrait of Ellis Ward, a fictional barber in the BLACKLINE demonstration shop.',
    },
    objectPosition: '50% 50%',
    rosterObjectPosition: '58% 42%',
  },
  {
    id: 'bl-barber-noah',
    slug: 'noah-reid',
    name: 'Noah Reid',
    specialisation: 'Classic cuts · Beard shaping',
    selectionCopy: 'Classic barbering paired with considered beard shaping.',
    serviceIds: [...ALL_SERVICE_IDS],
    image: {
      src: '/demo/barbers/noah-reid.webp',
      width: 1600,
      height: 2400,
      alt: 'Portrait of Noah Reid, a fictional barber in the BLACKLINE demonstration shop.',
    },
    objectPosition: '50% 12%',
    rosterObjectPosition: '50% 12%',
  },
  {
    id: 'bl-barber-marcus',
    slug: 'marcus-bell',
    name: 'Marcus Bell',
    specialisation: 'Scissor work · Natural styling',
    selectionCopy: 'Scissor-led cuts with a natural, wearable finish.',
    serviceIds: [...ALL_SERVICE_IDS],
    image: {
      src: '/demo/barbers/marcus-bell.webp',
      width: 1600,
      height: 2400,
      alt: 'Portrait of Marcus Bell, a fictional barber in the BLACKLINE demonstration shop.',
    },
    objectPosition: '50% 18%',
    rosterObjectPosition: '50% 12%',
  },
] as const;

export function demoBarberBookingHref(slug: string): string {
  return `/demo/book?barber=${encodeURIComponent(slug)}`;
}

export function resolveDemoBarberSlug(raw: string | null | undefined): DemoBarber | undefined {
  if (!raw) return undefined;
  const slug = raw.trim().toLowerCase();
  if (!slug) return undefined;
  return DEMO_BARBERS.find((barber) => barber.slug === slug);
}

export function demoBarberRosterIndex(index: number, total = DEMO_BARBERS.length): string {
  return `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
}

export function demoBarberFirstName(name: string): string {
  const [first] = name.trim().split(/\s+/).filter(Boolean);
  return first || name;
}

export function toDemoBookingBarber(barber: DemoBarber) {
  return {
    id: barber.id,
    name: barber.name,
    serviceIds: [...barber.serviceIds],
    avatarUrl: barber.image.src,
  };
}
