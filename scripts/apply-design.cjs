const fs = require("fs");
const path = require("path");

const ROUTES_DIR = path.join(__dirname, "../src/routes/_authenticated");
const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".tsx"));

let totalChanges = 0;

for (const file of files) {
  const filepath = path.join(ROUTES_DIR, file);
  let content = fs.readFileSync(filepath, "utf-8");
  let changed = false;

  // 1. Add Reveal import if not present
  if (!content.includes('from "@/components/layout/Reveal"')) {
    const importLines = content.match(/^import .+? from .+?;?$/gm) || [];
    if (importLines.length > 0) {
      const lastImport = importLines[importLines.length - 1];
      content = content.replace(
        lastImport,
        lastImport + '\nimport { Reveal } from "@/components/layout/Reveal";'
      );
      changed = true;
    }
  }

  // 2. Add interactive-card to <Card> with NO attributes at all
  content = content.replace(/<Card>/g, () => {
    changed = true;
    return '<Card className="interactive-card">';
  });

  // 3. Add interactive-card to <Card ...> that does NOT already have className
  // Match: <Card prop="value" ...> but not <Card className=...>
  content = content.replace(/<Card\s+((?!className)[^>]*)>/g, (match, attrs) => {
    // Only change if attrs don't contain className
    if (!attrs.includes("className")) {
      changed = true;
      return `<Card className="interactive-card" ${attrs}>`;
    }
    return match;
  });

  // 4. Add interactive-row to <li> with NO className
  content = content.replace(/<li>(?!\s*className)/g, () => {
    changed = true;
    return '<li className="interactive-row">';
  });

  // 5. Add interactive-row to <li ...> without className
  content = content.replace(/<li\s+((?!className)[^>]*)>/g, (match, attrs) => {
    if (!attrs.includes("className")) {
      changed = true;
      return `<li className="interactive-row" ${attrs}>`;
    }
    return match;
  });

  // 6. Add interactive-row to <tr> with NO className
  content = content.replace(/<tr>(?!\s*className)/g, () => {
    changed = true;
    return '<tr className="interactive-row">';
  });

  // 7. Add interactive-row to <tr ...> without className
  content = content.replace(/<tr\s+((?!className)[^>]*)>/g, (match, attrs) => {
    if (!attrs.includes("className")) {
      changed = true;
      return `<tr className="interactive-row" ${attrs}>`;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(filepath, content, "utf-8");
    totalChanges++;
    console.log(`✅ Updated ${file}`);
  } else {
    console.log(`⏭️  Skipped ${file}`);
  }
}

console.log(`\nDone! ${totalChanges} files updated.`);
