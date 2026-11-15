export type ToolCategory =
  | 'Text'
  | 'JSON'
  | 'HTML / CSS / JS'
  | 'Encoding'
  | 'Utilities'
  | 'Programming'

export type ToolDefinition = {
  slug: string
  name: string
  category: ToolCategory
  description: string
  icon: string
  sample: string
  auxiliaryLabel?: string
  auxiliarySample?: string
  options?: string[]
}

export const categories: ToolCategory[] = [
  'Text',
  'JSON',
  'HTML / CSS / JS',
  'Encoding',
  'Utilities',
  'Programming',
]

export const tools: ToolDefinition[] = [
  { slug: 'word-counter', name: 'Word Counter', category: 'Text', description: 'Count words, characters, sentences, and reading time.', icon: 'Type', sample: 'A focused workspace for everyday developer tools.' },
  { slug: 'character-counter', name: 'Character Counter', category: 'Text', description: 'Measure characters with and without whitespace.', icon: 'ScanText', sample: 'Count every character in this text.' },
  { slug: 'case-converter', name: 'Case Converter', category: 'Text', description: 'Convert text to camel, pascal, snake, kebab, and more.', icon: 'CaseSensitive', sample: 'DevTools Hub makes work flow faster.', options: ['lowercase', 'UPPERCASE', 'Title Case', 'camelCase', 'PascalCase', 'snake_case', 'kebab-case', 'CONSTANT_CASE'] },
  { slug: 'text-reverser', name: 'Text Reverser', category: 'Text', description: 'Reverse the order of characters in a string.', icon: 'MoveLeft', sample: 'Reverse this sentence.' },
  { slug: 'duplicate-lines', name: 'Remove Duplicate Lines', category: 'Text', description: 'Keep one copy of each line while preserving order.', icon: 'ListX', sample: 'alpha\nbeta\nalpha\ngamma\nbeta' },
  { slug: 'extra-spaces', name: 'Remove Extra Spaces', category: 'Text', description: 'Trim lines and collapse repeated whitespace.', icon: 'AlignLeft', sample: 'Remove    extra   spaces\n from   this text.' },
  { slug: 'text-diff', name: 'Text Diff Checker', category: 'Text', description: 'Compare two texts and show lines that changed.', icon: 'GitCompareArrows', sample: 'first version\nsame line\nold ending', auxiliaryLabel: 'Second text', auxiliarySample: 'updated version\nsame line\nnew ending' },
  { slug: 'lorem-ipsum', name: 'Lorem Ipsum Generator', category: 'Text', description: 'Generate placeholder paragraphs for designs and prototypes.', icon: 'TextQuote', sample: '3' },
  { slug: 'slug-generator', name: 'Slug Generator', category: 'Text', description: 'Create clean, URL-friendly slugs from text.', icon: 'Link2', sample: 'A better workflow for developers!' },
  { slug: 'markdown-preview', name: 'Markdown Previewer', category: 'Text', description: 'Write Markdown and preview the rendered document.', icon: 'FileText', sample: '# Welcome\n\nWrite **Markdown** here.\n\n- Fast\n- Private\n\n`npm run dev`' },

  { slug: 'json-formatter', name: 'JSON Formatter', category: 'JSON', description: 'Format JSON with readable indentation.', icon: 'Braces', sample: '{"name":"DevTools Hub","tools":["json","text"],"active":true}', options: ['2 spaces', '4 spaces', 'Tabs'] },
  { slug: 'json-validator', name: 'JSON Validator', category: 'JSON', description: 'Validate JSON syntax and report parse errors.', icon: 'BadgeCheck', sample: '{"valid": true, "count": 3}' },
  { slug: 'json-minifier', name: 'JSON Minifier', category: 'JSON', description: 'Remove unnecessary whitespace from JSON.', icon: 'Minimize2', sample: '{\n  "name": "DevTools Hub",\n  "active": true\n}' },
  { slug: 'json-beautifier', name: 'JSON Beautifier', category: 'JSON', description: 'Beautify compact JSON for easier reading.', icon: 'Sparkles', sample: '{"project":{"name":"devtools","version":1}}', options: ['2 spaces', '4 spaces', 'Tabs'] },
  { slug: 'json-to-csv', name: 'JSON to CSV', category: 'JSON', description: 'Convert an array of JSON objects to CSV.', icon: 'Table2', sample: '[{"name":"Ada","role":"Engineer"},{"name":"Linus","role":"Developer"}]' },
  { slug: 'csv-to-json', name: 'CSV to JSON', category: 'JSON', description: 'Convert CSV rows into an array of JSON objects.', icon: 'FileJson2', sample: 'name,role\nAda,Engineer\nLinus,Developer' },
  { slug: 'json-tree-viewer', name: 'JSON Tree Viewer', category: 'JSON', description: 'Inspect the structure of JSON as an indented tree.', icon: 'Network', sample: '{"user":{"name":"Ada","roles":["admin","author"]},"active":true}' },
  { slug: 'json-escape', name: 'JSON Escape / Unescape', category: 'JSON', description: 'Escape plain text for JSON strings or unescape JSON text.', icon: 'Brackets', sample: 'Line one\nLine "two"', options: ['Escape', 'Unescape'] },
  { slug: 'json-schema-validator', name: 'JSON Schema Validator', category: 'JSON', description: 'Validate JSON data against a JSON Schema.', icon: 'ListChecks', sample: '{"name":"Ada","age":32}', auxiliaryLabel: 'JSON Schema', auxiliarySample: '{"type":"object","required":["name"],"properties":{"name":{"type":"string"},"age":{"type":"integer"}}}' },

  { slug: 'html-formatter', name: 'HTML Formatter', category: 'HTML / CSS / JS', description: 'Format and indent HTML markup.', icon: 'Code2', sample: '<main><h1>Hello</h1><p>World</p></main>' },
  { slug: 'html-minifier', name: 'HTML Minifier', category: 'HTML / CSS / JS', description: 'Compact HTML by removing comments and whitespace.', icon: 'Minimize', sample: '<main>\n  <!-- greeting -->\n  <h1> Hello world </h1>\n</main>' },
  { slug: 'css-formatter', name: 'CSS Formatter', category: 'HTML / CSS / JS', description: 'Format CSS rules with consistent indentation.', icon: 'Paintbrush', sample: '.card{color:#fff;background:#121826;padding:1rem}' },
  { slug: 'css-minifier', name: 'CSS Minifier', category: 'HTML / CSS / JS', description: 'Minify CSS by removing comments and extra whitespace.', icon: 'Minimize', sample: '.card {\n  color: #ffffff;\n  padding: 16px;\n}' },
  { slug: 'javascript-formatter', name: 'JavaScript Formatter', category: 'HTML / CSS / JS', description: 'Format JavaScript with consistent indentation.', icon: 'Braces', sample: 'const greet=(name)=>{return `Hello, ${name}!`}' },
  { slug: 'javascript-minifier', name: 'JavaScript Minifier', category: 'HTML / CSS / JS', description: 'Minify JavaScript for smaller production bundles.', icon: 'Minimize', sample: 'function add(a, b) {\n  return a + b;\n}' },
  { slug: 'html-entities', name: 'HTML Entity Encoder / Decoder', category: 'HTML / CSS / JS', description: 'Encode special characters or decode HTML entities.', icon: 'CodeXml', sample: '<div class="demo">Hello & welcome</div>', options: ['Encode', 'Decode'] },
  { slug: 'css-gradient-generator', name: 'CSS Gradient Generator', category: 'HTML / CSS / JS', description: 'Build a CSS linear gradient and preview it live.', icon: 'Blend', sample: '#6366f1, #22d3ee', auxiliaryLabel: 'Direction', auxiliarySample: '135deg' },
  { slug: 'box-shadow-generator', name: 'Box Shadow Generator', category: 'HTML / CSS / JS', description: 'Generate a configurable CSS box shadow.', icon: 'Square', sample: '12px 12px 30px', auxiliaryLabel: 'Shadow color', auxiliarySample: 'rgba(0, 0, 0, 0.25)' },
  { slug: 'flexbox-playground', name: 'Flexbox Playground', category: 'HTML / CSS / JS', description: 'Generate a flexbox layout snippet and preview.', icon: 'PanelsTopLeft', sample: 'center', options: ['center', 'space-between', 'space-around', 'flex-start', 'flex-end'] },
  { slug: 'css-grid-generator', name: 'CSS Grid Generator', category: 'HTML / CSS / JS', description: 'Generate a responsive grid from a column count.', icon: 'Grid2X2', sample: '3', auxiliaryLabel: 'Gap (CSS length)', auxiliarySample: '16px' },

  { slug: 'base64-encoder', name: 'Base64 Encoder', category: 'Encoding', description: 'Encode UTF-8 text as Base64 in your browser.', icon: 'Binary', sample: 'Encode this text ✓' },
  { slug: 'base64-decoder', name: 'Base64 Decoder', category: 'Encoding', description: 'Decode Base64 text back to UTF-8.', icon: 'Binary', sample: 'RGV2VG9vbHMgSHVi' },
  { slug: 'url-encoder', name: 'URL Encoder', category: 'Encoding', description: 'Percent-encode a URL component safely.', icon: 'Link', sample: 'search tools & build faster' },
  { slug: 'url-decoder', name: 'URL Decoder', category: 'Encoding', description: 'Decode percent-encoded URL text.', icon: 'Unlink', sample: 'search%20tools%20%26%20build%20faster' },
  { slug: 'html-encoder', name: 'HTML Encoder', category: 'Encoding', description: 'Encode special characters as HTML entities.', icon: 'CodeXml', sample: '<section>Tom & Jerry</section>' },
  { slug: 'html-decoder', name: 'HTML Decoder', category: 'Encoding', description: 'Decode HTML entities to readable text.', icon: 'CodeXml', sample: '&lt;section&gt;Tom &amp; Jerry&lt;/section&gt;' },
  { slug: 'jwt-decoder', name: 'JWT Decoder', category: 'Encoding', description: 'Decode a JWT header and payload locally. This does not verify its signature.', icon: 'KeyRound', sample: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSIsImlhdCI6MTUxNjIzOTAyMn0.signature' },
  { slug: 'unicode-converter', name: 'Unicode Converter', category: 'Encoding', description: 'Convert text to Unicode code points and back.', icon: 'Languages', sample: 'Hello 🌍', options: ['Text to Unicode', 'Unicode to Text'] },
  { slug: 'binary-to-text', name: 'Binary to Text', category: 'Encoding', description: 'Decode space-separated binary bytes to text.', icon: 'Binary', sample: '01001000 01101001' },
  { slug: 'text-to-binary', name: 'Text to Binary', category: 'Encoding', description: 'Convert UTF-8 text into binary bytes.', icon: 'Binary', sample: 'Hi' },
  { slug: 'hex-to-text', name: 'Hex to Text', category: 'Encoding', description: 'Decode hexadecimal bytes to UTF-8 text.', icon: 'Hash', sample: '48656c6c6f' },
  { slug: 'text-to-hex', name: 'Text to Hex', category: 'Encoding', description: 'Convert UTF-8 text into hexadecimal bytes.', icon: 'Hash', sample: 'Hello' },

  { slug: 'uuid-generator', name: 'UUID Generator', category: 'Utilities', description: 'Generate cryptographically secure UUID v4 identifiers.', icon: 'Fingerprint', sample: '5' },
  { slug: 'password-generator', name: 'Password Generator', category: 'Utilities', description: 'Generate a strong random password locally.', icon: 'ShieldCheck', sample: '24' },
  { slug: 'hash-generator', name: 'Hash Generator', category: 'Utilities', description: 'Create a digest using MD5, SHA-1, SHA-256, or SHA-512.', icon: 'Hash', sample: 'Hash this text', options: ['SHA-256', 'SHA-1', 'SHA-512', 'MD5'] },
  { slug: 'timestamp-converter', name: 'Timestamp Converter', category: 'Utilities', description: 'Convert Unix seconds or milliseconds to a date and back.', icon: 'Clock3', sample: '1735689600', options: ['Auto detect', 'Seconds', 'Milliseconds'] },
  { slug: 'unix-timestamp-generator', name: 'Unix Timestamp Generator', category: 'Utilities', description: 'Get the current Unix timestamp in seconds and milliseconds.', icon: 'Timer', sample: 'now' },
  { slug: 'cron-generator', name: 'Cron Expression Generator', category: 'Utilities', description: 'Create and validate a five-field cron expression.', icon: 'CalendarClock', sample: '0 9 * * 1-5', options: ['Custom expression', 'Every minute', 'Every hour', 'Daily at midnight', 'Weekdays at 9:00 AM', 'Every Monday at 9:00 AM'] },
  { slug: 'regex-tester', name: 'Regex Tester', category: 'Utilities', description: 'Test a regular expression against sample text.', icon: 'Regex', sample: '\\b\\w+@\\w+\\.\\w+\\b', auxiliaryLabel: 'Test text', auxiliarySample: 'Contact dev@example.com for help.' },
  { slug: 'regex-explainer', name: 'Regex Explainer', category: 'Utilities', description: 'Inspect regex flags and common pattern tokens.', icon: 'ScanSearch', sample: '/\\b\\w+@\\w+\\.\\w+\\b/gi' },
  { slug: 'color-picker', name: 'Color Picker', category: 'Utilities', description: 'Preview a color and get common format values.', icon: 'Pipette', sample: '#6366f1' },
  { slug: 'color-converter', name: 'Color Format Converter', category: 'Utilities', description: 'Convert HEX, RGB, and HSL color formats.', icon: 'Palette', sample: '#6366f1' },
  { slug: 'qr-generator', name: 'QR Code Generator', category: 'Utilities', description: 'Create a downloadable QR code from text or a URL.', icon: 'QrCode', sample: 'https://example.com' },
  { slug: 'ip-lookup', name: 'IP Address Information', category: 'Utilities', description: 'Look up public IP details using an external service. The IP is sent to ipapi.co.', icon: 'Globe2', sample: '8.8.8.8' },
  { slug: 'user-agent-parser', name: 'User Agent Parser', category: 'Utilities', description: 'Parse browser, operating system, and device from a user agent.', icon: 'MonitorSmartphone', sample: typeof navigator === 'undefined' ? 'Mozilla/5.0' : navigator.userAgent },

  { slug: 'code-formatter', name: 'Code Formatter', category: 'Programming', description: 'Format JSON, HTML, CSS, JavaScript, or Markdown.', icon: 'Code2', sample: 'const config={enabled:true,tools:["json","css"]}', options: ['JavaScript', 'TypeScript', 'JSON', 'HTML', 'CSS', 'Markdown'] },
  { slug: 'code-editor', name: 'Code Editor', category: 'Programming', description: 'Edit code with Monaco Editor. Editing stays in your browser.', icon: 'FileCode2', sample: 'function greet(name: string) {\n  return `Hello ${name}`;\n}', options: ['JavaScript', 'TypeScript', 'JSON', 'HTML', 'CSS', 'Markdown'] },
  { slug: 'sql-formatter', name: 'SQL Formatter', category: 'Programming', description: 'Format SQL statements for readability.', icon: 'Database', sample: 'select id,name from users where active=true order by name' },
  { slug: 'sql-minifier', name: 'SQL Minifier', category: 'Programming', description: 'Compact SQL whitespace while preserving quoted text.', icon: 'Database', sample: 'SELECT id, name\nFROM users\nWHERE active = true;' },
  { slug: 'xml-formatter', name: 'XML Formatter', category: 'Programming', description: 'Format XML markup with readable indentation.', icon: 'FileCode', sample: '<root><user id="1"><name>Ada</name></user></root>' },
  { slug: 'xml-validator', name: 'XML Validator', category: 'Programming', description: 'Check XML well-formedness in the browser.', icon: 'BadgeCheck', sample: '<root><item>value</item></root>' },
  { slug: 'yaml-to-json', name: 'YAML to JSON', category: 'Programming', description: 'Parse YAML and convert it to formatted JSON.', icon: 'ArrowRightLeft', sample: 'name: DevTools Hub\nactive: true\ntags:\n  - developer\n  - tools' },
  { slug: 'json-to-yaml', name: 'JSON to YAML', category: 'Programming', description: 'Convert valid JSON to YAML.', icon: 'ArrowRightLeft', sample: '{"name":"DevTools Hub","active":true,"tags":["developer","tools"]}' },
  { slug: 'markdown-editor', name: 'Markdown Editor', category: 'Programming', description: 'Edit Markdown and preview it side by side.', icon: 'FilePenLine', sample: '# Notes\n\nWrite **Markdown** and see the preview.' },
  { slug: 'html-live-preview', name: 'HTML Live Preview', category: 'Programming', description: 'Preview HTML, CSS, and JavaScript in a sandboxed iframe.', icon: 'MonitorPlay', sample: '<h1>Hello, world!</h1>\n<p>Edit this HTML to preview it.</p>' },
  { slug: 'javascript-playground', name: 'JavaScript Playground', category: 'Programming', description: 'Run JavaScript in an isolated browser iframe, never on the server.', icon: 'Play', sample: 'document.body.innerHTML = "<h1>Hello from JavaScript</h1>";' },
]

export const findTool = (slug: string) => tools.find((tool) => tool.slug === slug)
