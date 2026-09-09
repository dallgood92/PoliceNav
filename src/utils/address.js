function extractStreetNumber(address) {
  if (address?.streetNumber) return address.streetNumber;
  const match = address?.name?.match(/^\s*(\d+[A-Za-z]?)\b/);
  return match?.[1] ?? null;
}

export function deriveHundredBlock(address) {
  const rawNumber = extractStreetNumber(address);
  const numeric = Number.parseInt(rawNumber, 10);

  if (!Number.isFinite(numeric)) return null;
  return `${Math.floor(numeric / 100) * 100} BLOCK`;
}

export function formatStreet(address) {
  if (!address) return 'LOCATING STREET…';
  return (address.street || 'STREET UNAVAILABLE').toUpperCase();
}

export function formatLocality(address) {
  if (!address) return 'Waiting for address';
  return [address.city || address.district, address.region].filter(Boolean).join(', ') || 'Locality unavailable';
}

export function formatFullAddress(address) {
  if (!address) return 'Address unavailable';
  const firstLine = [extractStreetNumber(address), address.street].filter(Boolean).join(' ');
  const secondLine = [address.city || address.district, address.region, address.postalCode]
    .filter(Boolean)
    .join(', ');
  return [firstLine || address.name, secondLine].filter(Boolean).join('\n');
}
