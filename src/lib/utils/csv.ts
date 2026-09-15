/** Escape nilai CSV: kutip ganda jika mengandung koma/quote/newline. */
export function csvEscape(value: unknown): string {
    const s = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
    const lines = [headers.map(csvEscape).join(",")];
    for (const row of rows) lines.push(row.map(csvEscape).join(","));
    return lines.join("\r\n") + "\r\n";
}

/**
 * Parser CSV sederhana: dukung quoted field, kutip ganda escaped, newline dalam kutip.
 * Strip BOM (file Excel). TIDAK untuk file raksasa — import dibatasi 2MB di action.
 */
export function parseCsv(input: string): string[][] {
    const s = input.replace(/^\uFEFF/, "");
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    let i = 0;

    while (i < s.length) {
        const ch = s[i];
        if (inQuotes) {
            if (ch === '"') {
                if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
                inQuotes = false; i++; continue;
            }
            field += ch; i++; continue;
        }
        if (ch === '"') { inQuotes = true; i++; continue; }
        if (ch === ",") { row.push(field); field = ""; i++; continue; }
        if (ch === "\r") { i++; continue; }
        if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
        field += ch; i++;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}