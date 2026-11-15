import {
  Camera,
  Clock,
  ImagePlus,
  NotebookPen,
  Package,
  Paperclip,
  Scissors,
  StickyNote,
  Store,
  Users,
} from '@/components/lucide-react';
import type { AdminHubAddItemId } from '@/lib/adminHub/addMenu';

/** One icon per Add menu item: the menu row, the focused section's window bar and the section switcher. */
export const ADMIN_HUB_ADD_ITEM_ICONS: Record<AdminHubAddItemId, typeof Camera> = {
  business: Store,
  hours: Clock,
  photos: Camera,
  logo: ImagePlus,
  text: NotebookPen,
  'price-list': StickyNote,
  other: Paperclip,
  team: Users,
  service: Scissors,
  product: Package,
};
