import 'dotenv/config'
import { readFile, writeFile } from 'node:fs/promises'

const sourcePath = new URL('../client/src/tools/catalog.ts', import.meta.url)
const sitemapPath = new URL('../client/public/sitemap.xml', import.meta.url)
const robotsPath = new URL('../client/public/robots.txt', import.meta.url)
const configuredUrl = process.env.VITE_SITE_URL
const siteUrl = new URL(configuredUrl || 'https://example.com').origin
const source = await readFile(sourcePath, 'utf8')
const slugs = [...source.matchAll(/\{ slug: '([^']+)'/g)].map((match) => match[1])
if (!slugs.length) throw new Error('No tool routes were found while generating the sitemap.')

const paths = [
  '/',
  '/tools',
  '/privacy-policy',
  '/terms-of-service',
  '/disclaimer',
  '/contact',
  ...slugs.map((slug) => `/tools/${slug}`),
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`).join('\n')}\n</urlset>\n`
await writeFile(sitemapPath, sitemap)
await writeFile(robotsPath, `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`)
if (!configuredUrl) console.warn('VITE_SITE_URL is unset; sitemap uses https://example.com. Set the production site URL before deploying.')
