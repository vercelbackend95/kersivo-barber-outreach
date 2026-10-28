import { describe, expect, it } from 'vitest';
import { LEGAL_OPERATOR_NAME, LEGAL_OPERATOR_SERVICE_ADDRESS } from '@/lib/legal/businessIdentity';
import { footerTradingNameLine } from '@/lib/legal/footerTradingName';

describe('footer trading-name line', () => {
  it('renders nothing while the service address is null', () => {
    expect(LEGAL_OPERATOR_SERVICE_ADDRESS).toBeNull();
    expect(footerTradingNameLine(null)).toBeNull();
    expect(footerTradingNameLine()).toBeNull();
  });

  it('names the operator and the supplied service address', () => {
    expect(footerTradingNameLine('1 Example Street, London')).toBe(
      `KERSIVO is a trading name of ${LEGAL_OPERATOR_NAME}. 1 Example Street, London.`,
    );
  });
});
