export function readCsvRows(raw: string): string[][] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  const headers = rows[0] ?? [];
  return rows.slice(1).map((row) => {
    const item: Record<string, string> = {};
    headers.forEach((header, index) => {
      item[header] = row[index] ?? "";
    });
    return item;
  });
}

export function getCsvHeaders(raw: string): string[] {
  return readCsvRows(raw)[0] ?? [];
}
