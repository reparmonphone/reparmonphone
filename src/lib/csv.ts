// Génère un CSV simple (encodage UTF-8 avec BOM pour qu'Excel affiche correctement les accents)
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (val: string | number | null | undefined) => {
    const s = val === null || val === undefined ? '' : String(val);
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.map(escape).join(';'), ...rows.map((r) => r.map(escape).join(';'))];
  return '\uFEFF' + lines.join('\r\n');
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
