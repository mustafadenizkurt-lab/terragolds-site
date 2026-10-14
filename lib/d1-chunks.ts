// D1 tek bir sorguda en fazla 100 bağlı değişken (?) kabul ediyor - "WHERE id
// IN (...)" listeleri bu sınırı aşınca "too many SQL variables" ile düşüyor.
// Kimlik listesini, diğer bağlı değişkenlere de yer bırakacak şekilde 90'lık
// parçalara böler.
export const D1_MAX_IN_IDS = 90;

export function chunkIds<T>(ids: T[], size = D1_MAX_IN_IDS): T[][] {
  const chunks: T[][] = [];
  for (let offset = 0; offset < ids.length; offset += size) {
    chunks.push(ids.slice(offset, offset + size));
  }
  return chunks;
}

export async function selectByIds<Row>(
  db: D1Database,
  ids: number[],
  buildSql: (placeholders: string) => string,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (const chunk of chunkIds(ids)) {
    const result = await db
      .prepare(buildSql(chunk.map(() => "?").join(",")))
      .bind(...chunk)
      .all<Row>();
    rows.push(...result.results);
  }
  return rows;
}
