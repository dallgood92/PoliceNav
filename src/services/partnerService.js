import { websocketUrl } from './locationApi';

export async function getPartners() {
  return [];
}

export function subscribeToPartners(onPartners) {
  const url = websocketUrl();
  if (!url) {
    onPartners([]);
    return () => {};
  }

  let disposed = false;
  let socket;
  let retryTimer;
  let partners = [];

  const publish = () => onPartners([...partners]);
  const upsert = (partner) => {
    partners = [...partners.filter((item) => item.id !== partner.id), partner]
      .sort((a, b) => a.name.localeCompare(b.name));
    publish();
  };

  const connect = () => {
    if (disposed) return;
    socket = new WebSocket(url);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'snapshot') {
          partners = Array.isArray(message.partners) ? message.partners : [];
          publish();
        } else if (message.type === 'partner:update') {
          upsert(message.partner);
        }
      } catch {
        // Keep the last valid live snapshot if the server sends malformed data.
      }
    };
    socket.onclose = () => {
      if (!disposed) retryTimer = setTimeout(connect, 2000);
    };
    socket.onerror = () => socket.close();
  };

  connect();
  return () => {
    disposed = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}
