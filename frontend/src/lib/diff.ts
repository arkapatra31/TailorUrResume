export interface Seg { text: string; type: "same" | "add" | "del" }

const words = (s: string) => s.split(/(\s+)/).filter((x) => x.length);
const key = (w: string) => w.toLowerCase().replace(/[^a-z0-9+#.%$]/g, "");

/** Word-level LCS diff. */
export function wordDiff(a: string, b: string): { left: Seg[]; right: Seg[] } {
  const x = words(a), y = words(b);
  const n = x.length, m = y.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = key(x[i]) === key(y[j]) && key(x[i]) !== "" ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const left: Seg[] = [], right: Seg[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (key(x[i]) === key(y[j]) && key(x[i]) !== "") { left.push({ text: x[i], type: "same" }); right.push({ text: y[j], type: "same" }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) left.push({ text: x[i++], type: /^\s+$/.test(x[i - 1]) ? "same" : "del" });
    else right.push({ text: y[j++], type: /^\s+$/.test(y[j - 1]) ? "same" : "add" });
  }
  while (i < n) left.push({ text: x[i++], type: /^\s+$/.test(x[i - 1]) ? "same" : "del" });
  while (j < m) right.push({ text: y[j++], type: /^\s+$/.test(y[j - 1]) ? "same" : "add" });
  return { left, right };
}

export function similarity(a: string, b: string): number {
  const A = new Set(words(a).map(key).filter(Boolean)), B = new Set(words(b).map(key).filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / (A.size + B.size - inter);
}
