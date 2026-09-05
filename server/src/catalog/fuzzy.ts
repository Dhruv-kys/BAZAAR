const MIN_FUZZY_LENGTH = 4;

function distanceBudget(length: number): number {
  if (length < MIN_FUZZY_LENGTH) return 0;
  if (length <= 6) return 1;
  if (length <= 9) return 2;
  return 3;
}

export function damerauLevenshtein(a: string, b: string): number {
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i += 1) {
    rows.push(new Array<number>(b.length + 1).fill(0));
    rows[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

export function isNearMatch(word: string, token: string): boolean {
  if (word.length < MIN_FUZZY_LENGTH || token.length < MIN_FUZZY_LENGTH) return false;
  if (word[0] !== token[0]) return false;
  const budget = distanceBudget(Math.max(word.length, token.length));
  if (Math.abs(word.length - token.length) > budget) return false;
  return damerauLevenshtein(word, token) <= budget;
}
