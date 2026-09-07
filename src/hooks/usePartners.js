import { useEffect, useState } from 'react';
import { subscribeToPartners } from '../services/partnerService';

export function usePartners() {
  const [partners, setPartners] = useState([]);

  useEffect(() => subscribeToPartners(setPartners), []);

  return partners;
}
