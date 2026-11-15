import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { tools } from './catalog'
import { processTool } from './processors'

test('all catalog tools have unique, routed processor cases', async () => {
  const slugs = tools.map((tool) => tool.slug)
  assert.equal(slugs.length, 66)
  assert.equal(new Set(slugs).size, slugs.length)
  const source = await readFile(new URL('./processors.ts', import.meta.url), 'utf8')
  for (const slug of slugs) assert.ok(source.includes(`case '${slug}'`), `Missing processor for ${slug}`)
  const serverCatalog = await readFile(new URL('../../../server/data/toolCatalog.js', import.meta.url), 'utf8')
  const serverSlugs = [...serverCatalog.matchAll(/\['([^']+)', '[^']+'\]/g)].map((match) => match[1])
  assert.deepEqual(serverSlugs.sort(), [...slugs].sort())
})

test('JSON formatting, minification, and validation distinguish malformed input', async () => {
  assert.equal((await processTool('json-formatter', '{"ok":true}', '', { choice: '2 spaces', indent: '2 spaces' })).output, '{\n  "ok": true\n}')
  assert.equal((await processTool('json-minifier', '{ "ok": true }')).output, '{"ok":true}')
  await assert.rejects(processTool('json-validator', '{bad'), /JSON|property|position/i)
})

test('CSV conversion quotes commas, escaped quotes, and embedded newlines', async () => {
  const result = await processTool('csv-to-json', 'name,note\nAda,"said ""hello"",\nthen left"')
  assert.deepEqual(JSON.parse(result.output), [{ name: 'Ada', note: 'said "hello",\nthen left' }])
  const csv = await processTool('json-to-csv', '[{"name":"Ada, Lovelace","note":"said \\"hello\\""}]')
  assert.equal(csv.output, 'name,note\n"Ada, Lovelace","said ""hello"""')
})

test('UTF-8 encoders round-trip non-ASCII text', async () => {
  const source = 'Hi 🌍 ✓'
  assert.equal((await processTool('base64-decoder', (await processTool('base64-encoder', source)).output)).output, source)
  assert.equal((await processTool('hex-to-text', (await processTool('text-to-hex', source)).output)).output, source)
  assert.equal((await processTool('binary-to-text', (await processTool('text-to-binary', source)).output)).output, source)
})

test('text transformations handle Unicode and empty content', async () => {
  assert.equal((await processTool('text-reverser', 'A🌍B')).output, 'B🌍A')
  assert.equal((await processTool('slug-generator', 'Crème Brûlée & API')).output, 'creme-brulee-api')
  assert.match((await processTool('word-counter', '')).output, /Words: 0/)
})

test('regex and schema tools report matches and validation failures', async () => {
  assert.match((await processTool('regex-tester', '\\d+', 'value 42 and 7')).output, /Matches: 2/)
  await assert.rejects(processTool('json-schema-validator', '{"age":"old"}', '{"type":"object","properties":{"age":{"type":"integer"}}}'), /Schema validation failed/)
})

test('hashes use the expected standard digest values', async () => {
  assert.equal((await processTool('hash-generator', 'abc', '', { choice: 'MD5' })).output, '900150983cd24fb0d6963f7d28e17f72')
  assert.equal((await processTool('hash-generator', 'abc', '', { choice: 'SHA-256' })).output, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('SQL minifier preserves whitespace inside string literals', async () => {
  assert.equal((await processTool('sql-minifier', "SELECT  note  FROM entries WHERE title = 'two  words'; -- comment")).output, "SELECT note FROM entries WHERE title = 'two  words';")
})

test('formatters and minifiers transform representative HTML, CSS, JS, and SQL', async () => {
  const css = await processTool('css-minifier', '/* comment */ .card { color: red; }')
  assert.equal(css.output, '.card{color:red;}')
  const javascript = await processTool('javascript-minifier', 'function add(a, b) { return a + b; }')
  assert.match(javascript.output, /function add/)
  const jsFormatted = await processTool('javascript-formatter', 'const obj={a:1}')
  assert.match(jsFormatted.output, /const obj = \{/)
  const sql = await processTool('sql-formatter', 'select id from users where active=true')
  assert.match(sql.output, /SELECT/)
})

test('cron presets, YAML conversions, and timestamps produce usable output', async () => {
  assert.match((await processTool('cron-generator', 'ignored', '', { choice: 'Every minute' })).output, /\* \* \* \* \*/)
  assert.match((await processTool('yaml-to-json', 'name: Ada\nactive: true')).output, /"name": "Ada"/)
  assert.match((await processTool('json-to-yaml', '{"name":"Ada"}')).output, /name: Ada/)
  assert.match((await processTool('timestamp-converter', '0')).output, /1970-01-01T00:00:00/)
})

test('generators validate bounds and generate unique UUIDs', async () => {
  const ids = (await processTool('uuid-generator', '5')).output.split('\n')
  assert.equal(ids.length, 5)
  assert.equal(new Set(ids).size, 5)
  await assert.rejects(processTool('password-generator', '7'), /between 8 and 128/)
})

test('color conversion and URL encoding handle valid and invalid values', async () => {
  assert.match((await processTool('color-converter', '#6366f1')).output, /RGB: rgb\(99, 102, 241\)/)
  assert.equal((await processTool('url-decoder', 'hello%20world')).output, 'hello world')
  await assert.rejects(processTool('url-decoder', '%xx'), /URI malformed/)
})
