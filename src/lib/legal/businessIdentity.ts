/**
 * Canonical legal identity for KERSIVO.
 * For legal / contractual pages only — do not expose in marketing UI.
 * The footer trading-name line is the only marketing-UI exception, and it renders only when LEGAL_OPERATOR_SERVICE_ADDRESS is set.
 */
export const LEGAL_OPERATOR_NAME = 'Bartosz Jasinski';

export const TRADING_NAME = 'KERSIVO';

export const LEGAL_OPERATOR_DISPLAY_NAME = 'Bartosz Jasinski, trading as KERSIVO';

export const LEGAL_OPERATOR_LOCATION = 'Bournemouth, England, United Kingdom';

/** UK service address (virtual office). Leave null until the founder supplies it. Never a home address. */
export const LEGAL_OPERATOR_SERVICE_ADDRESS: string | null = null;
