import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

export const hash = value => createHash('sha256').update(value).digest('hex');
export const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, path);
}
export async function freezeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  return hash(await readFile(path));
}
export async function files(root) {
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return []; if (error.code === 'ENOTDIR') return [root]; throw error; }
  const result = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}
export async function snapshot(root, paths) {
  const entries = [];
  for (const path of paths) {
    for (const file of await files(join(root, path))) entries.push({ path: relative(root, file), sha256: hash(await readFile(file)) });
  }
  return { sha256: hash(JSON.stringify(entries)), fileCount: entries.length, files: entries };
}
export function argumentsMap(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (!name.startsWith('--') || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Expected --name value: ${name}`);
    if (name in result) throw new Error(`Repeated option: ${name}`);
    result[name] = args[++i];
  }
  return result;
}
