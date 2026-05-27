import { ENV, IMAGE_MANIFEST_FILE, GITHUB_PAGES_HIDDEN_SETS } from './gallery-config.js';

function getFilename(path) {
  return decodeURIComponent(path.split('/').pop()).toLowerCase();
}

function getDisplayName(path) {
  return decodeURIComponent(path.split('/').pop());
}

function getSetInfo(path) {
  const parts = decodeURIComponent(path).split('/').filter(Boolean);
  const cardsIndex = parts.findIndex(part => part.toLowerCase() === 'cards');
  const folder = cardsIndex >= 0 ? (parts[cardsIndex + 1] || '') : (parts[0] || '');
  const match = folder.match(/^SET_(\d+(?:\.\d+)?)_(.+)$/i);

  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  const code = match[2];
  const labelNumber = Number.isInteger(number) ? `${number}.` : `${match[1]}`;

  return {
    key: folder,
    number,
    code,
    label: `${labelNumber} ${code}`
  };
}

function normalizeTagToken(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function isAceTrainerToken(value) {
  return normalizeTagToken(value) === 'ACE TRAINER';
}

function isArtTypeToken(value) {
  const normalized = normalizeTagToken(value);
  return normalized === 'STANDARD' || normalized === 'FULL ART';
}

function isRelationToken(value) {
  const normalized = normalizeTagToken(value);
  return normalized === 'SET' || normalized === 'PROMO' || normalized === 'LIMITED';
}

function normalizeArtType(value) {
  const normalized = normalizeTagToken(value);
  if (normalized === 'STANDARD') return 'STANDARD';
  if (normalized === 'FULL ART') return 'FULL ART';
  return '';
}

function parseTags(path) {
  const setInfo = getSetInfo(path);
  const rawName = decodeURIComponent(path.split('/').pop() || '');
  const baseName = rawName.replace(/\.[^.]+$/, '');
  const tags = baseName.split('_').filter(Boolean);
  const isAceTrainer = isAceTrainerToken(tags[1] || '');

  let cardName = '';
  let guestArtist = '';
  let artType = '';
  let setRelation = '';
  let pokedex = '';
  let dexVariant = 0;

  if (isAceTrainer) {
    if (tags.length < 6) {
      return null;
    }

    const artTypeIndex = tags.findIndex((tag, index) => index >= 2 && isArtTypeToken(tag));
    if (artTypeIndex < 0 || artTypeIndex < 3 || artTypeIndex + 2 >= tags.length) {
      return null;
    }

    cardName = tags.slice(2, artTypeIndex).join('_');
    if (!cardName) {
      return null;
    }

    artType = normalizeArtType(tags[artTypeIndex]);
    setRelation = normalizeTagToken(tags[artTypeIndex + 1]);
    if (!isRelationToken(setRelation)) {
      return null;
    }

    guestArtist = tags.slice(artTypeIndex + 2).join('_');
    if (!guestArtist) {
      return null;
    }
  } else {
    const pokedexTag = tags[1] || '';
    const pokedexMatch = pokedexTag.match(/^(\d+)(?:-(\d+))?$/);
    if (!pokedexMatch) {
      return null;
    }

    dexVariant = pokedexMatch ? Number(pokedexMatch[2] || 0) : 0;
    pokedex = pokedexMatch ? pokedexMatch[1] : pokedexTag;

    if (tags.length < 6) {
      return null;
    }

    const artTypeIndex = tags.findIndex((tag, index) => index >= 2 && isArtTypeToken(tag));
    if (artTypeIndex < 0 || artTypeIndex < 3 || artTypeIndex + 2 >= tags.length) {
      return null;
    }

    cardName = tags.slice(2, artTypeIndex).join('_');
    if (!cardName) {
      return null;
    }

    artType = normalizeArtType(tags[artTypeIndex]);
    setRelation = normalizeTagToken(tags[artTypeIndex + 1]);
    if (!isRelationToken(setRelation)) {
      return null;
    }

    guestArtist = tags.slice(artTypeIndex + 2).join('_');
    if (!guestArtist) {
      return null;
    }
  }

  return {
    rawName,
    baseName,
    tags,
    setKey: setInfo?.key || '',
    setNumber: setInfo?.number || '',
    setCode: setInfo?.code || '',
    setLabel: setInfo?.label || 'All',
    isAceTrainer,
    isFullArt: artType === 'FULL ART',
    artType,
    setRelation,
    guestArtist,
    cardName,
    pokedex,
    dexVariant
  };
}

function normalizePokemonQuery(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseListingLinks(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  return Array.from(doc.querySelectorAll('a'))
    .map(a => a.getAttribute('href'))
    .filter(Boolean);
}

function resolveListingHref(basePath, href) {
  const baseUrl = new URL(basePath, window.location.href);
  const resolved = new URL(href, baseUrl);
  return resolved.pathname.replace(/^\//, '');
}

function isVisiblePathOnCurrentEnv(path) {
  if (ENV !== 'public') {
    return true;
  }

  const setInfo = getSetInfo(path);
  return !setInfo || !GITHUB_PAGES_HIDDEN_SETS.has(setInfo.key);
}

async function loadImagePathsFromManifest() {
  try {
    const manifest = await fetch(`./${IMAGE_MANIFEST_FILE}`).then(res => {
      if (!res.ok) {
        throw new Error(`Manifest request failed: ${res.status}`);
      }

      return res.json();
    });

    if (Array.isArray(manifest)) {
      return manifest;
    }

    if (Array.isArray(manifest?.images)) {
      return manifest.images;
    }
  } catch {}

  return null;
}

async function loadImagePathsFromDirectoryListings() {
  const cardsRootRes = await fetch('./assets/images/cards/');
  const cardsRootHtml = await cardsRootRes.text();

  const cardsRootLinks = parseListingLinks(cardsRootHtml);
  const folderLinks = cardsRootLinks.filter(href => /^SET_\d+(?:\.\d+)?_.+\/$/i.test(href));

  return [
    ...cardsRootLinks
      .filter(href => href.toLowerCase().endsWith('.png'))
      .map(href => resolveListingHref('./assets/images/cards/', href)),
    ...(await Promise.all(folderLinks.map(async folder => {
      const res = await fetch(`./assets/images/cards/${folder}`);
      const html = await res.text();

      return parseListingLinks(html)
        .filter(href => href.toLowerCase().endsWith('.png'))
        .map(href => resolveListingHref(`./assets/images/cards/${folder}`, href));
    }))).flat()
  ];
}

function isVisibleOnCurrentEnv(item) {
  return ENV !== 'public' || !GITHUB_PAGES_HIDDEN_SETS.has(item.setKey);
}

async function getLastModified(src) {
  try {
    const res = await fetch(src, { method: 'HEAD' });
    const value = res.headers.get('Last-Modified');

    return value ? new Date(value).getTime() : 0;
  } catch {
    return 0;
  }
}

async function buildImageItems(paths) {
  return Promise.all(
    paths.map(async src => {
      const parsed = parseTags(src);
      if (!parsed) {
        return null;
      }

      return {
        src,
        name: getFilename(src),
        displayName: getDisplayName(src),
        dexNumber: parseInt(parsed.pokedex, 10) || null,
        dexVariant: parsed.dexVariant || 0,
        ...parsed,
        modified: await getLastModified(src)
      };
    })
  ).then(items => items.filter(Boolean));
}

async function loadPokemonIndex() {
  const candidatePaths = [
    './data/pokemon-index.json',
    './pokemon-index.json'
  ];

  for (const path of candidatePaths) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;

      const pokemonIndex = await res.json();
      const pokemonNameToDex = {};

      const addDex = (name, dex) => {
        const key = normalizePokemonQuery(name);
        if (!key) return;

        const existing = pokemonNameToDex[key] || (pokemonNameToDex[key] = []);
        if (!existing.includes(dex)) {
          existing.push(dex);
        }
      };

      if (pokemonIndex?.nameToDex && typeof pokemonIndex.nameToDex === 'object') {
        Object.entries(pokemonIndex.nameToDex).forEach(([name, dex]) => {
          if (Array.isArray(dex)) {
            dex.forEach(value => addDex(name, Number(value)));
          } else {
            addDex(name, Number(dex));
          }
        });
      }

      if (Array.isArray(pokemonIndex?.pokemon)) {
        pokemonIndex.pokemon.forEach(entry => {
          if (entry?.name) {
            addDex(entry.name, entry.dex);
          }

          if (entry?.displayName) {
            addDex(entry.displayName, entry.dex);
          }

          if (Array.isArray(entry?.relatedNames)) {
            entry.relatedNames.forEach(name => {
              if (name) {
                addDex(name, entry.dex);
              }
            });
          }
        });
      }

      Object.keys(pokemonNameToDex).forEach(key => {
        pokemonNameToDex[key] = Array.from(new Set(pokemonNameToDex[key])).sort((a, b) => a - b);
      });

      return pokemonNameToDex;
    } catch {}
  }

  return {};
}

export async function loadGalleryData() {
  const excludedFiles = new Set(['frame.png', 'frame-dotted.png', 'card-frame.png', 'card-frame-dotted.png']);
  const pngs = ENV === 'dev'
    ? (await loadImagePathsFromDirectoryListings()) || await loadImagePathsFromManifest()
    : (await loadImagePathsFromManifest()) || await loadImagePathsFromDirectoryListings();
  const images = pngs.filter(file =>
    !excludedFiles.has(getFilename(file)) &&
    isVisiblePathOnCurrentEnv(file)
  );

  const [imageItems, pokemonNameToDex] = await Promise.all([
    buildImageItems(images),
    loadPokemonIndex()
  ]);

  return {
    imageItems,
    pokemonNameToDex,
    env: ENV,
    isVisibleOnCurrentEnv
  };
}
