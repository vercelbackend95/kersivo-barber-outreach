import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadBebas } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';

const bebas = loadBebas();
const anton = loadAnton();
const playfair = loadPlayfair('normal', {
  weights: ['400', '600', '700'],
  subsets: ['latin'],
  ignoreTooManyRequestsWarning: true,
});
const inter = loadInter('normal', {
  weights: ['400', '600'],
  subsets: ['latin'],
  ignoreTooManyRequestsWarning: true,
});

export const fontFamily = {
  heading: bebas.fontFamily,
  brand: playfair.fontFamily,
  meme: anton.fontFamily,
  body: inter.fontFamily,
  semiBold: inter.fontFamily,
};

export const fontWeight = {
  semiBold: 600,
} as const;
