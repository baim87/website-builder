const fs = require('fs');
const file = '/Users/baim/Documents/contractor-website-builder/backend/src/chat/chat-flow.engine.ts';
let code = fs.readFileSync(file, 'utf8');

const replacement = `
    if (meta.finalLogoUrl) {
      summaryText += \`| Logo | <img src="\${meta.finalLogoUrl}" width="80" style="border-radius:8px" /> |\\n\`;
    }
    if (meta.finalFaviconUrl) {
      summaryText += \`| Favicon | <img src="\${meta.finalFaviconUrl}" width="32" style="border-radius:4px" /> |\\n\`;
    }
    if (meta.finalPortraitUrl) {
      summaryText += \`| Portrait | <img src="\${meta.finalPortraitUrl}" width="80" style="border-radius:8px" /> |\\n\`;
    }
`;

code = code.replace(
  /if \(meta\.finalPortraitUrl\) \{\s*summaryText \+= `\| Portrait \| <img src="\$\{meta\.finalPortraitUrl\}" width="80" style="border-radius:8px" \/> \|\\n`;\s*\}/,
  replacement.trim()
);

fs.writeFileSync(file, code);
console.log("Fixed recap table");
