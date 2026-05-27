export const EXPORT_WIDTH = 530;
export const EXPORT_HEIGHT = 720;
export const EXPORT_SCALE = 3;

export const FRAME_FILE = 'assets/images/card-frame.png';
export const DOTTED_FRAME_FILE = 'assets/images/card-frame-dotted.png';
export const IMAGE_MANIFEST_FILE = 'data/image-manifest.json';

export const GITHUB_PAGES_HIDDEN_SETS = new Set([
  'SET_3_FFA',
  'SET_3.5_VTY'
]);

export const STORAGE_KEY = 'pokepeeps-settings-v6';
export const ALL_SETS_VALUE = 'all';

export const SORT_LABELS = {
  'date-asc': 'Date modified asc',
  'date-desc': 'Date modified desc',
  'dex-asc': 'Pokedex number asc',
  type: 'Type',
  random: 'Randomise'
};

export const SIZE_LABELS = {
  '1': '1 per row',
  '2': '2 per row',
  '3': '3 per row',
  '4': '4 per row',
  '5': '5 per row',
  default: 'Automatic'
};

export const SIZE_OPTIONS = ['1', '2', '3', '4', '5', 'default'];

export const ENV = (() => {
  const host = window.location.hostname.toLowerCase();
  return host === 'github.io' || host.endsWith('.github.io') ? 'public' : 'dev';
})();
