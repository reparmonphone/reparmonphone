// Exporte (LECTURE SEULE, ne modifie rien) le texte actuel des pages légales stockées en base vers
// scripts/cache/legal-<slug>.html, pour pouvoir les relire.
//   node scripts/export-legal-pages.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SLUGS = ['cgv', 'mentions-legales', 'confidentialite', 'livraison-retours'];

async function main() {
  const dir = path.join(__dirname, 'cache');
  fs.mkdirSync(dir, { recursive: true });
  for (const slug of SLUGS) {
    const page = await prisma.page.findUnique({ where: { slug } });
    if (!page) {
      console.log(`⚠️  Page "${slug}" introuvable en base.`);
      continue;
    }
    const file = path.join(dir, `legal-${slug}.html`);
    fs.writeFileSync(file, `<!-- ${page.title} -->\n${page.contentHtml}`, 'utf8');
    console.log(`✅ ${slug} → ${file} (${page.contentHtml.length} caractères)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
