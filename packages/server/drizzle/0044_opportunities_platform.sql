CREATE TABLE IF NOT EXISTS professional_profiles (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT,
  bio TEXT,
  roles TEXT NOT NULL DEFAULT '["job_seeker"]',
  skills TEXT NOT NULL DEFAULT '[]',
  experiences TEXT NOT NULL DEFAULT '[]',
  education TEXT NOT NULL DEFAULT '[]',
  portfolio TEXT NOT NULL DEFAULT '[]',
  languages TEXT NOT NULL DEFAULT '[]',
  location TEXT,
  work_preference TEXT NOT NULL DEFAULT 'any',
  expected_salary TEXT,
  resume_url TEXT,
  resume_name TEXT,
  is_public INTEGER NOT NULL DEFAULT 1,
  hide_contact_info INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prof_profiles_public ON professional_profiles(is_public);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  company_name TEXT,
  company_logo TEXT,
  creator_role TEXT DEFAULT 'individual',
  contract_type TEXT,
  responsibilities TEXT,
  qualifications_min TEXT,
  qualifications_pref TEXT,
  education TEXT,
  experience_level TEXT,
  work_schedule TEXT,
  remuneration_type TEXT NOT NULL DEFAULT 'negotiable',
  salary_min INTEGER,
  salary_max INTEGER,
  currency TEXT NOT NULL DEFAULT 'BRL',
  benefits TEXT DEFAULT '[]',
  vacancies_count INTEGER NOT NULL DEFAULT 1,
  deadline INTEGER,
  questions TEXT DEFAULT '[]',
  documents_required TEXT DEFAULT '[]',
  external_link TEXT,
  budget INTEGER,
  budget_type TEXT,
  skills TEXT DEFAULT '[]',
  deliverables TEXT,
  complexity TEXT,
  expected_duration TEXT,
  cover_image TEXT,
  gallery TEXT DEFAULT '[]',
  delivery_days INTEGER,
  revisions_count INTEGER,
  packages TEXT,
  services_included TEXT,
  services_excluded TEXT,
  faqs TEXT DEFAULT '[]',
  requirements TEXT,
  work_modality TEXT NOT NULL DEFAULT 'remote',
  location_country TEXT,
  location_state TEXT,
  location_city TEXT,
  language TEXT NOT NULL DEFAULT 'pt',
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opportunities_user ON opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(type);
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_created ON opportunities(created_at);

CREATE TABLE IF NOT EXISTS opportunity_applications (
  id TEXT PRIMARY KEY NOT NULL,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  applicant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  message TEXT NOT NULL,
  proposed_price INTEGER,
  proposed_duration TEXT,
  deliverables TEXT,
  package_tier TEXT,
  resume_url TEXT,
  resume_name TEXT,
  portfolio_urls TEXT DEFAULT '[]',
  answers TEXT DEFAULT '[]',
  attachments TEXT DEFAULT '[]',
  reviewed_at INTEGER,
  unlocked_at INTEGER,
  rejected_at INTEGER,
  withdrawn_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opp_apps_opp ON opportunity_applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_apps_applicant ON opportunity_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_opp_apps_target ON opportunity_applications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_opp_apps_status ON opportunity_applications(status);
CREATE INDEX IF NOT EXISTS idx_opp_apps_created ON opportunity_applications(created_at);

CREATE TABLE IF NOT EXISTS opportunity_application_messages (
  id TEXT PRIMARY KEY NOT NULL,
  application_id TEXT NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  attachments TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opp_app_msgs_app ON opportunity_application_messages(application_id);
CREATE INDEX IF NOT EXISTS idx_opp_app_msgs_created ON opportunity_application_messages(created_at);

CREATE TABLE IF NOT EXISTS opportunity_negotiations (
  id TEXT PRIMARY KEY NOT NULL,
  application_id TEXT NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  price INTEGER,
  deadline TEXT,
  scope TEXT,
  deliverables TEXT,
  revisions INTEGER,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  parent_negotiation_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opp_negotiations_app ON opportunity_negotiations(application_id);
CREATE INDEX IF NOT EXISTS idx_opp_negotiations_created ON opportunity_negotiations(created_at);

CREATE TABLE IF NOT EXISTS opportunity_favorites (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_opp_favs_user_opp ON opportunity_favorites(user_id, opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_favs_user ON opportunity_favorites(user_id);

CREATE TABLE IF NOT EXISTS opportunity_reports (
  id TEXT PRIMARY KEY NOT NULL,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opp_reports_status ON opportunity_reports(status);
CREATE INDEX IF NOT EXISTS idx_opp_reports_reporter ON opportunity_reports(reporter_id);
