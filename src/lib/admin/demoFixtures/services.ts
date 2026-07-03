import { DEMO_BARBER_IDS, DEMO_SERVICE_IDS } from './ids';

const barberRef = (id: string, name: string) => ({
  barber: { id, name, active: true },
});

export const demoServicesResponse = {
  services: [
    {
      id: DEMO_SERVICE_IDS.skinFade,
      name: 'Skin Fade',
      description: 'Precision fade with scissor finish.',
      pricePence: 2800,
      durationMinutes: 45,
      bufferMinutes: 5,
      displayOrder: 0,
      category: 'HAIRCUT',
      isActive: true,
      barberServices: [barberRef(DEMO_BARBER_IDS.jamie, 'Jamie Reed'), barberRef(DEMO_BARBER_IDS.alex, 'Alex Morgan')],
    },
    {
      id: DEMO_SERVICE_IDS.beardTrim,
      name: 'Beard Trim',
      description: 'Shape and line-up.',
      pricePence: 1500,
      durationMinutes: 20,
      bufferMinutes: 5,
      displayOrder: 1,
      category: 'BEARD',
      isActive: true,
      barberServices: [barberRef(DEMO_BARBER_IDS.alex, 'Alex Morgan'), barberRef(DEMO_BARBER_IDS.sam, 'Sam Brooks')],
    },
    {
      id: DEMO_SERVICE_IDS.classicCut,
      name: 'Classic Cut',
      description: 'Scissor cut and style.',
      pricePence: 2400,
      durationMinutes: 40,
      bufferMinutes: 5,
      displayOrder: 2,
      category: 'HAIRCUT',
      isActive: true,
      barberServices: [barberRef(DEMO_BARBER_IDS.jamie, 'Jamie Reed'), barberRef(DEMO_BARBER_IDS.sam, 'Sam Brooks')],
    },
  ],
  categories: ['HAIRCUT', 'BEARD', 'STYLING'],
};

export const demoServiceCategoriesResponse = {
  categories: ['HAIRCUT', 'BEARD', 'STYLING'],
};
