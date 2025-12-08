export function base64ToBinary(base64: string): Uint8Array {
  const raw = atob(base64.split(",")[1]);
  const len = raw.length;
  const buffer = new Uint8Array(len);

  for (let i = 0; i < len; i++) buffer[i] = raw.charCodeAt(i);

  return buffer;
}
