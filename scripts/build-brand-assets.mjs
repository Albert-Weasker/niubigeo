import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function geometry($) {
  return $('*').toArray().map(element => ({
    name: element.name,
    attributes: Object.entries(element.attribs).filter(([name]) => name !== 'fill'),
    text: $(element).contents().toArray().filter(node => node.type === 'text').map(node => node.data),
  }));
}

for (const name of ['niubigeo-lockup', 'niubigeo-emblem']) {
  const source = path.join(repositoryRoot, 'assets/brand', `${name}.svg`);
  const target = path.join(repositoryRoot, 'assets/brand', `${name}-light.svg`);
  const original = load(await readFile(source, 'utf8'), { xmlMode: true });
  const result = load(original.xml(), { xmlMode: true });
  assert.equal(result('svg').length, 1, `${name}: exactly one SVG required`);
  assert.equal(result('image, script, style, [style]').length, 0, `${name}: expected plain vector artwork`);
  result('[fill]').each((_, element) => {
    const node = result(element);
    if (node.attr('fill') !== 'none') node.attr('fill', '#111111');
  });
  assert.deepEqual(geometry(result), geometry(original), `${name}: non-fill geometry changed`);
  const serialized = result.xml();
  assert.deepEqual(geometry(load(serialized, { xmlMode: true })), geometry(original), `${name}: serialization changed geometry`);
  await writeFile(target, `${serialized}\n`);
  console.log(`Generated assets/brand/${name}-light.svg (fill only; original path strings retained).`);
}
