// Escritor de .zip mínimo (sin compresión, "stored"): suficiente para empaquetar unos pocos archivos de texto sin dependencias.
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

// files: [{ name: 'maps/map1/map1.js', data: string | Uint8Array }] -> Uint8Array con el .zip
export function makeZip(files, date = new Date()) {
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const u16 = (v, a) => a.push(v & 255, (v >>> 8) & 255), u32 = (v, a) => a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = []; u32(0x04034b50, h); u16(20, h); u16(0x0800, h); u16(0, h); u16(time, h); u16(day, h); u32(crc, h); u32(data.length, h); u32(data.length, h); u16(name.length, h); u16(0, h);
    parts.push(Uint8Array.from(h), name, data);
    const c = []; u32(0x02014b50, c); u16(20, c); u16(20, c); u16(0x0800, c); u16(0, c); u16(time, c); u16(day, c); u32(crc, c); u32(data.length, c); u32(data.length, c);
    u16(name.length, c); u16(0, c); u16(0, c); u16(0, c); u16(0, c); u32(0, c); u32(offset, c);
    central.push(Uint8Array.from(c), name); offset += h.length + name.length + data.length;
  }
  const cSize = central.reduce((s, p) => s + p.length, 0), e = [];
  u32(0x06054b50, e); u16(0, e); u16(0, e); u16(files.length, e); u16(files.length, e); u32(cSize, e); u32(offset, e); u16(0, e);
  const all = [...parts, ...central, Uint8Array.from(e)], out = new Uint8Array(all.reduce((s, p) => s + p.length, 0)); let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}
