/** Stroke-only 24×24 icon paths for the marketing navigation (rendered as inline SVG, no icon library). */
export const MARKETING_NAV_ICONS = {
  overview: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M10 20v-6h4v6',
  system: 'M4 5h16v11H4zM8 20h8M12 16v4',
  booking: 'M7 3v3M17 3v3M4 8h16M5 5h14v15H5zM9 13l2 2 4-4',
  admin: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  retail: 'M6 7h12l-1 13H7L6 7Zm3 0V5a3 3 0 0 1 6 0v2',
  pricing: 'M12 2v20M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  compare: 'M8 3v18M16 3v18M3 8h5M16 16h5M3 16h5M16 8h5',
  calculator: 'M6 2h12v20H6zM9 6h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01M9 18.5h6',
  guide: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5A2.5 2.5 0 0 1 6.5 19H20',
  faq: 'M9.1 9a3 3 0 1 1 4.9 2.3c-.92.62-1.5 1.21-1.5 2.2v.5M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  contact: 'M4 6h16v12H4zM4.5 7 12 12.5 19.5 7',
  arrow: 'M5 12h14M13 6l6 6-6 6',
} as const;

export type MarketingNavIcon = keyof typeof MARKETING_NAV_ICONS;
