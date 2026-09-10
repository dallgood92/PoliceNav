import { distanceInMeters } from './geo';

export const SHARED_UNIT_DISTANCE_METERS = 22.86; // 75 feet

const callSignValue = (value) => String(value || '').trim();
const callSignCompare = (left, right) => callSignValue(left).localeCompare(callSignValue(right), undefined, { numeric: true });

export function sortedCrew(partner) {
  const occupants = partner.occupants?.length ? partner.occupants : [partner.name];
  return occupants.map((name, index) => ({
    name,
    callSign: callSignValue(partner.occupantCallSigns?.[index] || (index === 0 ? partner.callSign : '')),
  })).filter((member) => member.callSign).sort((left, right) => callSignCompare(left.callSign, right.callSign));
}

export function partnerCallSignLabel(partner) {
  const crew = sortedCrew(partner);
  return crew.length ? crew.map((member) => member.callSign).join(' | ') : callSignValue(partner.callSign) || '—';
}

export function collapseSharedUnitPartners(partners) {
  const orderedPartners = [...partners].sort((left, right) => sortedCrew(right).length - sortedCrew(left).length);
  const consumed = new Set();
  return orderedPartners.flatMap((partner, index) => {
    if (consumed.has(index)) return [];
    let crew = sortedCrew(partner);
    if (crew.length < 2) return [partner];

    const signature = crew.map((member) => member.callSign).join('|');
    orderedPartners.forEach((candidate, candidateIndex) => {
      if (candidateIndex <= index || consumed.has(candidateIndex)) return;
      const candidateCrew = sortedCrew(candidate);
      if (candidateCrew.length > 1 && candidateCrew.map((member) => member.callSign).join('|') === signature
        && distanceInMeters(partner.location, candidate.location) <= SHARED_UNIT_DISTANCE_METERS) consumed.add(candidateIndex);
    });

    const separatedCallSigns = new Set();
    for (const member of crew) {
      if (member.callSign === callSignValue(partner.callSign)) continue;
      const separateIndex = orderedPartners.findIndex((candidate, candidateIndex) => candidateIndex !== index
        && !consumed.has(candidateIndex)
        && callSignValue(candidate.callSign) === member.callSign
        && sortedCrew(candidate).length === 1);
      if (separateIndex < 0) continue;
      if (distanceInMeters(partner.location, orderedPartners[separateIndex].location) <= SHARED_UNIT_DISTANCE_METERS) consumed.add(separateIndex);
      else separatedCallSigns.add(member.callSign);
    }
    crew = crew.filter((member) => !separatedCallSigns.has(member.callSign));
    return [{
      ...partner,
      occupants: crew.map((member) => member.name),
      occupantCallSigns: crew.map((member) => member.callSign),
    }];
  });
}
