import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadBebas } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

const bebas = loadBebas();
const anton = loadAnton();
const inter = loadInter('normal', {
  weights: ['400', '600'],
  subsets: ['latin'],
  ignoreTooManyRequestsWarning: true,
});

export const fontFamily = {
  heading: bebas.fontFamily,
  meme: anton.fontFamily,
  body: inter.fontFamily,
  semiBold: inter.fontFamily,
};

export const fontWeight = {
  semiBold: 600,
} as const;
