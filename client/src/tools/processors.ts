import { md5 } from 'js-md5'
import type { Plugin } from 'prettier'

export type ToolResult = {
  output: string
  preview?: 'qr' | 'json-tree'
}

const pretty = async (input: string, parser: 'babel' | 'typescript' | 'json' | 'html' | 'css' | 'markdown', indent = 2) => {
  const prettier = await import('prettier/standalone')
  const parserPlugin = parser === 'json'
    ? await import('prettier/plugins/babel')
    : parser === 'typescript'
      ? await import('prettier/plugins/typescript')
    : parser === 'html'
      ? await import('prettier/plugins/html')
      : parser === 'css'
        ? await import('prettier/plugins/postcss')
        : parser === 'markdown'
          ? await import('prettier/plugins/markdown')
          : await import('prettier/plugins/babel')
  const plugins: Plugin[] = [parserPlugin as Plugin]
  if (parser === 'babel' || parser === 'typescript') plugins.push(await import('prettier/plugins/estree') as Plugin)
  return prettier.format(input, {
    parser,
    plugins,
    tabWidth: indent,
    useTabs: indent === 0,
    singleQuote: true,
    semi: true,
  })
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[char] ?? char)

const decodeHtml = (value: string) => {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

const minifyHtml = (input: string) => {
  const template = document.createElement('template')
  template.innerHTML = input
  const visit = (parent: Node, preserveText = false) => {
    for (const child of [...parent.childNodes]) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove()
      } else if (child.nodeType === Node.TEXT_NODE) {
        if (!preserveText) child.textContent = child.textContent?.replace(/\s+/g, ' ') ?? ''
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as Element).tagName
        visit(child, preserveText || ['PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'].includes(tag))
      }
    }
  }
  visit(template.content)
  return template.innerHTML
}

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

const decodeBase64 = (value: string) => {
  const binary = atob(value.trim())
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

const parseCsv = (csv: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      row.push(field)
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      field = ''
      if (char === '\r' && csv[index + 1] === '\n') index += 1
    } else {
      field += char
    }
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.')
  row.push(field)
  if (row.some((cell) => cell.length > 0)) rows.push(row)
  return rows
}

const jsonToCsv = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
    throw new Error('Provide a non-empty JSON array of objects.')
  }
  const columns = [...new Set(value.flatMap((item) => Object.keys(item as object)))]
  const cell = (value: unknown) => {
    const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [columns.map(cell).join(','), ...value.map((item) => columns.map((key) => cell((item as Record<string, unknown>)[key])).join(','))].join('\n')
}

const csvToJson = (input: string) => {
  const rows = parseCsv(input)
  if (rows.length < 2) throw new Error('CSV needs a header row and at least one data row.')
  const [headers, ...data] = rows
  if (headers.some((header) => !header.trim())) throw new Error('CSV headers cannot be empty.')
  if (new Set(headers).size !== headers.length) throw new Error('CSV headers must be unique.')
  return JSON.stringify(data.map((row) => {
    if (row.length !== headers.length) throw new Error('Each CSV row must have the same number of columns as the header.')
    return Object.fromEntries(headers.map((header, index) => [header, row[index]]))
  }), null, 2)
}

const codePointsToText = (value: string) => {
  const numbers = value.trim().split(/[\s,]+/).filter(Boolean).map((token) => {
    const normalized = token.replace(/^U\+/i, '').replace(/^0x/i, '')
    const parsed = Number.parseInt(normalized, 16)
    if (!/^[\da-f]+$/i.test(normalized) || parsed > 0x10ffff || (parsed >= 0xd800 && parsed <= 0xdfff)) {
      throw new Error(`Invalid Unicode code point: ${token}`)
    }
    return parsed
  })
  return String.fromCodePoint(...numbers)
}

const colorsToRgb = (value: string) => {
  const color = value.trim()
  const hex = color.match(/^#?([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    let digits = hex[1]
    if (digits.length === 3) digits = [...digits].map((digit) => digit + digit).join('')
    const value = Number.parseInt(digits, 16)
    return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 }
  }
  const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (rgb) {
    const components = rgb.slice(1).map(Number)
    if (components.some((part) => part < 0 || part > 255)) throw new Error('RGB values must be between 0 and 255.')
    return { r: Math.round(components[0]), g: Math.round(components[1]), b: Math.round(components[2]) }
  }
  const hsl = color.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i)
  if (hsl) {
    const h = ((Number(hsl[1]) % 360) + 360) % 360 / 360
    const s = Number(hsl[2]) / 100
    const l = Number(hsl[3]) / 100
    if (s > 1 || l > 1 || s < 0 || l < 0) throw new Error('HSL saturation and lightness must be 0–100%.')
    const hue = (n: number) => {
      const k = (n + h * 12) % 12
      const a = s * Math.min(l, 1 - l)
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    }
    return { r: Math.round(hue(0) * 255), g: Math.round(hue(8) * 255), b: Math.round(hue(4) * 255) }
  }
  throw new Error('Use a HEX (#rgb or #rrggbb), RGB, or HSL color.')
}

const rgbToHsl = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const red = r / 255, green = g / 255, blue = b / 255
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue)
  const delta = max - min
  const lightness = (max + min) / 2
  let hue = 0, saturation = 0
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1))
    switch (max) {
      case red: hue = ((green - blue) / delta) % 6; break
      case green: hue = (blue - red) / delta + 2; break
      default: hue = (red - green) / delta + 4
    }
    hue *= 60
  }
  return `hsl(${Math.round((hue + 360) % 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%)`
}

const regexPattern = (input: string) => {
  const slash = input.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/)
  return slash ? new RegExp(slash[1], slash[2]) : new RegExp(input)
}

const minifySql = (input: string) => {
  let output = ''
  let quote = ''
  let pendingSpace = false
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]
    if (quote) {
      output += char
      if (char === quote && next === quote) {
        output += next
        index += 1
      } else if (char === quote && input[index - 1] !== '\\') {
        quote = ''
      }
    } else if (char === "'" || char === '"' || char === '`') {
      if (pendingSpace && output && !/[ (.,;]/.test(output.at(-1)!)) output += ' '
      pendingSpace = false
      quote = char
      output += char
    } else if (char === '-' && next === '-') {
      while (index < input.length && input[index] !== '\n') index += 1
      pendingSpace = true
    } else if (char === '/' && next === '*') {
      index += 2
      while (index < input.length && !(input[index] === '*' && input[index + 1] === '/')) index += 1
      index += 1
      pendingSpace = true
    } else if (/\s/.test(char)) {
      pendingSpace = true
    } else {
      if (pendingSpace && output && !/[ (.,;]/.test(output.at(-1)!) && !/[),.;]/.test(char)) output += ' '
      pendingSpace = false
      output += char
    }
  }
  if (quote) throw new Error('SQL contains an unclosed quoted string or identifier.')
  return output.trim()
}

const minifyCss = (input: string) => {
  let output = ''
  let quote = ''
  let pendingSpace = false
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quote) {
      output += char
      if (char === quote && input[index - 1] !== '\\') quote = ''
    } else if (char === '"' || char === "'") {
      if (pendingSpace && /[\w-]/.test(output.at(-1) ?? '') && /[\w-]/.test(char)) output += ' '
      pendingSpace = false
      quote = char
      output += char
    } else if (char === '/' && input[index + 1] === '*') {
      index += 2
      while (index < input.length && !(input[index] === '*' && input[index + 1] === '/')) index += 1
      index += 1
      pendingSpace = true
    } else if (/\s/.test(char)) {
      pendingSpace = true
    } else {
      if (pendingSpace && /[\w-]/.test(output.at(-1) ?? '') && /[\w-]/.test(char)) output += ' '
      pendingSpace = false
      output += char
    }
  }
  if (quote) throw new Error('CSS contains an unclosed string.')
  return output.trim().replace(/\s*([{}:;,])\s*/g, '$1')
}

const getOption = (options: Record<string, string>, name: string, fallback: string) => options[name] ?? fallback

export async function processTool(
  slug: string,
  input: string,
  auxiliary = '',
  options: Record<string, string> = {},
): Promise<ToolResult> {
  const choice = getOption(options, 'choice', '')
  const indentChoice = getOption(options, 'indent', '2 spaces')
  const indent = indentChoice === 'Tabs' ? 0 : indentChoice === '4 spaces' ? 4 : 2
  const parsed = () => {
    try { return JSON.parse(input) as unknown } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON.'
      throw new Error(message)
    }
  }

  switch (slug) {
    case 'word-counter': {
      const words = input.trim().match(/\S+/g) ?? []
      const sentences = input.trim() ? input.trim().split(/[.!?]+/).filter((part) => part.trim()).length : 0
      return { output: `Words: ${words.length}\nCharacters: ${input.length}\nCharacters (no spaces): ${input.replace(/\s/g, '').length}\nSentences: ${sentences}\nParagraphs: ${input.trim() ? input.trim().split(/\n\s*\n/).length : 0}\nReading time: ${Math.max(1, Math.ceil(words.length / 200))} min` }
    }
    case 'character-counter':
      return { output: `Characters: ${input.length}\nWithout whitespace: ${input.replace(/\s/g, '').length}\nBytes (UTF-8): ${new TextEncoder().encode(input).length}` }
    case 'case-converter': {
      const words = input.trim().replace(/([a-z0-9])([A-Z])/g, '$1 $2').match(/[\p{L}\p{N}]+/gu) ?? []
      const lower = words.map((word) => word.toLowerCase())
      const title = lower.map((word) => word[0].toUpperCase() + word.slice(1))
      const output = ({
        lowercase: input.toLowerCase(),
        UPPERCASE: input.toUpperCase(),
        'Title Case': input.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()),
        camelCase: lower.map((word, index) => index ? word[0].toUpperCase() + word.slice(1) : word).join(''),
        PascalCase: title.join(''),
        snake_case: lower.join('_'),
        'kebab-case': lower.join('-'),
        CONSTANT_CASE: lower.join('_').toUpperCase(),
      } as Record<string, string>)[choice || 'lowercase']
      return { output: output ?? input.toLowerCase() }
    }
    case 'text-reverser':
      return { output: Array.from(input).reverse().join('') }
    case 'duplicate-lines':
      return { output: [...new Set(input.split(/\r?\n/))].join('\n') }
    case 'extra-spaces':
      return { output: input.split(/\r?\n/).map((line) => line.trim().replace(/\s+/g, ' ')).join('\n') }
    case 'text-diff': {
      const left = input.split(/\r?\n/)
      const right = auxiliary.split(/\r?\n/)
      const max = Math.max(left.length, right.length)
      return { output: Array.from({ length: max }, (_, i) => {
        if (left[i] === right[i]) return `  ${left[i] ?? ''}`
        return `${left[i] === undefined ? '' : `- ${left[i]}`}${left[i] !== undefined && right[i] !== undefined ? '\n' : ''}${right[i] === undefined ? '' : `+ ${right[i]}`}`
      }).join('\n') }
    }
    case 'lorem-ipsum': {
      const count = Number.parseInt(input, 10)
      if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('Enter a paragraph count from 1 to 20.')
      const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
      return { output: Array.from({ length: count }, () => paragraph).join('\n\n') }
    }
    case 'slug-generator':
      return { output: input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
    case 'json-formatter':
    case 'json-beautifier':
      return { output: JSON.stringify(parsed(), null, indent) }
    case 'json-validator':
      parsed()
      return { output: 'Valid JSON. The input parses successfully.' }
    case 'json-minifier':
      return { output: JSON.stringify(parsed()) }
    case 'json-to-csv':
      return { output: jsonToCsv(parsed()) }
    case 'csv-to-json':
      return { output: csvToJson(input) }
    case 'json-tree-viewer':
      return { output: JSON.stringify(parsed(), null, 2), preview: 'json-tree' }
    case 'json-escape':
      return { output: choice === 'Unescape' ? JSON.parse(`"${input.replace(/"/g, '\\"')}"`) as string : JSON.stringify(input).slice(1, -1) }
    case 'json-schema-validator': {
      const AjvModule = (await import('ajv')).default
      const validator = new AjvModule({ allErrors: true })
      const validate = validator.compile(JSON.parse(auxiliary))
      if (!validate(parsed())) {
        const issues = (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
        throw new Error(`Schema validation failed:\n${issues.join('\n')}`)
      }
      return { output: 'Valid. The JSON matches the supplied schema.' }
    }
    case 'html-formatter':
      return { output: await pretty(input, 'html') }
    case 'html-minifier':
      return { output: minifyHtml(input) }
    case 'css-formatter':
      return { output: await pretty(input, 'css') }
    case 'css-minifier':
      return { output: minifyCss(input) }
    case 'javascript-formatter':
      return { output: await pretty(input, 'babel') }
    case 'javascript-minifier': {
      const { minify } = await import('terser')
      const result = await minify(input)
      return { output: result.code ?? '' }
    }
    case 'html-entities':
    case 'html-encoder':
      return { output: choice === 'Decode' ? decodeHtml(input) : escapeHtml(input) }
    case 'html-decoder':
      return { output: decodeHtml(input) }
    case 'css-gradient-generator': {
      const colors = input.split(',').map((color) => color.trim()).filter(Boolean)
      if (colors.length < 2) throw new Error('Enter at least two comma-separated colors.')
      return { output: `background: linear-gradient(${auxiliary.trim() || '135deg'}, ${colors.join(', ')});` }
    }
    case 'box-shadow-generator': {
      const values = input.trim().split(/\s+/)
      if (values.length < 2 || values.length > 4 || values.some((value) => !/^-?[\d.]+(?:px|rem|em)$/.test(value))) {
        throw new Error('Enter 2–4 shadow lengths, for example: 12px 12px 30px.')
      }
      return { output: `box-shadow: ${values.join(' ')} ${auxiliary.trim() || 'rgba(0, 0, 0, 0.25)'};` }
    }
    case 'flexbox-playground':
      return { output: `.container {\n  display: flex;\n  justify-content: ${choice || input.trim() || 'center'};\n  align-items: center;\n  gap: 1rem;\n}` }
    case 'css-grid-generator': {
      const columns = Number.parseInt(input, 10)
      if (columns < 1 || columns > 12) throw new Error('Choose between 1 and 12 columns.')
      const gap = auxiliary.trim() || '16px'
      if (!/^\d+(?:px|rem|em|%)$/.test(gap)) throw new Error('Gap must be a non-negative px, rem, em, or % value.')
      return { output: `.grid {\n  display: grid;\n  grid-template-columns: repeat(${columns}, minmax(0, 1fr));\n  gap: ${gap};\n}` }
    }
    case 'base64-encoder':
      return { output: encodeBase64(input) }
    case 'base64-decoder':
      return { output: decodeBase64(input) }
    case 'url-encoder':
      return { output: encodeURIComponent(input) }
    case 'url-decoder':
      return { output: decodeURIComponent(input) }
    case 'jwt-decoder': {
      const parts = input.trim().split('.')
      if (parts.length !== 3) throw new Error('A JWT must contain three dot-separated parts.')
      const decodePart = (part: string) => JSON.parse(decodeBase64(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))) as unknown
      return { output: `Header:\n${JSON.stringify(decodePart(parts[0]), null, 2)}\n\nPayload:\n${JSON.stringify(decodePart(parts[1]), null, 2)}\n\nSignature: not verified` }
    }
    case 'unicode-converter':
      return { output: choice === 'Unicode to Text' ? codePointsToText(input) : Array.from(input).map((char) => `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(' ') }
    case 'binary-to-text': {
      const tokens = input.trim().split(/\s+/).filter(Boolean)
      if (!tokens.length || tokens.some((token) => !/^[01]{8}$/.test(token))) throw new Error('Enter one or more 8-bit binary bytes separated by spaces.')
      return { output: new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(tokens, (token) => Number.parseInt(token, 2))) }
    }
    case 'text-to-binary':
      return { output: [...new TextEncoder().encode(input)].map((byte) => byte.toString(2).padStart(8, '0')).join(' ') }
    case 'hex-to-text': {
      const hex = input.replace(/[\s,:-]/g, '')
      if (!hex || hex.length % 2 || !/^[\da-f]+$/i.test(hex)) throw new Error('Enter an even number of hexadecimal characters.')
      return { output: new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(hex.match(/../g) ?? [], (byte) => Number.parseInt(byte, 16))) }
    }
    case 'text-to-hex':
      return { output: [...new TextEncoder().encode(input)].map((byte) => byte.toString(16).padStart(2, '0')).join(' ') }
    case 'uuid-generator': {
      const count = Number.parseInt(input, 10)
      if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Enter a count from 1 to 100.')
      return { output: Array.from({ length: count }, () => crypto.randomUUID()).join('\n') }
    }
    case 'password-generator': {
      const length = Number.parseInt(input, 10)
      if (!Number.isInteger(length) || length < 8 || length > 128) throw new Error('Password length must be between 8 and 128.')
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+'
      const random = new Uint32Array(length)
      crypto.getRandomValues(random)
      return { output: [...random].map((number) => alphabet[number % alphabet.length]).join('') }
    }
    case 'hash-generator': {
      const method = choice || 'SHA-256'
      if (method === 'MD5') return { output: md5(input) }
      const algorithm = method.toUpperCase()
      const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(input))
      return { output: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('') }
    }
    case 'timestamp-converter': {
      const value = Number(input.trim())
      if (!Number.isFinite(value)) throw new Error('Enter a valid Unix timestamp.')
      const asMilliseconds = choice === 'Milliseconds' || (choice === 'Auto detect' && Math.abs(value) >= 1e12)
      const date = new Date(asMilliseconds ? value : value * 1000)
      if (Number.isNaN(date.getTime())) throw new Error('Timestamp is outside the supported date range.')
      return { output: `UTC: ${date.toISOString()}\nLocal: ${date.toLocaleString()}\nUnix seconds: ${Math.floor(date.getTime() / 1000)}\nUnix milliseconds: ${date.getTime()}` }
    }
    case 'unix-timestamp-generator': {
      const now = Date.now()
      return { output: `Seconds: ${Math.floor(now / 1000)}\nMilliseconds: ${now}` }
    }
    case 'cron-generator': {
      const presets: Record<string, string> = {
        'Every minute': '* * * * *',
        'Every hour': '0 * * * *',
        'Daily at midnight': '0 0 * * *',
        'Weekdays at 9:00 AM': '0 9 * * 1-5',
        'Every Monday at 9:00 AM': '0 9 * * 1',
      }
      const expression = presets[choice] ?? input.trim()
      const fields = expression.split(/\s+/)
      if (fields.length !== 5) throw new Error('Cron expression must have five fields: minute hour day-of-month month day-of-week.')
      const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]]
      fields.forEach((field, index) => {
        if (!/^[\d*/?,-]+$/.test(field)) throw new Error(`Invalid character in field ${index + 1}.`)
        for (const number of field.match(/\d+/g) ?? []) {
          if (Number(number) < ranges[index][0] || Number(number) > ranges[index][1]) throw new Error(`Field ${index + 1} has a value outside its valid range.`)
        }
      })
      return { output: `Cron expression: ${fields.join(' ')}\nFields: minute · hour · day of month · month · day of week` }
    }
    case 'regex-tester': {
      const regex = regexPattern(input)
      const matches = [...auxiliary.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`))]
      return { output: `Matches: ${matches.length}\n${matches.map((match, index) => `${index + 1}. "${match[0]}" at index ${match.index}`).join('\n') || 'No matches.'}` }
    }
    case 'regex-explainer': {
      const pattern = input.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/)
      const expression = pattern?.[1] ?? input
      const flags = pattern?.[2] ?? ''
      const tokens = expression.match(/\\[dDsSwWbB]|\\.|[()[\]{}]|[+*?]|\|/g) ?? []
      const explanations: Record<string, string> = { '\\d': 'digit', '\\D': 'non-digit', '\\s': 'whitespace', '\\S': 'non-whitespace', '\\w': 'word character', '\\W': 'non-word character', '\\b': 'word boundary', '\\B': 'non-word boundary', '+': 'one or more of the previous token', '*': 'zero or more of the previous token', '?': 'optional / zero or one', '|': 'alternation (OR)', '(': 'group start', ')': 'group end', '[': 'character class start', ']': 'character class end', '{': 'quantifier start', '}': 'quantifier end' }
      new RegExp(expression, flags)
      return { output: `Pattern: ${expression}\nFlags: ${flags || '(none)'}\n\nRecognized tokens:\n${tokens.map((token) => `• ${token}: ${explanations[token] ?? 'escaped character / token'}`).join('\n') || 'No common special tokens found.'}\n\nNote: this explains common tokens, not every engine-specific behavior.` }
    }
    case 'color-picker':
    case 'color-converter': {
      const rgb = colorsToRgb(input)
      const hex = `#${[rgb.r, rgb.g, rgb.b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
      return { output: `HEX: ${hex}\nRGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\nHSL: ${rgbToHsl(rgb)}` }
    }
    case 'qr-generator':
      return { output: await (await import('qrcode')).default.toDataURL(input, { width: 256, margin: 2, errorCorrectionLevel: 'M' }), preview: 'qr' }
    case 'ip-lookup': {
      const ip = input.trim()
      if (!/^[\da-f:.]+$/i.test(ip)) throw new Error('Enter a valid IPv4 or IPv6 address.')
      const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`)
      if (!response.ok) throw new Error(`IP lookup service returned ${response.status}.`)
      const data = await response.json() as Record<string, unknown>
      if (data.error) throw new Error(String(data.reason ?? 'IP lookup was unsuccessful.'))
      return { output: JSON.stringify(data, null, 2) }
    }
    case 'user-agent-parser': {
      const { UAParser } = await import('ua-parser-js')
      const result = new UAParser(input).getResult()
      return { output: JSON.stringify({ browser: result.browser, operatingSystem: result.os, device: result.device, engine: result.engine }, null, 2) }
    }
    case 'code-formatter':
    case 'code-editor': {
      const language = choice || 'JavaScript'
      const parser = language === 'JSON' ? 'json' : language === 'HTML' ? 'html' : language === 'CSS' ? 'css' : language === 'Markdown' ? 'markdown' : language === 'TypeScript' ? 'typescript' : 'babel'
      if (slug === 'code-editor') return { output: input }
      return { output: await pretty(input, parser) }
    }
    case 'sql-formatter':
      return { output: (await import('sql-formatter')).format(input, { language: 'sql', tabWidth: indent || 2, keywordCase: 'upper' }) }
    case 'sql-minifier':
      return { output: minifySql(input) }
    case 'xml-formatter':
    case 'xml-validator': {
      const documentXml = new DOMParser().parseFromString(input, 'application/xml')
      const parserError = documentXml.querySelector('parsererror')
      if (parserError) throw new Error(parserError.textContent?.split('\n')[0] || 'Invalid XML.')
      if (slug === 'xml-validator') return { output: 'Valid XML. The document is well-formed.' }
      const serializer = new XMLSerializer()
      const compact = serializer.serializeToString(documentXml)
      return { output: compact.replace(/>\s*</g, '>\n<').split('\n').map((line, index, lines) => {
        const previous = lines[index - 1] ?? ''
        const depth = Math.max(0, (previous.match(/<[^/!?][^>]*[^/]>/g) ?? []).length - (previous.match(/<\/[^>]+>/g) ?? []).length)
        return `${'  '.repeat(depth)}${line}`
      }).join('\n') }
    }
    case 'yaml-to-json':
      return { output: JSON.stringify((await import('js-yaml')).load(input), null, 2) }
    case 'json-to-yaml':
      return { output: (await import('js-yaml')).dump(parsed(), { noRefs: true, lineWidth: -1 }) }
    case 'markdown-editor':
    case 'markdown-preview':
      return { output: input }
    case 'html-live-preview':
    case 'javascript-playground':
      return { output: input }
    default:
      throw new Error(`No processor is registered for "${slug}".`)
  }
}
