#!/usr/bin/env node
// MedScanIT sitemap generator
// Runs at Netlify build time (see netlify.toml build command).
// Reads posts from blog_data.js (blogPosts array) and writes sitemap.xml at project root.
// Posts are served via /blog/<slug> which Netlify rewrites to /post.html.

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const blogDataPath = path.join(projectRoot, 'blog_data.js');
const sitemapOutputPath = path.join(projectRoot, 'sitemap.xml');

const DOMAIN = 'https://medscanit.netlify.app';

// Rule 2: block forbidden company slugs per user rules
const FORBIDDEN_SLUG_PATTERNS = [/i[n]deed/i, /s[y]ft/i];

function loadPosts() {
  const code = fs.readFileSync(blogDataPath, 'utf8');
  try {
    const fn = new Function(`${code}; return typeof blogPosts !== 'undefined' ? blogPosts : [];`);
    return fn();
  } catch (e) {
    console.error(`Failed to eval blog_data.js: ${e.message}`);
    const slugMatches = code.match(/slug:\s*['"`]([^'"`]+)['"`]/g) || [];
    return slugMatches.map(m => ({
      slug: m.replace(/slug:\s*['"`]/, '').replace(/['"`]$/, ''),
    }));
  }
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function main() {
  console.log('[MS] Generating sitemap...');

  const posts = loadPosts();
  console.log(`[MS] Loaded ${posts.length} posts from blog_data.js`);

  const lastmod = today();
  const urls = [];

  // Static pages
  urls.push({ loc: `${DOMAIN}/`, lastmod, changefreq: 'weekly', priority: '1.0' });
  urls.push({ loc: `${DOMAIN}/blog`, lastmod, changefreq: 'weekly', priority: '0.9' });

  // Blog posts
  let included = 0;
  let skipped = 0;
  const seenSlugs = new Set();

  for (const post of posts) {
    if (!post || !post.slug) {
      skipped++;
      continue;
    }
    if (seenSlugs.has(post.slug)) {
      skipped++;
      continue;
    }
    if (FORBIDDEN_SLUG_PATTERNS.some(re => re.test(post.slug))) {
      console.warn(`[MS] SKIP forbidden slug: ${post.slug}`);
      skipped++;
      continue;
    }

    seenSlugs.add(post.slug);

    const postLastmod = post.publishDate && /^\d{4}-\d{2}-\d{2}$/.test(post.publishDate)
      ? post.publishDate
      : lastmod;

    const encoded = encodeURIComponent(post.slug).replace(/%2F/g, '/');

    urls.push({
      loc: `${DOMAIN}/blog/${encoded}`,
      lastmod: postLastmod,
      changefreq: 'monthly',
      priority: '0.8',
    });
    included++;
  }

  console.log(`[MS] Included ${included} blog URLs, skipped ${skipped}`);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const u of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${xmlEscape(u.loc)}</loc>\n`;
    xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
    xml += `    <priority>${u.priority}</priority>\n`;
    xml += '  </url>\n';
  }
  xml += '</urlset>\n';

  fs.writeFileSync(sitemapOutputPath, xml, 'utf8');
  console.log(`[MS] Wrote ${urls.length} URLs to ${sitemapOutputPath}`);
}

main();
