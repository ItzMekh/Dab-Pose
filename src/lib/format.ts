// Vanity rounding for dab totals: 137 -> "100+", 1342 -> "1000+", 7 -> "7".
export function bucketDabs(n: number): string {
  if (n < 10) return String(n)
  const mag = Math.pow(10, Math.floor(Math.log10(n)))
  return `${Math.floor(n / mag) * mag}+`
}
