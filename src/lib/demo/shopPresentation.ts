export type BlacklineProductLayout = {
  span: 4 | 5 | 6 | 7 | 12;
  stage: 'ivory' | 'graphite' | 'steel';
  scale: number;
  editorial?: boolean;
};

export const BLACKLINE_PRODUCT_LAYOUT: Record<string, BlacklineProductLayout> = {
  'bl-product-ironclad-pomade': { span: 7, stage: 'ivory', scale: 1.06 },
  'bl-product-matte-pomade': { span: 5, stage: 'graphite', scale: 1.08 },
  'bl-product-beard-balm': { span: 4, stage: 'steel', scale: 1.12 },
  'bl-product-sea-salt-texture-spray': { span: 4, stage: 'ivory', scale: 0.9 },
  'bl-product-beard-oil': { span: 4, stage: 'graphite', scale: 0.88 },
  'bl-product-barber-wash': { span: 7, stage: 'ivory', scale: 0.86, editorial: true },
  'bl-product-forge-styling-powder': { span: 5, stage: 'steel', scale: 1.1 },
};

export function getBlacklineProductLayout(productId: string): BlacklineProductLayout {
  return BLACKLINE_PRODUCT_LAYOUT[productId] ?? { span: 4, stage: 'graphite', scale: 1 };
}
