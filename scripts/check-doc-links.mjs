import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';
import { marked } from 'marked';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--ref' || !args[1])) {
  console.error('Usage: npm run docs:check-links -- [--ref COMMIT]');
  process.exit(1);
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function hasScheme(value) {
  const end = value.indexOf(':');
  if (end < 1) return false;
  const scheme = value.slice(0, end).toLowerCase();
  const alpha = character => character >= 'a' && character <= 'z';
  return alpha(scheme[0]) && [...scheme].every(character => alpha(character) || (character >= '0' && character <= '9') || '+.-'.includes(character));
}

function checkLinks() {
  const root = git('rev-parse', '--show-toplevel').trim();
  const ref = args[1];
  const tree = ref ? git('rev-parse', '--verify', '--end-of-options', `${ref}^{tree}`).trim() : null;
  const tracked = (tree
    ? git('ls-tree', '-r', '-z', '--name-only', tree)
    : git('ls-files', '--cached', '-z')
  ).split('\0').filter(Boolean);
  // A local, untracked file must never make a public link appear valid.
  const files = new Set(tracked.filter(file => tree || existsSync(path.join(root, file))));
  const targets = new Set(files);
  targets.add('.');
  for (const file of files) {
    for (let dir = path.posix.dirname(file); dir !== '.'; dir = path.posix.dirname(dir)) targets.add(dir);
  }

  const markdownFiles = [...files].filter(file => ['.md', '.markdown'].some(extension => file.toLowerCase().endsWith(extension)));
  const failures = [];
  let checked = 0;
  for (const file of markdownFiles) {
    const source = tree ? git('show', `${tree}:${file}`) : readFileSync(path.join(root, file), 'utf8');
    // Rendering handles inline/reference links, escaped text, and fenced code.
    // Cheerio also finds actual HTML links/images and decodes HTML entities.
    const $ = load(marked.parse(source, { async: false }), null, false);
    $('pre, code').remove();
    $('a[href], img[src]').each((_, element) => {
      const href = $(element).attr(element.name === 'a' ? 'href' : 'src').trim();
      if (!href || href.startsWith('#') || href.startsWith('//') || hasScheme(href)) return;
      const pathname = href.split('#', 1)[0].split('?', 1)[0];
      if (!pathname) return;
      checked++;
      let decoded;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        failures.push({ file, href, target: pathname, reason: 'invalid URL encoding' });
        return;
      }
      const target = path.posix.normalize(decoded.startsWith('/')
        ? decoded.slice(1)
        : path.posix.join(path.posix.dirname(file), decoded));
      if (!targets.has(target)) failures.push({ file, href, target, reason: 'missing tracked target' });
    });
  }

  for (const { file, href, target, reason } of failures) {
    console.error(`${file}: ${href} -> ${target} (${reason})`);
  }
  const distinctTargets = new Set(failures.map(failure => failure.target)).size;
  console.log(`Checked ${checked} local references in ${markdownFiles.length} tracked Markdown files (${ref || 'working tree'}).`);
  if (failures.length) {
    console.error(`FAIL: ${failures.length} broken references to ${distinctTargets} distinct targets.`);
    process.exitCode = 1;
  } else {
    console.log('PASS: all local link and image targets are tracked and present.');
  }
}

try {
  checkLinks();
} catch (error) {
  console.error(`Documentation link check failed: ${error.message}`);
  process.exitCode = 1;
}
