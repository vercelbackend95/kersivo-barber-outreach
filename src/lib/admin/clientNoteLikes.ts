export type ClientNoteImageDto = {
  id: string;
  url: string;
};

export function mapNoteWithLikes(
  note: {
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: Date;
    barber: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
    images: { id: string; url: string }[];
    _count: { likes: number };
    likes?: { id: string }[];
  },
  sessionBarberId: string | null,
): {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  barber: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  images: ClientNoteImageDto[];
  likeCount: number;
  likedByMe: boolean;
} {
  return {
    id: note.id,
    body: note.body,
    isInternal: note.isInternal,
    createdAt: note.createdAt.toISOString(),
    barber: note.barber,
    images: note.images.map((image) => ({ id: image.id, url: image.url })),
    likeCount: note._count.likes,
    likedByMe: sessionBarberId ? (note.likes?.length ?? 0) > 0 : false,
  };
}

export const clientNoteBaseSelect = {
  id: true,
  body: true,
  isInternal: true,
  createdAt: true,
  barber: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
    },
  },
  images: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      url: true,
    },
  },
  _count: {
    select: { likes: true },
  },
} as const;
