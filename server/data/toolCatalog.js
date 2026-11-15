const groups = {
  Text: [
    ['word-counter', 'Word Counter'], ['character-counter', 'Character Counter'], ['case-converter', 'Case Converter'],
    ['text-reverser', 'Text Reverser'], ['duplicate-lines', 'Remove Duplicate Lines'], ['extra-spaces', 'Remove Extra Spaces'],
    ['text-diff', 'Text Diff Checker'], ['lorem-ipsum', 'Lorem Ipsum Generator'], ['slug-generator', 'Slug Generator'],
    ['markdown-preview', 'Markdown Previewer'],
  ],
  JSON: [
    ['json-formatter', 'JSON Formatter'], ['json-validator', 'JSON Validator'], ['json-minifier', 'JSON Minifier'],
    ['json-beautifier', 'JSON Beautifier'], ['json-to-csv', 'JSON to CSV'], ['csv-to-json', 'CSV to JSON'],
    ['json-tree-viewer', 'JSON Tree Viewer'], ['json-escape', 'JSON Escape / Unescape'],
    ['json-schema-validator', 'JSON Schema Validator'],
  ],
  'HTML / CSS / JS': [
    ['html-formatter', 'HTML Formatter'], ['html-minifier', 'HTML Minifier'], ['css-formatter', 'CSS Formatter'],
    ['css-minifier', 'CSS Minifier'], ['javascript-formatter', 'JavaScript Formatter'],
    ['javascript-minifier', 'JavaScript Minifier'], ['html-entities', 'HTML Entity Encoder / Decoder'],
    ['css-gradient-generator', 'CSS Gradient Generator'], ['box-shadow-generator', 'Box Shadow Generator'],
    ['flexbox-playground', 'Flexbox Playground'], ['css-grid-generator', 'CSS Grid Generator'],
  ],
  Encoding: [
    ['base64-encoder', 'Base64 Encoder'], ['base64-decoder', 'Base64 Decoder'], ['url-encoder', 'URL Encoder'],
    ['url-decoder', 'URL Decoder'], ['html-encoder', 'HTML Encoder'], ['html-decoder', 'HTML Decoder'],
    ['jwt-decoder', 'JWT Decoder'], ['unicode-converter', 'Unicode Converter'], ['binary-to-text', 'Binary to Text'],
    ['text-to-binary', 'Text to Binary'], ['hex-to-text', 'Hex to Text'], ['text-to-hex', 'Text to Hex'],
  ],
  Utilities: [
    ['uuid-generator', 'UUID Generator'], ['password-generator', 'Random Password Generator'],
    ['hash-generator', 'Hash Generator'], ['timestamp-converter', 'Timestamp Converter'],
    ['unix-timestamp-generator', 'Unix Timestamp Generator'], ['cron-generator', 'Cron Expression Generator'],
    ['regex-tester', 'Regex Tester'], ['regex-explainer', 'Regex Explainer'], ['color-picker', 'Color Picker'],
    ['color-converter', 'Color Format Converter'], ['qr-generator', 'QR Code Generator'],
    ['ip-lookup', 'IP Address Information'], ['user-agent-parser', 'User Agent Parser'],
  ],
  Programming: [
    ['code-formatter', 'Code Formatter'], ['code-editor', 'Code Editor'], ['sql-formatter', 'SQL Formatter'],
    ['sql-minifier', 'SQL Minifier'], ['xml-formatter', 'XML Formatter'], ['xml-validator', 'XML Validator'],
    ['yaml-to-json', 'YAML to JSON'], ['json-to-yaml', 'JSON to YAML'], ['markdown-editor', 'Markdown Editor'],
    ['html-live-preview', 'HTML Live Preview'], ['javascript-playground', 'JavaScript Playground'],
  ],
}

export const toolCatalog = Object.entries(groups).flatMap(([category, entries]) => entries.map(([slug, name]) => ({
  slug,
  name,
  category,
  description: `${name} for a fast, private developer workflow.`,
  icon: 'Wrench',
  isActive: true,
})))
