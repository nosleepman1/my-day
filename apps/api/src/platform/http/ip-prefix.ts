import { isIP } from 'node:net';

const IPV6_GROUPS = 8;
const IPV6_PREFIX_GROUPS = 3;
const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/** Développe une adresse IPv6 en 8 groupes hexadécimaux (sans zone `%eth0`, IPv4 final converti). */
function expandIpv6(address: string): string[] {
  const [withoutZone = ''] = address.split('%');
  const toGroups = (part: string): string[] =>
    part === ''
      ? []
      : part.split(':').flatMap((group) => {
          if (!group.includes('.')) return [group];
          const [a = 0, b = 0, c = 0, d = 0] = group.split('.').map(Number);
          return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)];
        });
  if (!withoutZone.includes('::')) return toGroups(withoutZone);
  const [head = '', tail = ''] = withoutZone.split('::');
  const headGroups = toGroups(head);
  const tailGroups = toGroups(tail);
  const zeros = Array.from({ length: IPV6_GROUPS - headGroups.length - tailGroups.length }, () => '0');
  return [...headGroups, ...zeros, ...tailGroups];
}

/**
 * Clé de limitation de débit par IP : IPv4 complète, IPv6 regroupée par /64 (un client IPv6 dispose
 * d'un /64 entier ; compter adresse par adresse rendrait la limite inopérante).
 */
export function ipThrottleKey(ip: string | null): string | null {
  if (ip === null) return null;
  const address = IPV4_MAPPED.exec(ip)?.[1] ?? ip;
  const version = isIP(address.split('%')[0] ?? '');
  if (version === 4) return address;
  if (version !== 6) return null;
  const prefix = expandIpv6(address)
    .slice(0, 4)
    .map((group) => Number.parseInt(group, 16).toString(16));
  return `${prefix.join(':')}::/64`;
}

/**
 * IP tronquée stockée avec une session (SECURITY.md §3.2, §9.1) : adresse réseau /24 (IPv4) ou /48 (IPv6),
 * bits d'hôte à zéro et sans suffixe CIDR, que le client Prisma refuse pour une colonne `inet`.
 * Une IPv4 encapsulée (`::ffff:a.b.c.d`) est traitée comme IPv4. `null` si l'adresse est absente ou invalide.
 */
export function ipPrefix(ip: string | null): string | null {
  if (ip === null) return null;
  const address = IPV4_MAPPED.exec(ip)?.[1] ?? ip;
  const version = isIP(address.split('%')[0] ?? '');
  if (version === 4) {
    const [a, b, c] = address.split('.');
    return `${a}.${b}.${c}.0`;
  }
  if (version !== 6) return null;
  const prefix = expandIpv6(address)
    .slice(0, IPV6_PREFIX_GROUPS)
    .map((group) => Number.parseInt(group, 16).toString(16));
  return `${prefix.join(':')}::`;
}
