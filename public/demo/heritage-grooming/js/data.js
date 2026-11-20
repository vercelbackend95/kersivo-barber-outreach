// Shop data shared by the home page and the team page.
// ASSUMED: every name, year, handle and working day below is a stand-in until the shop sends its own.
// The home page reads its services from the printed price list (index.html .svc rows); pages without
// that list (team.html) read SERVICES from here. Keep the two in step.

export const SERVICES = [
  { id: 'haircut',         name: 'Haircut',           mins: 45, price: 26, desc: 'Scissor or clipper cut, washed and styled.' },
  { id: 'skin-fade',       name: 'Skin fade',         mins: 45, price: 29, desc: 'Taken down to the skin and blended by hand.' },
  { id: 'beard-trim',      name: 'Beard trim',        mins: 20, price: 15, desc: 'Shaped, lined up with a razor and oiled.' },
  { id: 'haircut-beard',   name: 'Haircut and beard', mins: 60, price: 38, desc: 'Both, in one sitting.' },
  { id: 'hot-towel-shave', name: 'Hot-towel shave',   mins: 40, price: 32, desc: 'Hot towels, brushed lather and an open razor.' },
  { id: 'the-heritage',    name: 'The Heritage',      mins: 90, price: 56, desc: 'Haircut, beard trim and a hot-towel shave.' },
];

// days: weekdays the barber is in (0 = Sunday). The shop opens Tuesday to Saturday (booking.js BOOKING.hours).
// photo: the stand-in portrait; replace with the barber's own (same 2:3 portrait crop).
export const BARBERS = [
  {
    id: 'arthur', name: 'Arthur Penn', first: 'Arthur', role: 'Classic cuts and beard work',
    since: 2009, days: [2, 3, 4, 5, 6], instagram: 'heritage.arthur.cuts',
    tags: ['scissor', 'long', 'beard'],
    photo: 'assets/img/work-arthur-fade', focus: '0.46 0.4',
    bio: 'Opened the shop in 2020 after eleven years behind other people’s chairs. Ask him for a cut you want to grow out without it looking like you are growing it out.',
  },
  {
    id: 'kit', name: 'Kit Harlow', first: 'Kit', role: 'Skin fades and clipper work',
    since: 2015, days: [3, 4, 5, 6], instagram: 'heritage.kit.fades',
    tags: ['fade', 'lineup', 'scissor'],
    photo: 'assets/img/work-kit-scissors', focus: '0.4 0.38',
    bio: 'Takes a skin fade down slowly and blends it by hand, so it still looks right in week three. Off on Tuesdays, first to fill up on Fridays.',
  },
  {
    id: 'rafi', name: 'Rafi Mendes', first: 'Rafi', role: 'Hot-towel shaves and open razor',
    since: 2012, days: [2, 3, 4, 6], instagram: 'heritage.rafi.razor',
    tags: ['shave', 'beard', 'long'],
    photo: 'assets/img/work-rafi-neckline', focus: '0.55 0.3',
    bio: 'Runs the hot-towel shaves: two towels, brushed lather, an open razor and no hurry. Keeps the longer hair in the shop in order too.',
  },
  {
    id: 'owen', name: 'Owen Clarke', first: 'Owen', role: 'Beard shaping and line-ups',
    since: 2018, days: [2, 4, 5, 6], instagram: 'heritage.owen.beards',
    tags: ['beard', 'lineup', 'fade', 'shave'],
    photo: 'assets/img/work-owen-razor', focus: '0.5 0.4',
    bio: 'Shapes a beard to the jaw it sits on and finishes every line-up with the razor. Joined in 2023 and books up first on Saturdays.',
  },
];

export const SPECIALTIES = {
  fade: 'Skin fades',
  scissor: 'Scissor cuts',
  long: 'Longer hair',
  beard: 'Beard work',
  shave: 'Hot-towel shaves',
  lineup: 'Line-ups',
};

export const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "Tuesday to Saturday", "Wednesday to Saturday", "Tuesday, Thursday to Saturday"
export function daysText(days) {
  const runs = [];
  for (const d of [...days].sort()) {
    const last = runs.at(-1);
    if (last && d === last[1] + 1) last[1] = d; else runs.push([d, d]);
  }
  return runs.map(([a, b]) => (a === b ? DOW[a] : b === a + 1 ? `${DOW[a]}, ${DOW[b]}` : `${DOW[a]} to ${DOW[b]}`)).join(', ');
}

// The full price list (services.html). The six SERVICES above keep their ids and prices here.
// ASSUMED: every price and length below is a stand-in until the shop sends its own list.
// cat: the chapter on the services page; parts: what a combo is made of (the visit planner matches on it).
export const CATEGORIES = [
  { id: 'cuts',   name: 'Haircuts',        short: 'Cuts',    intro: 'Every cut starts with a talk at the mirror and ends with a wash, a hot-towel neck and a style you can do again at home.' },
  { id: 'beards', name: 'Beards',          short: 'Beards',  intro: 'Shaped to the jaw it sits on, edged with an open razor, finished with oil or balm. Bring a photo if you have one in mind.' },
  { id: 'shaves', name: 'Straight razor',  short: 'Shaves',  intro: 'Two hot towels, lather brushed in by hand and a fresh blade for every customer. Book the time; it is not a quick one.' },
  { id: 'combos', name: 'Combinations',    short: 'Combos',  intro: 'Two or three services in one sitting, priced below what they cost on their own. The chair is yours the whole time.' },
  { id: 'young',  name: 'Under twelves',   short: 'Children', intro: 'A booster seat, no rush and a barber who has done a first haircut many times. A parent stays in the shop.' },
];

export const MENU = [
  { id: 'haircut',         cat: 'cuts',   name: 'Haircut',              mins: 45, price: 26, desc: 'Scissor or clipper cut, washed and styled.' },
  { id: 'skin-fade',       cat: 'cuts',   name: 'Skin fade',            mins: 45, price: 29, desc: 'Taken down to the skin and blended by hand.' },
  { id: 'long-hair',       cat: 'cuts',   name: 'Longer hair',          mins: 60, price: 34, desc: 'Scissors only, for hair past the collar.' },
  { id: 'clipper-cut',     cat: 'cuts',   name: 'Clipper cut',          mins: 20, price: 16, desc: 'One grade all over, neckline tidied with the razor.' },
  { id: 'beard-trim',      cat: 'beards', name: 'Beard trim',           mins: 20, price: 15, desc: 'Shaped, lined up with a razor and oiled.' },
  { id: 'beard-sculpt',    cat: 'beards', name: 'Beard and hot towel',  mins: 30, price: 22, desc: 'A hot towel first, then shaped by hand and lined with the razor.' },
  { id: 'line-up',         cat: 'beards', name: 'Line-up',              mins: 15, price: 12, desc: 'Hairline, cheeks and neck edged with the open razor.' },
  { id: 'hot-towel-shave', cat: 'shaves', name: 'Hot-towel shave',      mins: 40, price: 32, desc: 'Hot towels, brushed lather and an open razor.' },
  { id: 'head-shave',      cat: 'shaves', name: 'Head shave',           mins: 40, price: 30, desc: 'Clippered down, hot towel, then the razor over the whole head.' },
  { id: 'haircut-beard',   cat: 'combos', name: 'Haircut and beard',    mins: 60, price: 38, desc: 'Both, in one sitting.', parts: ['haircut', 'beard-trim'] },
  { id: 'fade-beard',      cat: 'combos', name: 'Skin fade and beard',  mins: 60, price: 41, desc: 'The fade, then the beard blended into it.', parts: ['skin-fade', 'beard-trim'] },
  { id: 'the-heritage',    cat: 'combos', name: 'The Heritage',         mins: 90, price: 56, desc: 'Haircut, beard trim and a hot-towel shave.', parts: ['haircut', 'beard-trim', 'hot-towel-shave'] },
  { id: 'child-cut',       cat: 'young',  name: 'Children’s haircut',   mins: 30, price: 18, desc: 'Under twelve. Scissors or clippers, no product unless asked.' },
  { id: 'child-fade',      cat: 'young',  name: 'Children’s fade',      mins: 30, price: 21, desc: 'Under twelve. Faded and blended, finished with a comb-through.' },
  { id: 'father-son',      cat: 'young',  name: 'Parent and child',     mins: 75, price: 40, desc: 'Two haircuts, one after the other in the same chair.' },
];
