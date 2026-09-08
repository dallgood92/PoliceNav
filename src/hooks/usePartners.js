import { useEffect, useState } from 'react';
import { subscribeToPartners } from '../services/partnerService';

export function usePartners() {
  const [partners, setPartners] = useState([]);

  useEffect(() => subscribeToPartners(setPartners), []);

  const updatePartner = async (updated) => {
    setPartners((items) => items.map((partner) => partner.id === updated.id ? updated : partner));
  };

  return { partners, updatePartner };
}
