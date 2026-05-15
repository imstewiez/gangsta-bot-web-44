const postgres = require("postgres");
const fs = require("fs");
const path = require("path");

const sql = postgres(
  "postgresql://postgres:MvjrditCZFrsrwmHyUyAGVWGuevwYtKg@switchback.proxy.rlwy.net:58179/railway",
  { ssl: "require", max: 1 },
);

async function exportDb() {
  const outDir = path.join(__dirname, "../db-export");
  fs.mkdirSync(outDir, { recursive: true });

  let fullSql = "-- Exported from Railway PostgreSQL\n\n";

  // Export sequences
  const sequences = await sql`
    SELECT sequence_name 
    FROM information_schema.sequences 
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `;

  for (const { sequence_name } of sequences) {
    const seq = await sql`
      SELECT start_value, minimum_value, maximum_value, increment, cycle_option
      FROM information_schema.sequences
      WHERE sequence_schema = 'public' AND sequence_name = ${sequence_name}
    `;
    const s = seq[0];
    fullSql += `DROP SEQUENCE IF EXISTS "${sequence_name}";\n`;
    fullSql += `CREATE SEQUENCE "${sequence_name}"`;
    fullSql += ` START WITH ${s.start_value}`;
    fullSql += ` INCREMENT BY ${s.increment}`;
    fullSql += ` MINVALUE ${s.minimum_value}`;
    fullSql += ` MAXVALUE ${s.maximum_value}`;
    if (s.cycle_option === "YES") fullSql += ` CYCLE`;
    fullSql += `;\n\n`;
  }

  // List tables
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  console.log("Tables:", tables.length);

  for (const { table_name } of tables) {
    console.log(`Exporting ${table_name}...`);

    // Get columns
    const cols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table_name}
      ORDER BY ordinal_position
    `;

    // CREATE TABLE
    const colDefs = cols
      .map((c) => {
        let def = `  "${c.column_name}" ${c.data_type}`;
        if (c.column_default) def += ` DEFAULT ${c.column_default}`;
        if (c.is_nullable === "NO") def += " NOT NULL";
        return def;
      })
      .join(",\n");

    fullSql += `DROP TABLE IF EXISTS "${table_name}" CASCADE;\n`;
    fullSql += `CREATE TABLE "${table_name}" (\n${colDefs}\n);\n\n`;

    // Primary key
    const pkeys = await sql`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = ${table_name} AND tc.constraint_type = 'PRIMARY KEY'
    `;
    if (pkeys.length > 0) {
      fullSql += `ALTER TABLE "${table_name}" ADD PRIMARY KEY (${pkeys.map((k) => `"${k.column_name}"`).join(", ")});\n\n`;
    }

    // Get data count
    const countRes = await sql.unsafe(`SELECT count(*)::int as cnt FROM "${table_name}"`);
    const count = countRes[0]?.cnt ?? 0;

    if (count > 0) {
      const colNames = cols.map((c) => `"${c.column_name}"`).join(", ");
      fullSql += `COPY "${table_name}" (${colNames}) FROM STDIN;\n`;

      const rows = await sql.unsafe(`SELECT * FROM "${table_name}"`);
      for (const row of Array.from(rows)) {
        const line = cols
          .map((c) => {
            const v = row[c.column_name];
            if (v === null) return "\\N";
            let s = String(v);
            // Escape tabs, newlines, backslashes
            s = s.replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
            return s;
          })
          .join("\t");
        fullSql += line + "\n";
      }
      fullSql += "\\.\n\n";
    }
  }

  fs.writeFileSync(path.join(outDir, "dump.sql"), fullSql);
  console.log(`Done! Exported to ${path.join(outDir, "dump.sql")}`);
  await sql.end();
}

exportDb().catch((e) => {
  console.error(e);
  process.exit(1);
});
