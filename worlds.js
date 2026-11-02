(function (root) {
  'use strict';
  const worlds = [
    {id: 'sunlit-gardens', name: 'Sunlit Gardens', start: 1, end: 10, background: 'assets/worlds/01-sunlit-gardens.webp', accent: '#657b42'},
    {id: 'whispering-woods', name: 'Whispering Woods', start: 11, end: 20, background: 'assets/worlds/02-whispering-woods.webp', accent: '#416b57'},
    {id: 'coral-coast', name: 'Coral Coast', start: 21, end: 30, background: 'assets/worlds/03-coral-coast.webp', accent: '#397b84'},
    {id: 'amber-orchard', name: 'Amber Orchard', start: 31, end: 40, background: 'assets/worlds/04-amber-orchard.webp', accent: '#9a6232'},
    {id: 'golden-dunes', name: 'Golden Dunes', start: 41, end: 50, background: 'assets/worlds/05-golden-dunes.webp', accent: '#a17d36'},
    {id: 'snowdrop-valley', name: 'Snowdrop Valley', start: 51, end: 60, background: 'assets/worlds/06-snowdrop-valley.webp', accent: '#527e90'},
    {id: 'crystal-grotto', name: 'Crystal Grotto', start: 61, end: 70, background: 'assets/worlds/07-crystal-grotto.webp', accent: '#516f83'},
    {id: 'jade-rainforest', name: 'Jade Rainforest', start: 71, end: 80, background: 'assets/worlds/08-jade-rainforest.webp', accent: '#396c4e'},
    {id: 'cloudtop-peaks', name: 'Cloudtop Peaks', start: 81, end: 90, background: 'assets/worlds/09-cloudtop-peaks.webp', accent: '#6a7d91'},
    {id: 'moonlit-observatory', name: 'Moonlit Observatory', start: 91, end: 100, background: 'assets/worlds/10-moonlit-observatory.webp', accent: '#5d6384'}
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = worlds;
  else root.SlideWorlds = worlds;
})(typeof window !== 'undefined' ? window : globalThis);
