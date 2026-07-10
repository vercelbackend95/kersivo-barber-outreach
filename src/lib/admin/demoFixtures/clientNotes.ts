import { LANDING_DEMO_BARBER_AVATARS, LANDING_DEMO_CLIENT_AVATARS } from '@/lib/landing/landingDemoAssets';
import { convertImageFileToWebp } from '@/lib/storage/convertImageToWebp';
import { DEMO_BARBER_IDS, DEMO_CLIENT_IDS } from './ids';

export type DemoClientNoteImage = {
  id: string;
  url: string;
};

export type DemoClientNote = {
  id: string;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  images: DemoClientNoteImage[];
  barber: {
    id: string;
    name: string;
    avatarUrl: string;
  } | null;
};

const MAX_DEMO_NOTE_IMAGES = 3;

function daysAgo(days: number, hour = 11, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

const demoClientNotesByClientId: Record<string, DemoClientNote[]> = {
  [DEMO_CLIENT_IDS.oliver]: [
    {
      id: 'demo-note-oliver-01',
      body: 'Prefers skin fade, #2 on sides. Always asks for a sharp line-up around the temples.',
      createdAt: daysAgo(28, 10, 15),
      likeCount: 1,
      likedByMe: false,
      images: [],
      barber: {
        id: DEMO_BARBER_IDS.jamie,
        name: 'Jamie Reed',
        avatarUrl: LANDING_DEMO_BARBER_AVATARS.jamie,
      },
    },
    {
      id: 'demo-note-oliver-02',
      body: 'Likes a bit of texture on top — matte clay works well. Skip heavy pomade.',
      createdAt: daysAgo(19, 16, 40),
      likeCount: 2,
      likedByMe: false,
      images: [
        {
          id: 'demo-note-oliver-02-img-0',
          url: LANDING_DEMO_CLIENT_AVATARS[0],
        },
      ],
      barber: {
        id: DEMO_BARBER_IDS.alex,
        name: 'Alex Morgan',
        avatarUrl: LANDING_DEMO_BARBER_AVATARS.alex,
      },
    },
    {
      id: 'demo-note-oliver-03',
      body: 'Running 5 min late last visit but called ahead. Reliable regular — no issues.',
      createdAt: daysAgo(6, 9, 5),
      likeCount: 0,
      likedByMe: false,
      images: [],
      barber: {
        id: DEMO_BARBER_IDS.jamie,
        name: 'Jamie Reed',
        avatarUrl: LANDING_DEMO_BARBER_AVATARS.jamie,
      },
    },
    {
      id: 'demo-note-oliver-04',
      body: 'Mentioned wedding in August — suggested booking a trial cut 2–3 weeks before.',
      createdAt: daysAgo(2, 14, 20),
      likeCount: 0,
      likedByMe: false,
      images: [],
      barber: {
        id: DEMO_BARBER_IDS.marcus,
        name: 'Marcus Bell',
        avatarUrl: LANDING_DEMO_BARBER_AVATARS.marcus,
      },
    },
    {
      id: 'demo-note-oliver-05',
      body: 'Wedding trial inspo — skin fade, textured top, clean line-up. Oliver sent these three reference shots.',
      createdAt: daysAgo(1, 11, 30),
      likeCount: 0,
      likedByMe: false,
      images: [
        {
          id: 'demo-note-oliver-05-img-0',
          url: LANDING_DEMO_CLIENT_AVATARS[0],
        },
        {
          id: 'demo-note-oliver-05-img-1',
          url: LANDING_DEMO_CLIENT_AVATARS[2],
        },
        {
          id: 'demo-note-oliver-05-img-2',
          url: LANDING_DEMO_CLIENT_AVATARS[4],
        },
      ],
      barber: {
        id: DEMO_BARBER_IDS.jamie,
        name: 'Jamie Reed',
        avatarUrl: LANDING_DEMO_BARBER_AVATARS.jamie,
      },
    },
  ],
  [DEMO_CLIENT_IDS.noah]: [
    {
      id: 'demo-note-noah-01',
      body: 'Allergic to certain products — check before use. Sensitive scalp.',
      createdAt: daysAgo(14, 12, 0),
      likeCount: 0,
      likedByMe: false,
      images: [],
      barber: {
        id: DEMO_BARBER_IDS.sam,
        name: 'Sam Brooks',
        avatarUrl: LANDING_DEMO_BARBER_AVATARS.sam,
      },
    },
  ],
};

const demoAddedNotesByClientId: Record<string, DemoClientNote[]> = {};
const demoNoteLikeOverrides = new Map<string, { likeCount: number; likedByMe: boolean }>();

let demoNoteIdCounter = 0;

function nextDemoNoteId() {
  demoNoteIdCounter += 1;
  return `demo-note-added-${demoNoteIdCounter}`;
}

function getStaticNotes(clientId: string): DemoClientNote[] {
  return demoClientNotesByClientId[clientId] ?? [];
}

function getAddedNotes(clientId: string): DemoClientNote[] {
  return demoAddedNotesByClientId[clientId] ?? [];
}

function getBaseNotes(clientId: string): DemoClientNote[] {
  return [...getStaticNotes(clientId), ...getAddedNotes(clientId)];
}

function applyLikeOverrides(note: DemoClientNote): DemoClientNote {
  const override = demoNoteLikeOverrides.get(note.id);
  if (!override) return note;
  return { ...note, likeCount: override.likeCount, likedByMe: override.likedByMe };
}

async function filesToWebpDataUrls(files: File[]): Promise<DemoClientNoteImage[]> {
  const images: DemoClientNoteImage[] = [];
  for (const [index, file] of files.entries()) {
    const webpBuffer = await convertImageFileToWebp(file);
    images.push({
      id: `demo-note-img-${Date.now()}-${index}`,
      url: `data:image/webp;base64,${webpBuffer.toString('base64')}`,
    });
  }
  return images;
}

export function getDemoClientNotesResponse(clientId: string) {
  const notes = getBaseNotes(clientId)
    .map(applyLikeOverrides)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return { notes };
}

export function toggleDemoClientNoteLike(clientId: string, noteId: string) {
  const baseNote = getBaseNotes(clientId).find((note) => note.id === noteId);
  if (!baseNote) return null;

  const current = applyLikeOverrides(baseNote);
  const likedByMe = !current.likedByMe;
  const likeCount = Math.max(0, current.likeCount + (likedByMe ? 1 : -1));
  const next = { likeCount, likedByMe };
  demoNoteLikeOverrides.set(noteId, next);
  return next;
}

export async function addDemoClientNote(
  clientId: string,
  body: string,
  imageFiles: File[],
) {
  if (!body && imageFiles.length === 0) {
    throw new Error('Note must include text or at least one image.');
  }
  if (imageFiles.length > MAX_DEMO_NOTE_IMAGES) {
    throw new Error(`A note can include at most ${MAX_DEMO_NOTE_IMAGES} images.`);
  }

  const images = await filesToWebpDataUrls(imageFiles);
  const note: DemoClientNote = {
    id: nextDemoNoteId(),
    body,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    likedByMe: false,
    images,
    barber: {
      id: DEMO_BARBER_IDS.jamie,
      name: 'Jamie Reed',
      avatarUrl: LANDING_DEMO_BARBER_AVATARS.jamie,
    },
  };

  if (!demoAddedNotesByClientId[clientId]) {
    demoAddedNotesByClientId[clientId] = [];
  }
  demoAddedNotesByClientId[clientId].push(note);
  return { note };
}

export async function createDemoClientNoteFromRequest(clientId: string, request: Request) {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const body = String(form.get('body') ?? '').trim();
    const imageFiles = form
      .getAll('images')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    return addDemoClientNote(clientId, body, imageFiles);
  }

  const payload = (await request.json().catch(() => null)) as { body?: unknown } | null;
  if (!payload || typeof payload.body !== 'string') {
    throw new Error('Invalid note payload.');
  }

  return addDemoClientNote(clientId, payload.body.trim(), []);
}
