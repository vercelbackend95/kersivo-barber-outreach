import { useEffect, useState } from 'react';
import { listBlacklineAvailableSlots } from '@/lib/demo/blacklineAvailability';

const PREVIEW_STATIC_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '14:00',
  '14:30',
] as const;

const availabilityCache = new Map<string, { slots: string[]; paused: boolean; pauseReason: string | null }>();

export function clearBookingAvailabilityCache() {
  availabilityCache.clear();
}

type AvailabilityArgs = {
  serviceId: string;
  barberId: string;
  date: string;
  durationMinutes: number;
  useStaticSlots: boolean;
  useBlacklineSessionSlots: boolean;
  publicShopId?: string;
};

export type BookingAvailabilityState = {
  slots: string[];
  isSlotsLoading: boolean;
  shopPaused: boolean;
  shopPauseReason: string | null;
};

export function useBookingAvailability({
  serviceId,
  barberId,
  date,
  durationMinutes,
  useStaticSlots,
  useBlacklineSessionSlots,
  publicShopId,
}: AvailabilityArgs): BookingAvailabilityState {
  const [slots, setSlots] = useState<string[]>([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [shopPaused, setShopPaused] = useState(false);
  const [shopPauseReason, setShopPauseReason] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId || !barberId || !date) {
      setSlots([]);
      setShopPaused(false);
      setShopPauseReason(null);
      setIsSlotsLoading(false);
      return;
    }

    if (useStaticSlots) {
      setSlots([...PREVIEW_STATIC_SLOTS]);
      setShopPaused(false);
      setShopPauseReason(null);
      setIsSlotsLoading(false);
      return;
    }

    if (useBlacklineSessionSlots) {
      setSlots(
        listBlacklineAvailableSlots({
          date,
          barberId,
          durationMinutes,
        }),
      );
      setShopPaused(false);
      setShopPauseReason(null);
      setIsSlotsLoading(false);
      return;
    }

    const cacheKey = `${publicShopId ?? 'session'}|${serviceId}|${barberId}|${date}`;
    const cached = availabilityCache.get(cacheKey);
    if (cached) {
      setSlots(cached.slots);
      setShopPaused(cached.paused);
      setShopPauseReason(cached.pauseReason);
      setIsSlotsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsSlotsLoading(true);
    const availabilityUrl = publicShopId?.trim()
      ? `/api/public/bookings/${encodeURIComponent(publicShopId.trim())}/availability?serviceId=${serviceId}&barberId=${barberId}&date=${date}`
      : `/api/availability?serviceId=${serviceId}&barberId=${barberId}&date=${date}`;

    fetch(availabilityUrl, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (controller.signal.aborted) return;
        const next = {
          slots: Array.isArray(data.slots) ? (data.slots as string[]) : [],
          paused: Boolean(data.paused),
          pauseReason:
            typeof data.pauseReason === 'string' && data.pauseReason.trim() ? data.pauseReason.trim() : null,
        };
        availabilityCache.set(cacheKey, next);
        if (availabilityCache.size > 40) {
          const first = availabilityCache.keys().next().value;
          if (first) availabilityCache.delete(first);
        }
        setSlots(next.slots);
        setShopPaused(next.paused);
        setShopPauseReason(next.pauseReason);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setShopPaused(false);
        setShopPauseReason(null);
        setSlots([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSlotsLoading(false);
      });

    return () => controller.abort();
  }, [
    serviceId,
    barberId,
    date,
    durationMinutes,
    useStaticSlots,
    useBlacklineSessionSlots,
    publicShopId,
  ]);

  return { slots, isSlotsLoading, shopPaused, shopPauseReason };
}
