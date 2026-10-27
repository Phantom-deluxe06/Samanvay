import type { AuditEvent } from './types';

export const GENESIS_HASH = '0'.repeat(64);

async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto is not available in this browser');
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

type Body = Omit<AuditEvent, 'hash' | 'prevHash'>;

/** The exact fields that are hashed, in a fixed order. */
function canonical(e: Body): string {
  return JSON.stringify({ id: e.id, at: e.at, actor: e.actor, role: e.role, action: e.action, target: e.target, detail: e.detail ?? null });
}

/** hash = sha256(prevHash + JSON(event)) */
export async function hashEvent(prevHash: string, e: Body): Promise<string> {
  return sha256Hex(prevHash + canonical(e));
}

export async function sealEvent(prevHash: string, e: Body): Promise<AuditEvent> {
  return { ...e, prevHash, hash: await hashEvent(prevHash, e) };
}

export interface ChainCheck { ok: boolean; checked: number; brokenAt?: { index: number; id: string; reason: string } }

export async function verifyChain(events: AuditEvent[]): Promise<ChainCheck> {
  let prev = GENESIS_HASH;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.prevHash !== prev) return { ok: false, checked: i, brokenAt: { index: i, id: e.id, reason: 'prevHash does not match the previous record' } };
    const h = await hashEvent(prev, e);
    if (h !== e.hash) return { ok: false, checked: i, brokenAt: { index: i, id: e.id, reason: 'Record content was changed after it was written' } };
    prev = e.hash;
  }
  return { ok: true, checked: events.length };
}
