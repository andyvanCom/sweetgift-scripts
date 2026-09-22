const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'sweetgift-gift-quiz.js'), 'utf8');

function requestedCore(scriptSrc, dataset = {}) {
  let appended;
  const document = {
    currentScript: { src: scriptSrc, dataset },
    readyState: 'complete',
    createElement() { return {}; },
    querySelectorAll() { return []; },
    head: { appendChild(node) { appended = node; } },
  };
  const window = { SG: {} };
  vm.runInNewContext(source, {
    URL,
    document,
    location: { href: 'https://sweetgift.ru/podbor-podarka' },
    window,
  });
  return appended && appended.src;
}

test('loads quiz core from the same immutable commit as the quiz module', () => {
  assert.equal(
    requestedCore('https://cdn.jsdelivr.net/gh/andyvanCom/sweetgift-scripts@abc123/sweetgift-gift-quiz.js?v=14'),
    'https://cdn.jsdelivr.net/gh/andyvanCom/sweetgift-scripts@abc123/gift-quiz-core.v1.js',
  );
});

test('honours an explicit quiz core override', () => {
  assert.equal(
    requestedCore('https://example.test/sweetgift-gift-quiz.js', { quizCore: 'https://assets.example.test/core.js' }),
    'https://assets.example.test/core.js',
  );
});
