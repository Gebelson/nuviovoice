import React, { useState, useEffect } from 'react';
import type {
  ProfessionalProfile,
  ProfessionalRole,
  WorkExperience,
  EducationItem,
  PortfolioItem,
  WorkModality,
} from '@concord/shared';
import { useOpportunityStore } from '../../stores/opportunityStore';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../ui/Avatar';
import { api } from '../../api/client';
import { useFormatters } from '../../i18n/formatters';

interface ProfessionalProfileViewProps {
  userId?: string;
  onBack?: () => void;
}

export function ProfessionalProfileView({ userId, onBack }: ProfessionalProfileViewProps) {
  const f = useFormatters();
  const currentUser = useAuthStore((s) => s.user);
  const { myProfile, fetchMyProfile, updateMyProfile } = useOpportunityStore();

  const isOwnProfile = !userId || userId === currentUser?.id;

  const [isEditing, setIsEditing] = useState(false);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [roles, setRoles] = useState<ProfessionalRole[]>(['freelancer', 'job_seeker']);
  const [skills, setSkills] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState('');
  const [experiences, setExperiences] = useState<WorkExperience[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [preferredModality, setPreferredModality] = useState<WorkModality>('remote');
  const [desiredSalary, setDesiredSalary] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [availability, setAvailability] = useState('Disponível');
  const [resumeUrl, setResumeUrl] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [hideContactInfo, setHideContactInfo] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [resumeAccess, setResumeAccess] = useState<'public' | 'applications_only'>('applications_only');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // New experience form state
  const [expTitle, setExpTitle] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expStart, setExpStart] = useState('');
  const [expEnd, setExpEnd] = useState('');
  const [expCurrent, setExpCurrent] = useState(false);
  const [expDesc, setExpDesc] = useState('');
  const [showExpModal, setShowExpModal] = useState(false);

  // New education form state
  const [eduDegree, setEduDegree] = useState('');
  const [eduInst, setEduInst] = useState('');
  const [eduYear, setEduYear] = useState('');
  const [showEduModal, setShowEduModal] = useState(false);

  // New portfolio item form state
  const [portTitle, setPortTitle] = useState('');
  const [portDesc, setPortDesc] = useState('');
  const [portUrl, setPortUrl] = useState('');
  const [showPortModal, setShowPortModal] = useState(false);

  useEffect(() => {
    if (isOwnProfile) {
      fetchMyProfile();
    }
  }, [isOwnProfile, fetchMyProfile]);

  useEffect(() => {
    if (myProfile && isOwnProfile) {
      setHeadline(myProfile.headline || '');
      setBio(myProfile.bio || '');
      setRoles(myProfile.roles || ['freelancer']);
      setSkills(myProfile.skills || []);
      setExperiences(myProfile.experiences || []);
      setEducation(myProfile.education || []);
      setPortfolio(myProfile.portfolio || []);
      setPreferredModality(myProfile.preferredModality || 'remote');
      setDesiredSalary(myProfile.desiredSalary ? String(myProfile.desiredSalary) : '');
      setHourlyRate(myProfile.hourlyRate ? String(myProfile.hourlyRate) : '');
      setAvailability(myProfile.availability || 'Disponível');
      setResumeUrl(myProfile.resumeUrl || '');
      setResumeName(myProfile.resumeName || '');
      setHideContactInfo(myProfile.privacySettings?.hideContactInfo ?? true);
      setIsPublic(myProfile.privacySettings?.isPublic ?? true);
      setResumeAccess(myProfile.privacySettings?.resumeAccess ?? 'applications_only');
    }
  }, [myProfile, isOwnProfile]);

  const toggleRole = (r: ProfessionalRole) => {
    if (roles.includes(r)) {
      setRoles(roles.filter((item) => item !== r));
    } else {
      setRoles([...roles, r]);
    }
  };

  const handleAddSkill = () => {
    if (!currentSkill.trim()) return;
    if (!skills.includes(currentSkill.trim())) {
      setSkills([...skills, currentSkill.trim()]);
    }
    setCurrentSkill('');
  };

  const handleRemoveSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handleAddExperience = () => {
    if (!expTitle.trim() || !expCompany.trim()) return;
    const newExp: WorkExperience = {
      id: crypto.randomUUID(),
      title: expTitle.trim(),
      company: expCompany.trim(),
      startDate: expStart.trim(),
      endDate: expCurrent ? undefined : expEnd.trim(),
      current: expCurrent,
      description: expDesc.trim() || undefined,
    };
    setExperiences([...experiences, newExp]);
    setExpTitle('');
    setExpCompany('');
    setExpStart('');
    setExpEnd('');
    setExpCurrent(false);
    setExpDesc('');
    setShowExpModal(false);
  };

  const handleAddEducation = () => {
    if (!eduDegree.trim() || !eduInst.trim()) return;
    const newEdu: EducationItem = {
      id: crypto.randomUUID(),
      degree: eduDegree.trim(),
      institution: eduInst.trim(),
      startYear: eduYear ? Number(eduYear) : 2020,
      year: eduYear ? Number(eduYear) : undefined,
    };
    setEducation([...education, newEdu]);
    setEduDegree('');
    setEduInst('');
    setEduYear('');
    setShowEduModal(false);
  };

  const handleAddPortfolioItem = () => {
    if (!portTitle.trim()) return;
    const newPort: PortfolioItem = {
      id: crypto.randomUUID(),
      title: portTitle.trim(),
      description: portDesc.trim() || undefined,
      url: portUrl.trim() || undefined,
    };
    setPortfolio([...portfolio, newPort]);
    setPortTitle('');
    setPortDesc('');
    setPortUrl('');
    setShowPortModal(false);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.opportunities.upload(formData);
      if (res?.url) {
        setResumeUrl(res.url);
        setResumeName(res.originalName || file.name);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar currículo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMyProfile({
        headline: headline.trim(),
        bio: bio.trim(),
        roles,
        skills,
        experiences,
        education,
        portfolio,
        preferredModality,
        desiredSalary: desiredSalary ? Number(desiredSalary) : undefined,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        availability: availability.trim(),
        resumeUrl: resumeUrl.trim() || undefined,
        resumeName: resumeName.trim() || undefined,
        privacySettings: {
          hideContactInfo,
          isPublic,
          resumeAccess,
        },
      });
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabels: Record<ProfessionalRole, string> = {
    job_seeker: 'Procurando Emprego',
    freelancer: 'Freelancer / Prestador',
    employer: 'Contratante / Recrutador',
    client: 'Cliente Contratante',
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner & Header */}
      <div className="relative rounded-2xl bg-gradient-to-r from-accent-primary/20 via-surface-panel to-surface-chat border border-border-hard p-6 md:p-8 shadow-xl overflow-hidden backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar
              user={currentUser as any}
              name={currentUser?.username || 'Usuário'}
              size={68}
              className="ring-4 ring-surface-panel shadow-xl"
            />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-extrabold text-white tracking-tight">{currentUser?.username}</h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-accent-primary/15 text-accent-primary border border-accent-primary/25">
                  Perfil Profissional
                </span>
              </div>
              <p className="text-sm font-medium text-txt-secondary mt-1">
                {headline || 'Adicione um título profissional para se destacar no Nuvio'}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-surface-channel/80 border border-border-hard text-txt-secondary"
                  >
                    {roleLabels[r]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {isOwnProfile && (
            <div className="flex items-center gap-2.5 self-end sm:self-center">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-txt-secondary hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSave}
                    className="px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-accent-primary/20"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 rounded-xl bg-surface-channel hover:bg-surface-elevated border border-border-hard text-xs font-bold text-white transition-colors flex items-center gap-2 shadow-sm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span>Editar Perfil</span>
                </button>
              )}
            </div>
          )}
        </div>

        {saveSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/15 border border-emerald-500/25 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Perfil profissional atualizado com sucesso!</span>
          </div>
        )}
      </div>

      {/* Profile Form (Edit mode) or View mode */}
      {isEditing ? (
        <div className="space-y-6">
          {/* Roles Selection */}
          <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
              Como você deseja atuar no Nuvio Oportunidades?
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(['job_seeker', 'freelancer', 'employer', 'client'] as ProfessionalRole[]).map((r) => {
                const active = roles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={`p-3.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                      active
                        ? 'bg-accent-primary/15 border-accent-primary/40 text-white shadow-sm'
                        : 'bg-surface-channel border-border-hard text-txt-secondary hover:text-white'
                    }`}
                  >
                    <span>{roleLabels[r]}</span>
                    {active && <span className="w-2 h-2 rounded-full bg-accent-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Headline & Bio */}
          <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Apresentação</h3>
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                Título Profissional (Headline)
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Ex: Engenheiro de Software Full Stack | React, Node.js & Cloud"
                className="w-full px-4 py-2.5 rounded-xl bg-surface-channel border border-border-hard hover:border-border-soft text-white text-sm focus:outline-none focus:border-accent-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                Sobre Mim / Resumo de Carreira
              </label>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Compartilhe suas especialidades, conquistas, histórico e o tipo de projeto que você busca..."
                className="w-full px-4 py-2.5 rounded-xl bg-surface-channel border border-border-hard hover:border-border-soft text-white text-sm focus:outline-none focus:border-accent-primary transition-all resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Skills */}
          <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
              Competências & Habilidades
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={currentSkill}
                onChange={(e) => setCurrentSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                placeholder="Ex: TypeScript, Figma, UI/UX, Docker..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface-channel border border-border-hard hover:border-border-soft text-white text-xs focus:outline-none focus:border-accent-primary transition-all"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold rounded-xl shadow-md shadow-accent-primary/20 transition-all"
              >
                + Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {skills.map((s, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-surface-channel border border-border-hard rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(i)}
                    className="text-rose-400 hover:text-rose-300 font-bold ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Work Preferences & Rates */}
          <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
              Preferências & Remuneração
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1.5">Modalidade Preferida</label>
                <select
                  value={preferredModality}
                  onChange={(e) => setPreferredModality(e.target.value as WorkModality)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-channel border border-border-hard text-white text-xs focus:outline-none focus:border-accent-primary transition-all"
                >
                  <option value="remote">Remoto</option>
                  <option value="hybrid">Híbrido</option>
                  <option value="onsite">Presencial</option>
                  <option value="negotiable">A combinar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1.5">Pretensão Salarial (R$/mês)</label>
                <input
                  type="number"
                  value={desiredSalary}
                  onChange={(e) => setDesiredSalary(e.target.value)}
                  placeholder="Ex: 9000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-channel border border-border-hard text-white text-xs focus:outline-none focus:border-accent-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1.5">Taxa Horária Freela (R$/h)</label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="Ex: 85"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-channel border border-border-hard text-white text-xs focus:outline-none focus:border-accent-primary transition-all"
                />
              </div>
            </div>
          </div>

          {/* Resume Upload & Privacy */}
          <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
              Currículo & Privacidade (LGPD)
            </h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-surface-channel rounded-xl border border-border-hard">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-accent-primary/15 text-accent-primary border border-accent-primary/25">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">
                    {resumeName || 'Nenhum currículo anexado'}
                  </span>
                  <span className="text-xs text-txt-tertiary">
                    {resumeUrl ? 'Currículo salvo com segurança' : 'Formatos suportados: PDF, DOC, DOCX'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {resumeUrl && (
                  <a
                    href={resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl border border-border-hard text-xs font-semibold text-txt-secondary hover:text-white transition-colors"
                  >
                    Ver Arquivo
                  </a>
                )}
                <label className="px-4 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold cursor-pointer transition-all shadow-md shadow-accent-primary/20">
                  {isUploading ? 'Enviando...' : resumeUrl ? 'Substituir Currículo' : 'Enviar Currículo'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleResumeUpload}
                  />
                </label>
              </div>
            </div>

            {/* Privacy Toggles */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideContactInfo}
                  onChange={(e) => setHideContactInfo(e.target.checked)}
                  className="rounded border-border-hard text-accent-primary focus:ring-accent-primary"
                />
                <span className="text-xs text-txt-secondary leading-relaxed">
                  <strong className="text-white">Ocultar dados de contato sensíveis:</strong> telefone e e-mail só serão visíveis após autorização expressa em candidaturas.
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded border-border-hard text-accent-primary focus:ring-accent-primary"
                />
                <span className="text-xs text-txt-secondary leading-relaxed">
                  <strong className="text-white">Visibilidade nas buscas:</strong> permitir que recrutadores e clientes encontrem meu perfil profissional no Nuvio.
                </span>
              </label>
            </div>
          </div>
        </div>
      ) : (
        /* View Mode */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="md:col-span-2 space-y-6">
            {/* About */}
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sobre Mim</h3>
              <p className="text-xs text-txt-secondary leading-relaxed whitespace-pre-line">
                {bio || 'Nenhuma descrição informada ainda.'}
              </p>
            </div>

            {/* Skills */}
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Competências</h3>
              <div className="flex flex-wrap gap-2">
                {skills.length > 0 ? (
                  skills.map((s, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-surface-channel border border-border-hard rounded-xl text-xs font-semibold text-white"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-txt-tertiary">Nenhuma competência adicionada.</span>
                )}
              </div>
            </div>

            {/* Experiences Timeline */}
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Experiência Profissional</h3>
              </div>
              <div className="space-y-4">
                {experiences.length > 0 ? (
                  experiences.map((exp, i) => (
                    <div key={i} className="relative pl-6 border-l-2 border-border-hard pb-2">
                      <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-accent-primary" />
                      <div className="text-xs font-bold text-white">{exp.title}</div>
                      <div className="text-xs text-accent-primary font-semibold mt-0.5">{exp.company}</div>
                      <div className="text-[11px] text-txt-tertiary mb-1.5">
                        {exp.startDate} - {exp.current ? 'Atual' : exp.endDate || 'Até o momento'}
                      </div>
                      {exp.description && (
                        <p className="text-xs text-txt-secondary leading-relaxed">{exp.description}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-txt-tertiary">Nenhuma experiência profissional cadastrada.</span>
                )}
              </div>
            </div>

            {/* Education */}
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Formação Acadêmica</h3>
              <div className="space-y-3">
                {education.length > 0 ? (
                  education.map((edu, i) => (
                    <div key={i} className="p-4 bg-surface-channel rounded-xl border border-border-hard">
                      <div className="text-xs font-bold text-white">{edu.degree}</div>
                      <div className="text-xs text-txt-secondary">{edu.institution}</div>
                      {edu.year && <div className="text-[11px] text-txt-tertiary mt-0.5">Ano: {edu.year}</div>}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-txt-tertiary">Nenhuma formação cadastrada.</span>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* Rates & Work Preferences */}
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Preferências</h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-txt-tertiary block font-medium">Disponibilidade</span>
                  <span className="font-bold text-white">{availability}</span>
                </div>
                <div>
                  <span className="text-txt-tertiary block font-medium">Modalidade</span>
                  <span className="font-bold text-white capitalize">{preferredModality}</span>
                </div>
                {desiredSalary && (
                  <div>
                    <span className="text-txt-tertiary block font-medium">Pretensão Salarial</span>
                    <span className="font-extrabold text-accent-primary">
                      {f.formatCurrency(Number(desiredSalary))} / mês
                    </span>
                  </div>
                )}
                {hourlyRate && (
                  <div>
                    <span className="text-txt-tertiary block font-medium">Taxa Freela</span>
                    <span className="font-extrabold text-accent-primary">
                      {f.formatCurrency(Number(hourlyRate))} / hora
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Resume preview card */}
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Currículo</h3>
              {resumeUrl ? (
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 bg-surface-channel hover:bg-surface-elevated border border-border-hard rounded-xl flex items-center justify-between text-xs font-semibold text-accent-primary transition-colors"
                >
                  <span className="truncate">{resumeName || 'Ver Currículo'}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </a>
              ) : (
                <p className="text-xs text-txt-tertiary">Nenhum currículo cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
