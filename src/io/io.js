import { LIBRARY } from '../objects/library.js';
export const SCHEMA_VERSION = 2;

export function download(name, obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Lanza error si el JSON no es utilizable; devuelve avisos para elementos que se omitirán.
export function validate(j, sockets) {
  if (!j || typeof j !== 'object') throw new Error('El archivo no es un JSON válido.');
  if (j.schemaVersion > SCHEMA_VERSION) throw new Error(`Versión de esquema ${j.schemaVersion} no soportada (máx. ${SCHEMA_VERSION}).`);
  const warns = [];
  for (const o of j.objects || []) {
    if (!LIBRARY[o.type]) warns.push(`Tipo de objeto desconocido: ${o.type}`);
    else if (!sockets[o.socket]) warns.push(`Socket inexistente: ${o.socket} (${o.type})`);
  }
  return warns;
}
