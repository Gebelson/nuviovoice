export type VerificationCategory =
  | 'personal'
  | 'creator'
  | 'organization'
  | 'official'
  | 'space';

export type VerificationStatus =
  | 'none'
  | 'pending'
  | 'under_review'
  | 'info_requested'
  | 'verified'
  | 'rejected'
  | 'revoked';

export type VerificationMethod =
  | 'manual_review'
  | 'domain_dns'
  | 'domain_file'
  | 'official_grant';

export interface VerificationInfo {
  category: VerificationCategory;
  status: VerificationStatus;
  verifiedAt?: number | null;
  issuerInstance?: string | null;
  method?: VerificationMethod;
  publicLabel?: string | null;
  revokedAt?: number | null;
  revokedReason?: string | null;
}

export interface VerificationRequestData {
  id: string;
  requesterUserId: string;
  requesterUsername?: string | null;
  targetType: 'user' | 'space';
  targetId: string;
  targetName?: string | null;
  category: VerificationCategory;
  status: VerificationStatus;
  publicName: string;
  activityDescription?: string | null;
  officialWebsite?: string | null;
  socialLinks?: string[];
  professionalLinks?: string[];
  domainToVerify?: string | null;
  domainToken?: string | null;
  domainVerified?: boolean;
  evidenceNotes?: string | null;
  rejectionReason?: string | null;
  infoRequestNotes?: string | null;
  reviewedByAdminId?: string | null;
  reviewedByAdminUsername?: string | null;
  reviewedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface VerificationAuditLogEntry {
  id: string;
  action:
    | 'request_created'
    | 'status_changed'
    | 'approved'
    | 'rejected'
    | 'info_requested'
    | 'revoked'
    | 'official_granted';
  adminId?: string | null;
  adminUsername?: string | null;
  targetType: 'user' | 'space';
  targetId: string;
  targetName?: string | null;
  requestId?: string | null;
  category: VerificationCategory;
  justification: string;
  metadata?: Record<string, unknown> | null;
  createdAt: number;
}

export interface VerificationMetrics {
  totalVerified: number;
  verifiedAccounts: number;
  verifiedOrganizations: number;
  verifiedSpaces: number;
  pendingRequests: number;
  rejectedRequests: number;
  revokedVerifications: number;
  infoRequested: number;
}

export interface VerificationExplanation {
  title: string;
  description: string;
  badgeColor: 'blue' | 'green' | 'purple';
  iconType: 'check' | 'shield';
  disclaimer: string;
}

export function getVerificationExplanation(
  category: VerificationCategory | null | undefined
): VerificationExplanation {
  switch (category) {
    case 'organization':
      return {
        title: 'Organização verificada',
        description: 'O vínculo desta conta com a empresa, estúdio ou organização declarada foi comprovado.',
        badgeColor: 'green',
        iconType: 'check',
        disclaimer: 'O selo atesta representação autêntica da entidade, não constituindo garantia de conteúdo ou aprovação de produtos.',
      };
    case 'official':
      return {
        title: 'Equipe oficial Nuvio',
        description: 'Esta conta pertence a um membro autorizado da equipe do Nuvio.',
        badgeColor: 'purple',
        iconType: 'shield',
        disclaimer: 'Identificação exclusiva de colaboradores oficiais para suporte, anúncios e operações da plataforma.',
      };
    case 'creator':
      return {
        title: 'Criador de conteúdo verificado',
        description: 'O vínculo desta conta com a identidade pública e produção autoral declarada foi confirmado.',
        badgeColor: 'blue',
        iconType: 'check',
        disclaimer: 'Atesta a autenticidade do criador e não implica endosso institucional do Nuvio a opiniões ou materiais veiculados.',
      };
    case 'space':
      return {
        title: 'Espaço verificado',
        description: 'A autenticidade desta comunidade e seu vínculo com o responsável declarado foram confirmados pelo Nuvio.',
        badgeColor: 'blue',
        iconType: 'check',
        disclaimer: 'Confirmação de gestão comunitária oficial, não substituindo as regras e moderação interna do espaço.',
      };
    case 'personal':
    default:
      return {
        title: 'Conta verificada',
        description: 'A autenticidade desta conta foi confirmada pelo Nuvio.',
        badgeColor: 'blue',
        iconType: 'check',
        disclaimer: 'A verificação comprova identidade e controle legítimo da conta, sem constituir privilégio administrativo.',
      };
  }
}
