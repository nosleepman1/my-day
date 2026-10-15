const HEX = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'));
const TIMESTAMP_BYTES = 6;
const BYTE = 256;

/**
 * UUIDv7 généré par le client (ADR-011, ADR-016) : horodatage en millisecondes sur 48 bits puis aléa,
 * pour qu'une capture hors ligne garde son identifiant jusqu'au rejeu.
 */
export function uuidv7(now: number = Date.now()): string {
  const random = crypto.getRandomValues(new Uint8Array(16));
  const timestamp = Array.from(
    { length: TIMESTAMP_BYTES },
    (_, index) => Math.floor(now / BYTE ** (TIMESTAMP_BYTES - 1 - index)) % BYTE,
  );
  const version = 0x70 + ((random[6] ?? 0) % 16);
  const variant = 0x80 + ((random[8] ?? 0) % 64);
  const bytes = [...timestamp, version, ...random.slice(7, 8), variant, ...random.slice(9, 16)];
  const hex = bytes.map((byte) => HEX[byte] ?? '00').join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
