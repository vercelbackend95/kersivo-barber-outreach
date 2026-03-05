export type Barber = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isActive?: boolean;
  active?: boolean;
  sortOrder?: number;
  serviceIds?: string[];
    todayLabel?: string;
  todayIsOnShift?: boolean | null;

};

export type ServiceOption = {
  id: string;
  name: string;
  active?: boolean;
};

export type WorkingHourRow = {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
};

export type TimeBlock = {
  id: string;
  title: string;
  barberId?: string | null;
  startAt: string;
  endAt: string;
  barber?: { id: string; name: string } | null;
};
