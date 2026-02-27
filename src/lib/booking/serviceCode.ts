const SERVICE_CODE_MAP: Record<string, string> = {
  haircut: 'H',
  'skin fade': 'FD',
  'beard trim': 'BT',
  'haircut + beard': 'H+B',
  'haircut & beard': 'H+B'
};

export function getServiceCode(serviceName: string): string {
  const normalizedName = serviceName.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalizedName) return 'SRV';

  if (SERVICE_CODE_MAP[normalizedName]) return SERVICE_CODE_MAP[normalizedName];

  const words = normalizedName.split(' ').filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((word) => word.slice(0, 1).toUpperCase())
      .join('');
  }

  return normalizedName.slice(0, 3).toUpperCase();
}
