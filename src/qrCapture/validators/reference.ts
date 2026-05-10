// ESR/BVR mod-10 recursive transition table. row = current carry, col = next digit.
const TABLE: readonly number[][] = [
  [0, 9, 4, 6, 8, 2, 7, 1, 3, 5],
  [9, 4, 6, 8, 2, 7, 1, 3, 5, 0],
  [4, 6, 8, 2, 7, 1, 3, 5, 0, 9],
  [6, 8, 2, 7, 1, 3, 5, 0, 9, 4],
  [8, 2, 7, 1, 3, 5, 0, 9, 4, 6],
  [2, 7, 1, 3, 5, 0, 9, 4, 6, 8],
  [7, 1, 3, 5, 0, 9, 4, 6, 8, 2],
  [1, 3, 5, 0, 9, 4, 6, 8, 2, 7],
  [3, 5, 0, 9, 4, 6, 8, 2, 7, 1],
  [5, 0, 9, 4, 6, 8, 2, 7, 1, 3],
];

export function computeMod10CheckDigit(body: string): number {
  let carry = 0;
  for (const ch of body) {
    if (ch < '0' || ch > '9') throw new Error(`non-digit: ${ch}`);
    const d = ch.charCodeAt(0) - '0'.charCodeAt(0);
    carry = TABLE[carry]![d]!;
  }
  return (10 - carry) % 10;
}

export function validateQRR(ref: string): boolean {
  const s = ref.replace(/\s+/g, '');
  if (s.length !== 27) return false;
  if (!/^\d{27}$/.test(s)) return false;
  const body = s.slice(0, 26);
  const check = Number(s[26]);
  return computeMod10CheckDigit(body) === check;
}

function letterValue(ch: string): number {
  return ch.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
}

function mod97(numericString: string): number {
  let remainder = 0;
  for (let i = 0; i < numericString.length; i += 7) {
    const chunk = String(remainder) + numericString.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }
  return remainder;
}

export function validateSCOR(ref: string): boolean {
  const s = ref.replace(/\s+/g, '').toUpperCase();
  if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(s)) return false;
  if (s.length < 5 || s.length > 25) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let numeric = '';
  for (const ch of rearranged) {
    if (ch >= '0' && ch <= '9') numeric += ch;
    else if (ch >= 'A' && ch <= 'Z') numeric += String(letterValue(ch));
    else return false;
  }
  return mod97(numeric) === 1;
}
