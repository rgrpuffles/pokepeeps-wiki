import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outPath = path.join(root, 'data', 'pokemon-index.json');

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'accept': 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`Request failed for ${url}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

function dexFromUrl(url) {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

function normalizeName(name) {
  return String(name || '').toLowerCase();
}

function addDex(map, name, dex) {
  const key = normalizeName(name);
  if (!key) return;

  const current = map[key] || (map[key] = []);
  if (!current.includes(dex)) current.push(dex);
}

function collectSpeciesNames(node, out = []) {
  if (!node) return out;
  if (node.species?.name) out.push(normalizeName(node.species.name));
  for (const child of node.evolves_to || []) {
    collectSpeciesNames(child, out);
  }
  return out;
}

function flattenChain(node, chain = []) {
  if (!node) return chain;
  chain.push({
    species: normalizeName(node.species?.name),
    evolvesFromSpecies: normalizeName(node.evolves_from_species?.name),
    evolutionDetails: node.evolution_details || [],
    evolvesTo: (node.evolves_to || []).map(next => normalizeName(next.species?.name)).filter(Boolean)
  });
  for (const child of node.evolves_to || []) {
    flattenChain(child, chain);
  }
  return chain;
}

const list = await fetchJson('https://pokeapi.co/api/v2/pokemon?limit=2000');
const entries = list.results
  .map(item => ({
    id: dexFromUrl(item.url),
    name: normalizeName(item.name),
    url: item.url
  }))
  .filter(item => Number.isInteger(item.id))
  .sort((a, b) => a.id - b.id);

const pokemon = [];
const nameToDex = {};

for (const entry of entries) {
  const details = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${entry.id}`);
  const species = await fetchJson(details.species.url);
  const chain = species.evolution_chain?.url ? await fetchJson(species.evolution_chain.url) : null;
  const chainSpecies = chain?.chain ? collectSpeciesNames(chain.chain, []) : [];

  const record = {
    dex: entry.id,
    name: normalizeName(details.name),
    displayName: details.name,
    types: details.types
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map(t => normalizeName(t.type.name)),
    species: normalizeName(species.name),
    generation: species.generation?.name || null,
    evolvesFromSpecies: normalizeName(species.evolves_from_species?.name),
    evolutionChain: chain?.chain ? flattenChain(chain.chain, []) : [],
    evolutionChainSpecies: Array.from(new Set(chainSpecies)),
    relatedNames: Array.from(new Set([
      normalizeName(details.name),
      normalizeName(species.name),
      normalizeName(species.evolves_from_species?.name),
      ...chainSpecies
    ].filter(Boolean))),
    sprites: {
      frontDefault: details.sprites?.front_default || null,
      officialArtwork: details.sprites?.other?.['official-artwork']?.front_default || null
    }
  };

  pokemon.push(record);
  addDex(nameToDex, record.name, record.dex);
  addDex(nameToDex, species.name, record.dex);
  if (species.names) {
    for (const localName of species.names) {
      addDex(nameToDex, localName.name, record.dex);
    }
  }
}

for (const key of Object.keys(nameToDex)) {
  nameToDex[key].sort((a, b) => a - b);
}

const payload = {
  source: 'https://pokeapi.co/',
  generatedAt: new Date().toISOString(),
  count: pokemon.length,
  pokemon,
  nameToDex
};

await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Wrote ${pokemon.length} pokemon to ${outPath}`);
