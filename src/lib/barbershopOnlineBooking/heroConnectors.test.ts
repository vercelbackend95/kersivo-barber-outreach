import { describe, expect, it } from 'vitest';
import { CONNECTOR_CARD_INSET, connectorPath, connectorPoints, stackCallouts } from './heroConnectors';

const device = { left: 300, right: 1100, top: 0, bottom: 400 };

describe('hero connector geometry', () => {
  it('runs straight into a left-hand target when the card is level with it', () => {
    const points = connectorPoints({
      side: 'left',
      card: { left: 40, right: 250, top: 150, bottom: 230 },
      device,
      target: { left: 340, right: 560, top: 180, bottom: 220 },
    });
    expect(points[0]).toEqual([250, 200]);
    expect(points[points.length - 1]).toEqual([340, 200]);
    expect(points.every(([, y]) => y === 200)).toBe(true);
  });

  it('turns in the gutter, never inside the tablet, when the card sits off the target line', () => {
    const points = connectorPoints({
      side: 'right',
      card: { left: 1150, right: 1360, top: 0, bottom: 70 },
      device,
      target: { left: 1000, right: 1060, top: 150, bottom: 170 },
    });
    expect(points[0]).toEqual([1150, 70 - CONNECTOR_CARD_INSET]);
    expect(points[1]).toEqual([1125, 70 - CONNECTOR_CARD_INSET]);
    expect(points[2]).toEqual([1125, 160]);
    expect(points[3]).toEqual([1060, 160]);
  });

  it('runs one level line into a target in a later column when the card is centred on it', () => {
    const points = connectorPoints({
      side: 'left',
      card: { left: 40, right: 250, top: 300, bottom: 380 },
      device,
      target: { left: 600, right: 820, top: 310, bottom: 370 },
    });
    expect(points).toEqual([
      [250, 340],
      [600, 340],
    ]);
  });

  it('centres cards on their lines and parts colliding neighbours evenly', () => {
    expect(stackCallouts([{ desired: 100, height: 80 }, { desired: 300, height: 80 }])).toEqual([100, 300]);
    expect(stackCallouts([{ desired: 100, height: 80 }, { desired: 170, height: 80 }], 16)).toEqual([87, 183]);
  });

  it('draws an orthogonal path with rounded corners', () => {
    const d = connectorPath([
      [0, 0],
      [100, 0],
      [100, 50],
    ]);
    expect(d).toBe('M0 0 L94 0 Q100 0 100 6 L100 50');
  });
});
