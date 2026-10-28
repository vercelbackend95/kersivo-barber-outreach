import { LEGAL_OPERATOR_NAME, LEGAL_OPERATOR_SERVICE_ADDRESS } from '@/lib/legal/businessIdentity';

/** Renders only when a service address is supplied. A null address produces no line. */
export function footerTradingNameLine(
  address: string | null = LEGAL_OPERATOR_SERVICE_ADDRESS,
  operatorName: string = LEGAL_OPERATOR_NAME,
): string | null {
  if (address == null) return null;
  return `KERSIVO is a trading name of ${operatorName}. ${address}.`;
}
