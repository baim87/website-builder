const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const data = await prisma.websiteData.findUnique({ where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' }});
  
  if (!data || !data.customComponents) {
    console.log("No custom components found");
    process.exit(0);
  }

  const newComponents = {};
  for (const [name, code] of Object.entries(data.customComponents)) {
    let newCode = code;
    
    // 1. Change { data }: any to { data, ...rest }: any
    // Some might not have : any, some might have spaces
    newCode = newCode.replace(/function\s+[a-zA-Z]+\s*\(\s*\{\s*data\s*\}\s*(:\s*any)?\s*\)/, (match, p1) => {
      const typeStr = p1 || ': any';
      return match.replace('{ data }', '{ data, ...rest }').replace(p1 || '', typeStr);
    });

    // 2. Inject {...rest} into the first root element
    // Look for <section, <header, <footer, <nav, <div
    // We only want to replace the FIRST occurrence in the return statement.
    // It's safest to just do a simple replace which replaces the first occurrence.
    const tagsToPatch = ['<section', '<header', '<footer', '<nav', '<div'];
    for (const tag of tagsToPatch) {
      if (newCode.includes(tag)) {
        newCode = newCode.replace(new RegExp(tag + '\\s+'), `${tag} {...rest} `);
        // also handle case where it's exactly the tag e.g. <section>
        newCode = newCode.replace(new RegExp(tag + '>'), `${tag} {...rest}>`);
        break; // Only patch the first one we find!
      }
    }
    
    newComponents[name] = newCode;
    console.log(`Patched ${name}`);
  }

  await prisma.websiteData.update({
    where: { id: data.id },
    data: { customComponents: newComponents }
  });

  console.log("Successfully patched all custom components in DB!");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
