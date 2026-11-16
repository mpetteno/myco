import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

mkdirSync('node_modules/.tmp', { recursive: true });
const directory = mkdtempSync(resolve('node_modules/.tmp/myco-mulch-'));
const repository = join(directory, 'repository.mjs');
writeFileSync(repository, `export const loadMulchCatalogue = async () => {
  const fixture = globalThis.__mulchFixture;
  if (fixture.loadError) throw fixture.loadError;
  return fixture.data;
};
export const saveMulchType = async (details, current) => {
  const fixture = globalThis.__mulchFixture;
  fixture.writes.push({ details, current });
  await fixture.save();
  return { id: current?.id ?? 'new-mulch', version: (current?.version ?? 0) + 1,
    name: details.name.trim(), notes: details.notes.trim() };
};`);

export async function loadPanel() {
  const result = await build({ configFile: false, envFile: false, logLevel: 'silent',
    plugins: [{ name: 'mulch-fixtures', enforce: 'pre', resolveId(source) {
      if (source.endsWith('/mulchCatalogueRepository')) return repository;
    } }],
    build: { write: false, minify: false,
      lib: { entry: 'src/features/mulch-catalogue/MulchCataloguePanel.tsx', formats: ['es'] },
      rolldownOptions: { external: ['react', 'react/jsx-runtime'] } },
  });
  const output = (Array.isArray(result) ? result[0] : result).output;
  const file = join(directory, 'panel.mjs');
  writeFileSync(file, output.find((item) => item.type === 'chunk').code);
  return import(pathToFileURL(file).href);
}
export const cleanupPanel = () => rmSync(directory, { recursive: true, force: true });
