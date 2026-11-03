/**
 * Shared types, constants, and utilities for Nuvio Oportunidades
 * (Empregos, Projetos Freelancers e Serviços/Gigs)
 */

export type OpportunityType = 'job' | 'freelance' | 'gig';

export type OpportunityStatus = 'draft' | 'published' | 'paused' | 'closed' | 'archived';

export type WorkModality = 'remote' | 'hybrid' | 'onsite' | 'negotiable';

export type ContractType =
  | 'clt'
  | 'pj'
  | 'temporary'
  | 'internship'
  | 'apprentice'
  | 'contractor'
  | 'other';

export type RemunerationType =
  | 'fixed'
  | 'range'
  | 'hourly'
  | 'daily'
  | 'monthly'
  | 'yearly'
  | 'negotiable'
  | 'undisclosed';

export type BudgetType = 'fixed' | 'hourly' | 'negotiable' | 'undisclosed';

export type ExperienceLevel = 'entry' | 'junior' | 'mid' | 'senior' | 'lead' | 'any';

export type ApplicationType = 'job_application' | 'freelance_proposal' | 'gig_order';

export type ApplicationStatus =
  | 'submitted'
  | 'viewed'
  | 'under_review'
  | 'chat_unlocked'
  | 'rejected'
  | 'withdrawn'
  | 'archived';

export type NegotiationStatus = 'pending' | 'accepted' | 'countered' | 'declined' | 'completed';

export type ProfessionalRole = 'job_seeker' | 'freelancer' | 'employer' | 'client';

export interface OpportunityCategory {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

export const OPPORTUNITY_CATEGORIES: OpportunityCategory[] = [
  { id: 'development', name: 'Desenvolvimento & TI', icon: 'code' },
  { id: 'design', name: 'Design & Multimídia', icon: 'palette' },
  { id: 'audio_music', name: 'Áudio, Voz & Música', icon: 'music' },
  { id: 'video_animation', name: 'Vídeo & Animação', icon: 'video' },
  { id: 'writing_translation', name: 'Redação & Tradução', icon: 'pen' },
  { id: 'marketing_sales', name: 'Marketing & Vendas', icon: 'megaphone' },
  { id: 'admin_support', name: 'Suporte & Administrativo', icon: 'briefcase' },
  { id: 'engineering_3d', name: 'Modelagem 3D & Engenharia', icon: 'box' },
  { id: 'business_consulting', name: 'Gestão & Consultoria', icon: 'trending-up' },
  { id: 'other', name: 'Outras Áreas', icon: 'grid' },
];

export interface GigPackage {
  name: string;
  title?: string;
  description: string;
  price: number;
  deliveryDays: number;
  revisions: number;
  features?: string[];
}

export interface GigPackages {
  basic: GigPackage;
  standard?: GigPackage;
  premium?: GigPackage;
}

export interface ScreeningQuestion {
  id: string;
  question: string;
  required?: boolean;
}

export interface OpportunityItem {
  id: string;
  userId: string;
  type: OpportunityType;
  title: string;
  category: string;
  description: string;
  status: OpportunityStatus;

  // Organization & Presentation
  companyName?: string | null;
  companyLogo?: string | null;
  creatorRole?: 'individual' | 'recruiter' | 'organization';

  // Job specific
  contractType?: ContractType | null;
  responsibilities?: string | null;
  qualificationsMin?: string | null;
  qualificationsPref?: string | null;
  education?: string | null;
  experienceLevel?: ExperienceLevel | null;
  workSchedule?: string | null;
  remunerationType?: RemunerationType;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string;
  benefits?: string[];
  vacanciesCount?: number;
  deadline?: number | null;
  questions?: ScreeningQuestion[];
  documentsRequired?: string[];
  externalLink?: string | null;

  // Freelance specific
  budget?: number | null;
  budgetType?: 'fixed' | 'hourly' | 'negotiable' | 'undisclosed';
  skills?: string[];
  deliverables?: string | null;
  complexity?: 'simple' | 'medium' | 'complex' | null;
  expectedDuration?: string | null;

  // Gig specific
  coverImage?: string | null;
  gallery?: string[];
  deliveryDays?: number | null;
  revisionsCount?: number | null;
  packages?: GigPackages | null;
  servicesIncluded?: string | null;
  servicesExcluded?: string | null;
  faqs?: Array<{ question: string; answer: string }>;
  requirements?: string | null;

  // Location & Modality
  workModality: WorkModality;
  locationCountry?: string | null;
  locationState?: string | null;
  locationCity?: string | null;
  language?: string;

  // Metadata & Stats
  viewCount?: number;
  applicationCount?: number;
  isFavorite?: boolean;
  author?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
    verified?: boolean;
    headline?: string | null;
  };

  createdAt: number;
  updatedAt: number;
}

export interface WorkExperience {
  id: string;
  title: string;
  company: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  startYear?: number;
  endYear?: number;
  year?: number;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  url?: string;
  projectUrl?: string;
  imageUrl?: string;
  category?: string;
}

export interface LanguageItem {
  language: string;
  proficiency: 'basic' | 'intermediate' | 'fluent' | 'native';
}

export interface ProfessionalProfile {
  userId: string;
  headline?: string | null;
  bio?: string | null;
  roles: ProfessionalRole[];
  skills: string[];
  experiences: WorkExperience[];
  education: EducationItem[];
  portfolio: PortfolioItem[];
  languages: LanguageItem[];
  location?: string | null;
  workPreference?: 'remote' | 'hybrid' | 'onsite' | 'any';
  preferredModality?: 'remote' | 'hybrid' | 'onsite' | 'negotiable';
  expectedSalary?: string | null;
  desiredSalary?: number | null;
  hourlyRate?: number | null;
  availability?: string | null;
  resumeUrl?: string | null;
  resumeName?: string | null;
  isPublic: boolean;
  hideContactInfo: boolean;
  privacySettings?: {
    hideContactInfo?: boolean;
    isPublic?: boolean;
    resumeAccess?: 'public' | 'applications_only';
  };
  user?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
    verified?: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

export interface OpportunityApplication {
  id: string;
  opportunityId: string;
  applicantId: string;
  targetUserId: string;
  type: ApplicationType;
  status: ApplicationStatus;
  message: string;
  proposedPrice?: number | null;
  proposedDuration?: string | null;
  deliverables?: string | null;
  packageTier?: 'basic' | 'standard' | 'premium' | 'custom' | null;
  resumeUrl?: string | null;
  resumeName?: string | null;
  portfolioUrls?: string[];
  answers?: Array<{ questionId?: string; question: string; answer: string }>;
  attachments?: Array<{ url: string; name: string; size?: number; type?: string }>;

  opportunity?: Partial<OpportunityItem>;
  applicant?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
    verified?: boolean;
    headline?: string | null;
  };
  targetUser?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
  };

  reviewedAt?: number | null;
  unlockedAt?: number | null;
  rejectedAt?: number | null;
  withdrawnAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface OpportunityApplicationMessage {
  id: string;
  applicationId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'system' | 'proposal_terms' | 'audio' | 'file';
  attachments?: any[];
  sender?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
  };
  createdAt: number;
}

export interface OpportunityNegotiation {
  id: string;
  applicationId: string;
  senderId: string;
  receiverId: string;
  status: NegotiationStatus;
  price?: number | null;
  deadline?: string | null;
  scope?: string | null;
  deliverables?: string | null;
  revisions?: number | null;
  notes?: string | null;
  version: number;
  parentNegotiationId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface OpportunityFilters {
  search?: string;
  type?: OpportunityType;
  category?: string;
  modality?: WorkModality;
  contractType?: ContractType;
  experienceLevel?: ExperienceLevel;
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
  onlyFavorites?: boolean;
  sort?: 'recent' | 'salary_desc' | 'budget_desc' | 'popularity';
  limit?: number;
  offset?: number;
}

export interface CreateOpportunityRequest {
  type: OpportunityType;
  title: string;
  category: string;
  description: string;
  status?: OpportunityStatus;

  companyName?: string;
  companyLogo?: string;
  creatorRole?: 'individual' | 'recruiter' | 'organization';

  contractType?: ContractType;
  responsibilities?: string;
  qualificationsMin?: string;
  qualificationsPref?: string;
  education?: string;
  experienceLevel?: ExperienceLevel;
  workSchedule?: string;
  remunerationType?: RemunerationType;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  benefits?: string[];
  vacanciesCount?: number;
  deadline?: number;
  questions?: ScreeningQuestion[];
  documentsRequired?: string[];
  externalLink?: string;

  budget?: number;
  budgetType?: 'fixed' | 'hourly' | 'negotiable' | 'undisclosed';
  skills?: string[];
  deliverables?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  expectedDuration?: string;

  coverImage?: string;
  gallery?: string[];
  deliveryDays?: number;
  revisionsCount?: number;
  packages?: GigPackages;
  servicesIncluded?: string;
  servicesExcluded?: string;
  faqs?: Array<{ question: string; answer: string }>;
  requirements?: string;

  workModality: WorkModality;
  locationCountry?: string;
  locationState?: string;
  locationCity?: string;
  language?: string;
}

export interface ApplyOpportunityRequest {
  message: string;
  proposedPrice?: number;
  proposedDuration?: string;
  deliverables?: string;
  packageTier?: 'basic' | 'standard' | 'premium' | 'custom';
  resumeUrl?: string;
  resumeName?: string;
  portfolioUrls?: string[];
  answers?: Array<{ questionId?: string; question: string; answer: string }>;
  attachments?: Array<{ url: string; name: string; size?: number; type?: string }>;
}

export interface NegotiateOpportunityRequest {
  price?: number;
  deadline?: string;
  scope?: string;
  deliverables?: string;
  revisions?: number;
  notes?: string;
}

export interface OpportunityReportRequest {
  targetType: 'opportunity' | 'application';
  targetId: string;
  reason: string;
  details?: string;
}
