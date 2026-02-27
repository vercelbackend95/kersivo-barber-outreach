const SERVICE_CODE_BY_ID: Record<string, string> = {
  'svc-haircut': 'H',
  'svc-skin-fade': 'FD',
  'svc-beard-trim': 'BT',
  'svc-haircut-beard': 'H+B'
};

const SERVICE_CODE_BY_NAME: Record<string, string> = {

  haircut: 'H',
  'skin fade': 'FD',
  'beard trim': 'BT',
  'haircut + beard': 'H+B',
  'haircut & beard': 'H+B'
};

type ServiceCodeInput =
  | string
  | {
      id?: string | null;
      name?: string | null;
    };

function normalizeServiceName(serviceName: string): string {
  return serviceName.trim().replace(/\s+/g, ' ').toLowerCase();
}

function getFallbackCodeFromName(serviceName: string): string {
  const normalizedName = normalizeServiceName(serviceName);
  if (!normalizedName) return 'SRV';


  const words = normalizedName.split(' ').filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((word) => word.slice(0, 1).toUpperCase())
      .join('');
  }
  return normalizedName.slice(0, 2).toUpperCase();
}

export function getServiceCode(input: ServiceCodeInput): string {
  const serviceId = typeof input === 'string' ? '' : (input.id ?? '').trim().toLowerCase();
  const serviceName = typeof input === 'string' ? input : input.name ?? '';
  const normalizedName = normalizeServiceName(serviceName);

  if (serviceId && SERVICE_CODE_BY_ID[serviceId]) return SERVICE_CODE_BY_ID[serviceId];
  if (normalizedName && SERVICE_CODE_BY_NAME[normalizedName]) return SERVICE_CODE_BY_NAME[normalizedName];

  return getFallbackCodeFromName(serviceName);

}
