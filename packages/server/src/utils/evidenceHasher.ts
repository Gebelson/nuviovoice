import { createHash, randomBytes } from 'node:crypto';

export interface MessageEvidencePayload {
  messageId?: string | null;
  authorId?: string | null;
  content?: string | null;
  timestamp?: number | null;
  attachments?: string | null;
}

export function computeSha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function canonicalizeEvidencePayload(data: MessageEvidencePayload): string {
  return JSON.stringify({
    attachments: data.attachments ?? '',
    authorId: data.authorId ?? '',
    content: data.content ?? '',
    messageId: data.messageId ?? '',
    timestamp: data.timestamp ?? 0,
  });
}

export function hashMessageEvidence(payload: MessageEvidencePayload): string {
  const canonical = canonicalizeEvidencePayload(payload);
  return computeSha256(canonical);
}

export function generateReportProtocol(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `REP-${dateStr}-${rand}`;
}

export function determineReportPriority(category: string): 'urgent' | 'high' | 'medium' | 'low' {
  switch (category) {
    case 'csam_exploitation':
    case 'threat':
    case 'violence':
    case 'extortion':
      return 'urgent';
    case 'harassment':
    case 'stalking':
    case 'fraud':
    case 'hate_speech':
      return 'high';
    case 'unauthorized_personal_data':
      return 'medium';
    default:
      return 'medium';
  }
}
