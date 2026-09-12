import { auth, onIdTokenChanged } from './firebase-config.js';

export function usageProductionLocation(location) {
  return location.origin === 'https://beckersabine082-art.github.io' &&
    (location.pathname === '/wifa-trainer-gruen/' || location.pathname === '/wifa-trainer-gruen/index.html');
}

export function createUsageClient({getUser,send,now = Date.now}) {
  let owner = null, generation = 0, nextFlush = now() + 60000, pending = false;
  const queue = new Map();
  const validUser = () => {
    const user = getUser();
    return user && user.emailVerified === true && user.uid === owner ? user : null;
  };
  return {
    accountChanged(user) {
      const next = user?.emailVerified === true ? user.uid : null;
      if (next === owner) return;
      owner = next; generation++; queue.clear();
      // Account changes do not bypass the page-wide request rate limit.
      nextFlush = Math.max(nextFlush, now() + 60000);
    },
    enqueue(value) {
      if (!validUser()) return;
      const event = window.WifaUsageSchema.clean(value);
      if (!event) return;
      const key = [event.event,event.subject,event.area].join('|');
      if (queue.size < 10 || queue.has(key)) queue.set(key,event);
    },
    async flush() {
      const user = validUser();
      if (!user) { queue.clear(); return; }
      if (pending || !queue.size || now() < nextFlush) return;
      const events = [...queue.values()], currentGeneration = generation;
      queue.clear(); pending = true; nextFlush = now() + 60000;
      try {
        const idToken = await user.getIdToken();
        if (generation !== currentGeneration || validUser() !== user) return;
        // Token retrieval may take time: rate-limit from actual dispatch too.
        nextFlush = now() + 60000;
        await send({action:'usageRecord',idToken,events});
      } catch (_) { /* Drop this batch; never retry or log tokens or payloads. */ }
      finally { pending = false; }
    }
  };
}

export function usageRequest(body) {
  return fetch(API_BASE_URL, {
    method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(body), credentials:'omit', referrerPolicy:'no-referrer', cache:'no-store',
    keepalive:true
  }).then(response => {
    if (!response.ok) throw new Error('usage_unavailable');
    return response.json();
  });
}

if (typeof document !== 'undefined' && window.WifaUsage && usageProductionLocation(window.location)) {
  const client = createUsageClient({getUser:() => auth.currentUser,send:usageRequest});
  window.WifaUsageEnqueue = value => client.enqueue(value);
  let currentOwner = null;
  onIdTokenChanged(auth, user => {
    const owner = user?.emailVerified === true ? user.uid : null;
    if (owner !== currentOwner) window.WifaUsage.setEnabled(false);
    currentOwner = owner; client.accountChanged(user);
    window.WifaUsage.setEnabled(owner !== null);
  });
  setInterval(() => { void client.flush(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void client.flush(); });
}
