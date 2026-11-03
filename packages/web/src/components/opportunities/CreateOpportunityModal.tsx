import React, { useState, useEffect } from 'react';
import type {
  OpportunityType,
  OpportunityItem,
  ContractType,
  WorkModality,
  RemunerationType,
  BudgetType,
  ExperienceLevel,
  GigPackages,
} from '@concord/shared';
import { OPPORTUNITY_CATEGORIES } from '@concord/shared';
import { Modal } from '../ui/Modal';
import { api } from '../../api/client';
import { useOpportunityStore } from '../../stores/opportunityStore';

interface CreateOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: OpportunityItem | null;
}

export function CreateOpportunityModal({ isOpen, onClose, initialData }: CreateOpportunityModalProps) {
  const { createOpportunity, updateOpportunity } = useOpportunityStore();

  const [activeTab, setActiveTab] = useState<'info' | 'details' | 'preview'>('info');
  const [type, setType] = useState<OpportunityType>('job');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(OPPORTUNITY_CATEGORIES[0]?.id || 'development');
  const [creatorRole, setCreatorRole] = useState<'individual' | 'recruiter' | 'organization'>('organization');
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [description, setDescription] = useState('');
  const [workModality, setWorkModality] = useState<WorkModality>('remote');
  const [locationCity, setLocationCity] = useState('');

  // Job specifics
  const [contractType, setContractType] = useState<ContractType>('clt');
  const [remunerationType, setRemunerationType] = useState<RemunerationType>('range');
  const [salaryMin, setSalaryMin] = useState<string>('');
  const [salaryMax, setSalaryMax] = useState<string>('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('mid');
  const [workSchedule, setWorkSchedule] = useState('');
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [currentResp, setCurrentResp] = useState('');
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [currentQual, setCurrentQual] = useState('');
  const [desiredQualifications, setDesiredQualifications] = useState<string[]>([]);
  const [currentDesQual, setCurrentDesQual] = useState('');
  const [benefits, setBenefits] = useState<string[]>([]);
  const [currentBenefit, setCurrentBenefit] = useState('');
  const [screeningQuestions, setScreeningQuestions] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');

  // Freelance specifics
  const [budgetType, setBudgetType] = useState<BudgetType>('fixed');
  const [budget, setBudget] = useState<string>('');
  const [duration, setDuration] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [currentDeliverable, setCurrentDeliverable] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState('');

  // Gig specifics
  const [deliveryDays, setDeliveryDays] = useState<string>('3');
  const [revisions, setRevisions] = useState<string>('2');
  const [hasTiers, setHasTiers] = useState(false);
  const [basicTitle, setBasicTitle] = useState('Básico');
  const [basicPrice, setBasicPrice] = useState('');
  const [basicDays, setBasicDays] = useState('3');
  const [basicRevs, setBasicRevs] = useState('1');
  const [basicDesc, setBasicDesc] = useState('');
  const [standardTitle, setStandardTitle] = useState('Padrão');
  const [standardPrice, setStandardPrice] = useState('');
  const [standardDays, setStandardDays] = useState('5');
  const [standardRevs, setStandardRevs] = useState('3');
  const [standardDesc, setStandardDesc] = useState('');
  const [premiumTitle, setPremiumTitle] = useState('Premium');
  const [premiumPrice, setPremiumPrice] = useState('');
  const [premiumDays, setPremiumDays] = useState('7');
  const [premiumRevs, setPremiumRevs] = useState('5');
  const [premiumDesc, setPremiumDesc] = useState('');
  const [portfolioLink, setPortfolioLink] = useState('');
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([]);

  const [externalUrl, setExternalUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize if editing
  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setTitle(initialData.title);
      setCategory(initialData.category || OPPORTUNITY_CATEGORIES[0]?.id || 'development');
      setCreatorRole(initialData.creatorRole || 'organization');
      setCompanyName(initialData.companyName || '');
      setCompanyLogo(initialData.companyLogo || '');
      setCoverImage(initialData.coverImage || '');
      setDescription(initialData.description);
      setWorkModality(initialData.workModality);
      setLocationCity(initialData.locationCity || '');
      if (initialData.contractType) setContractType(initialData.contractType);
      if (initialData.remunerationType) setRemunerationType(initialData.remunerationType);
      if (initialData.salaryMin) setSalaryMin(String(initialData.salaryMin));
      if (initialData.salaryMax) setSalaryMax(String(initialData.salaryMax));
      if (initialData.experienceLevel) setExperienceLevel(initialData.experienceLevel);
      if (initialData.workSchedule) setWorkSchedule(initialData.workSchedule);
      if (initialData.responsibilities) setResponsibilities(initialData.responsibilities.split('\n'));
      if (initialData.qualificationsMin) setQualifications(initialData.qualificationsMin.split('\n'));
      if (initialData.qualificationsPref) setDesiredQualifications(initialData.qualificationsPref.split('\n'));
      if (initialData.benefits) setBenefits(initialData.benefits);
      if (initialData.questions) setScreeningQuestions(initialData.questions.map((q) => q.question));

      if (initialData.budgetType) setBudgetType(initialData.budgetType);
      if (initialData.budget) setBudget(String(initialData.budget));
      if (initialData.expectedDuration) setDuration(initialData.expectedDuration);
      if (initialData.deliverables) setDeliverables(initialData.deliverables.split('\n'));
      if (initialData.skills) setSkills(initialData.skills);

      if (initialData.deliveryDays) setDeliveryDays(String(initialData.deliveryDays));
      if (initialData.revisionsCount !== undefined && initialData.revisionsCount !== null) {
        setRevisions(String(initialData.revisionsCount));
      }
      if (initialData.gallery) setPortfolioUrls(initialData.gallery);
      if (initialData.externalLink) setExternalUrl(initialData.externalLink);

      if (initialData.packages?.basic) {
        setHasTiers(true);
        setBasicTitle(initialData.packages.basic.title || initialData.packages.basic.name || 'Básico');
        setBasicPrice(String(initialData.packages.basic.price || ''));
        setBasicDays(String(initialData.packages.basic.deliveryDays || '3'));
        setBasicRevs(String(initialData.packages.basic.revisions || '1'));
        setBasicDesc(initialData.packages.basic.description || '');

        if (initialData.packages.standard) {
          setStandardTitle(initialData.packages.standard.title || initialData.packages.standard.name || 'Padrão');
          setStandardPrice(String(initialData.packages.standard.price || ''));
          setStandardDays(String(initialData.packages.standard.deliveryDays || '5'));
          setStandardRevs(String(initialData.packages.standard.revisions || '3'));
          setStandardDesc(initialData.packages.standard.description || '');
        }

        if (initialData.packages.premium) {
          setPremiumTitle(initialData.packages.premium.title || initialData.packages.premium.name || 'Premium');
          setPremiumPrice(String(initialData.packages.premium.price || ''));
          setPremiumDays(String(initialData.packages.premium.deliveryDays || '7'));
          setPremiumRevs(String(initialData.packages.premium.revisions || '5'));
          setPremiumDesc(initialData.packages.premium.description || '');
        }
      }
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'logo' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.opportunities.upload(formData);
      if (target === 'logo') setCompanyLogo(res.url);
      else setCoverImage(res.url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar imagem');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddItem = (
    value: string,
    setValue: (val: string) => void,
    list: string[],
    setList: (items: string[]) => void
  ) => {
    if (!value.trim()) return;
    setList([...list, value.trim()]);
    setValue('');
  };

  const handleRemoveItem = (index: number, list: string[], setList: (items: string[]) => void) => {
    setList(list.filter((_, i) => i !== index));
  };

  const handleSubmit = async (publishStatus: 'published' | 'draft') => {
    if (!title.trim()) {
      setErrorMsg('Título é obrigatório');
      setActiveTab('info');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Descrição é obrigatória');
      setActiveTab('info');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    let gigPackages: GigPackages | undefined = undefined;
    if (type === 'gig' && hasTiers) {
      gigPackages = {
        basic: {
          name: basicTitle,
          title: basicTitle,
          description: basicDesc,
          price: basicPrice ? Number(basicPrice) : 0,
          deliveryDays: Number(basicDays) || 3,
          revisions: Number(basicRevs) || 1,
        },
        standard: standardPrice
          ? {
              name: standardTitle,
              title: standardTitle,
              description: standardDesc,
              price: Number(standardPrice),
              deliveryDays: Number(standardDays) || 5,
              revisions: Number(standardRevs) || 3,
            }
          : undefined,
        premium: premiumPrice
          ? {
              name: premiumTitle,
              title: premiumTitle,
              description: premiumDesc,
              price: Number(premiumPrice),
              deliveryDays: Number(premiumDays) || 7,
              revisions: Number(premiumRevs) || 5,
            }
          : undefined,
      };
    }

    const payload: any = {
      type,
      title: title.trim(),
      category,
      creatorRole,
      companyName: companyName.trim() || undefined,
      companyLogo: companyLogo.trim() || undefined,
      coverImage: coverImage.trim() || undefined,
      description: description.trim(),
      workModality,
      locationCity: locationCity.trim() || undefined,
      status: publishStatus,
      // Job
      contractType: type === 'job' ? contractType : undefined,
      remunerationType: type === 'job' ? remunerationType : undefined,
      salaryMin: type === 'job' && salaryMin ? Number(salaryMin) : undefined,
      salaryMax: type === 'job' && salaryMax ? Number(salaryMax) : undefined,
      experienceLevel: type === 'job' ? experienceLevel : undefined,
      workSchedule: type === 'job' && workSchedule ? workSchedule.trim() : undefined,
      responsibilities: type === 'job' && responsibilities.length > 0 ? responsibilities.join('\n') : undefined,
      qualificationsMin: type === 'job' && qualifications.length > 0 ? qualifications.join('\n') : undefined,
      qualificationsPref: type === 'job' && desiredQualifications.length > 0 ? desiredQualifications.join('\n') : undefined,
      benefits: type === 'job' && benefits.length > 0 ? benefits : undefined,
      questions: type === 'job' && screeningQuestions.length > 0 ? screeningQuestions.map((q, idx) => ({ id: String(idx + 1), question: q })) : undefined,
      // Freelance
      budgetType: type === 'freelance' ? budgetType : undefined,
      budget: type === 'freelance' && budget ? Number(budget) : undefined,
      expectedDuration: type === 'freelance' && duration ? duration.trim() : undefined,
      deliverables: type === 'freelance' && deliverables.length > 0 ? deliverables.join('\n') : undefined,
      skills: (type === 'freelance' || type === 'gig') && skills.length > 0 ? skills : undefined,
      // Gig
      packages: gigPackages,
      deliveryDays: type === 'gig' && deliveryDays ? Number(deliveryDays) : undefined,
      revisionsCount: type === 'gig' && revisions !== '' ? Number(revisions) : undefined,
      gallery: portfolioUrls.length > 0 ? portfolioUrls : undefined,
      externalLink: externalUrl.trim() || undefined,
    };

    try {
      if (initialData) {
        await updateOpportunity(initialData.id, payload);
      } else {
        await createOpportunity(payload);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar oportunidade');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-3xl" mobileStyle="fullscreen">
      <div className="flex flex-col max-h-[85vh] overflow-hidden -m-6">
        {/* Header with Type selector */}
        <div className="p-6 pb-4 border-b border-border-card bg-surface-header">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-txt-primary">
              {initialData ? 'Editar Oportunidade' : 'Publicar Nova Oportunidade'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-txt-tertiary hover:text-txt-primary hover:bg-surface-card rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Type Selector (if not editing) */}
          {!initialData && (
            <div className="grid grid-cols-3 gap-2 p-1 bg-surface-base border border-border-card rounded-xl mb-4">
              <button
                type="button"
                onClick={() => setType('job')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  type === 'job'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-txt-secondary hover:text-txt-primary hover:bg-surface-card'
                }`}
              >
                Vaga de Emprego
              </button>
              <button
                type="button"
                onClick={() => setType('freelance')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  type === 'freelance'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-txt-secondary hover:text-txt-primary hover:bg-surface-card'
                }`}
              >
                Projeto Freelance
              </button>
              <button
                type="button"
                onClick={() => setType('gig')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  type === 'gig'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-txt-secondary hover:text-txt-primary hover:bg-surface-card'
                }`}
              >
                Serviço / Gig
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-4 text-xs font-semibold border-b border-border-card -mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`pb-2.5 transition-colors border-b-2 ${
                activeTab === 'info'
                  ? 'border-accent-primary text-accent-primary'
                  : 'border-transparent text-txt-tertiary hover:text-txt-primary'
              }`}
            >
              1. Informações Básicas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 transition-colors border-b-2 ${
                activeTab === 'details'
                  ? 'border-accent-primary text-accent-primary'
                  : 'border-transparent text-txt-tertiary hover:text-txt-primary'
              }`}
            >
              2. Detalhes & Pacotes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`pb-2.5 transition-colors border-b-2 ${
                activeTab === 'preview'
                  ? 'border-accent-primary text-accent-primary'
                  : 'border-transparent text-txt-tertiary hover:text-txt-primary'
              }`}
            >
              3. Prévia
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* TAB 1: INFO */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Título da Oportunidade *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    type === 'job'
                      ? 'Ex: Desenvolvedor React & TypeScript Sênior'
                      : type === 'freelance'
                      ? 'Ex: Criação de Identidade Visual e Logotipo 3D'
                      : 'Ex: Desenvolvo Bots para Discord e Nuvio em TypeScript'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-card border border-border-card text-txt-primary text-sm focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Categoria Profissional
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-card border border-border-card text-txt-primary text-sm focus:outline-none focus:border-accent-primary"
                  >
                    {OPPORTUNITY_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Modalidade de Trabalho
                  </label>
                  <select
                    value={workModality}
                    onChange={(e) => setWorkModality(e.target.value as WorkModality)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-card border border-border-card text-txt-primary text-sm focus:outline-none focus:border-accent-primary"
                  >
                    <option value="remote">Remoto (100% Home Office)</option>
                    <option value="hybrid">Híbrido</option>
                    <option value="onsite">Presencial</option>
                    <option value="negotiable">A combinar</option>
                  </select>
                </div>
              </div>

              {workModality !== 'remote' && (
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Localização (Cidade, Estado ou Região)
                  </label>
                  <input
                    type="text"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    placeholder="Ex: São Paulo, SP - Brasil"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-card border border-border-card text-txt-primary text-sm focus:outline-none focus:border-accent-primary"
                  />
                  <span className="text-[11px] text-txt-tertiary mt-1 block">
                    Por privacidade, informe apenas cidade ou região geral, nunca o endereço completo.
                  </span>
                </div>
              )}

              {/* Company / Announcer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Anunciar Como
                  </label>
                  <select
                    value={creatorRole}
                    onChange={(e) => setCreatorRole(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-card border border-border-card text-txt-primary text-sm focus:outline-none focus:border-accent-primary"
                  >
                    <option value="organization">Empresa / Organização</option>
                    <option value="recruiter">Recrutador / Headhunter</option>
                    <option value="individual">Pessoa Física / Profissional Autônomo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Nome da Empresa / Contratante
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Nuvio Studios"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-card border border-border-card text-txt-primary text-sm focus:outline-none focus:border-accent-primary"
                  />
                </div>
              </div>

              {/* Upload Logo / Cover */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Logotipo / Foto do Anunciante
                  </label>
                  <div className="flex items-center gap-3">
                    {companyLogo ? (
                      <img
                        src={companyLogo}
                        alt="Logo"
                        className="w-12 h-12 rounded-xl object-cover border border-border-card"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-surface-card border border-border-card flex items-center justify-center text-txt-tertiary text-xs">
                        Logo
                      </div>
                    )}
                    <label className="px-3.5 py-2 rounded-xl border border-border-card bg-surface-card hover:bg-surface-card-hover text-xs font-semibold text-txt-secondary cursor-pointer transition-colors">
                      {isUploading ? 'Enviando...' : 'Carregar Imagem'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, 'logo')}
                      />
                    </label>
                  </div>
                </div>

                {type === 'gig' && (
                  <div>
                    <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                      Imagem de Capa do Serviço
                    </label>
                    <div className="flex items-center gap-3">
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt="Cover"
                          className="w-12 h-12 rounded-xl object-cover border border-border-card"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-surface-card border border-border-card flex items-center justify-center text-txt-tertiary text-xs">
                          Capa
                        </div>
                      )}
                      <label className="px-3.5 py-2 rounded-xl border border-border-card bg-surface-card hover:bg-surface-card-hover text-xs font-semibold text-txt-secondary cursor-pointer transition-colors">
                        {isUploading ? 'Enviando...' : 'Carregar Capa'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'cover')}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Descrição Completa *
                </label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva detalhadamente a oportunidade, escopo, objetivos e expectativas..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-card border border-border-card text-txt-primary text-sm focus:outline-none focus:border-accent-primary resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* If Job */}
              {type === 'job' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                        Tipo de Contratação
                      </label>
                      <select
                        value={contractType}
                        onChange={(e) => setContractType(e.target.value as ContractType)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                      >
                        <option value="clt">CLT</option>
                        <option value="pj">PJ</option>
                        <option value="internship">Estágio</option>
                        <option value="apprentice">Jovem Aprendiz</option>
                        <option value="temporary">Temporário</option>
                        <option value="contract">Contrato</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                        Nível de Experiência
                      </label>
                      <select
                        value={experienceLevel}
                        onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                      >
                        <option value="entry">Entrada / Estágio</option>
                        <option value="junior">Júnior</option>
                        <option value="mid">Pleno</option>
                        <option value="senior">Sênior</option>
                        <option value="lead">Especialista / Lead</option>
                        <option value="any">Qualquer Nível</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                        Tipo de Remuneração
                      </label>
                      <select
                        value={remunerationType}
                        onChange={(e) => setRemunerationType(e.target.value as RemunerationType)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                      >
                        <option value="range">Faixa Salarial</option>
                        <option value="fixed">Valor Fixo</option>
                        <option value="hourly">Por Hora</option>
                        <option value="negotiable">A Combinar</option>
                        <option value="undisclosed">Não Informado</option>
                      </select>
                    </div>
                  </div>

                  {remunerationType !== 'negotiable' && remunerationType !== 'undisclosed' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                          {remunerationType === 'range' ? 'Salário Mínimo (R$)' : 'Salário / Valor (R$)'}
                        </label>
                        <input
                          type="number"
                          value={salaryMin}
                          onChange={(e) => setSalaryMin(e.target.value)}
                          placeholder="Ex: 5000"
                          className="w-full px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                        />
                      </div>
                      {remunerationType === 'range' && (
                        <div>
                          <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                            Salário Máximo (R$)
                          </label>
                          <input
                            type="number"
                            value={salaryMax}
                            onChange={(e) => setSalaryMax(e.target.value)}
                            placeholder="Ex: 8000"
                            className="w-full px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Responsibilities list */}
                  <div>
                    <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                      Responsabilidades e Atividades
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={currentResp}
                        onChange={(e) => setCurrentResp(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItem(currentResp, setCurrentResp, responsibilities, setResponsibilities);
                          }
                        }}
                        placeholder="Ex: Desenvolver interfaces fluidas em React e Tailwind..."
                        className="flex-1 px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItem(currentResp, setCurrentResp, responsibilities, setResponsibilities)}
                        className="px-3.5 py-2 bg-surface-card hover:bg-surface-card-hover border border-border-card text-xs font-bold text-accent-primary rounded-xl"
                      >
                        + Adicionar
                      </button>
                    </div>
                    <div className="space-y-1">
                      {responsibilities.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-surface-card rounded-lg text-xs">
                          <span>{r}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(i, responsibilities, setResponsibilities)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Qualifications */}
                  <div>
                    <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                      Qualificações Mínimas
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={currentQual}
                        onChange={(e) => setCurrentQual(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItem(currentQual, setCurrentQual, qualifications, setQualifications);
                          }
                        }}
                        placeholder="Ex: 3+ anos com TypeScript e React..."
                        className="flex-1 px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItem(currentQual, setCurrentQual, qualifications, setQualifications)}
                        className="px-3.5 py-2 bg-surface-card hover:bg-surface-card-hover border border-border-card text-xs font-bold text-accent-primary rounded-xl"
                      >
                        + Adicionar
                      </button>
                    </div>
                    <div className="space-y-1">
                      {qualifications.map((q, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-surface-card rounded-lg text-xs">
                          <span>{q}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(i, qualifications, setQualifications)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Benefits */}
                  <div>
                    <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                      Benefícios Oferecidos
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={currentBenefit}
                        onChange={(e) => setCurrentBenefit(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItem(currentBenefit, setCurrentBenefit, benefits, setBenefits);
                          }
                        }}
                        placeholder="Ex: Vale Refeição R$ 1.200 / Plano de Saúde Bradesco..."
                        className="flex-1 px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItem(currentBenefit, setCurrentBenefit, benefits, setBenefits)}
                        className="px-3.5 py-2 bg-surface-card hover:bg-surface-card-hover border border-border-card text-xs font-bold text-accent-primary rounded-xl"
                      >
                        + Adicionar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {benefits.map((b, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-surface-card border border-border-card rounded-lg text-xs flex items-center gap-1.5"
                        >
                          {b}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(i, benefits, setBenefits)}
                            className="text-rose-400 hover:text-rose-300 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Screening Questions */}
                  <div>
                    <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                      Perguntas de Triagem para Candidatos
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={currentQuestion}
                        onChange={(e) => setCurrentQuestion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItem(currentQuestion, setCurrentQuestion, screeningQuestions, setScreeningQuestions);
                          }
                        }}
                        placeholder="Ex: Qual sua experiência prática com WebSockets em Node.js?"
                        className="flex-1 px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItem(currentQuestion, setCurrentQuestion, screeningQuestions, setScreeningQuestions)}
                        className="px-3.5 py-2 bg-surface-card hover:bg-surface-card-hover border border-border-card text-xs font-bold text-accent-primary rounded-xl"
                      >
                        + Adicionar
                      </button>
                    </div>
                    <div className="space-y-1">
                      {screeningQuestions.map((q, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-surface-card rounded-lg text-xs">
                          <span>{i + 1}. {q}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(i, screeningQuestions, setScreeningQuestions)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* If Freelance */}
              {type === 'freelance' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                        Tipo de Orçamento
                      </label>
                      <select
                        value={budgetType}
                        onChange={(e) => setBudgetType(e.target.value as BudgetType)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                      >
                        <option value="fixed">Orçamento Fixo</option>
                        <option value="hourly">Valor por Hora</option>
                        <option value="negotiable">A Combinar</option>
                        <option value="undisclosed">Não Informado</option>
                      </select>
                    </div>

                    {budgetType !== 'negotiable' && budgetType !== 'undisclosed' && (
                      <div>
                        <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                          Valor Proposto (R$)
                        </label>
                        <input
                          type="number"
                          value={budget}
                          onChange={(e) => setBudget(e.target.value)}
                          placeholder="Ex: 3500"
                          className="w-full px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                      Prazo Estimado de Entrega
                    </label>
                    <input
                      type="text"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="Ex: 15 dias, 1 mês"
                      className="w-full px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                    />
                  </div>

                  {/* Deliverables */}
                  <div>
                    <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                      Entregáveis Esperados
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={currentDeliverable}
                        onChange={(e) => setCurrentDeliverable(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItem(currentDeliverable, setCurrentDeliverable, deliverables, setDeliverables);
                          }
                        }}
                        placeholder="Ex: Arquivo Figma completo, Design System e componentes..."
                        className="flex-1 px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItem(currentDeliverable, setCurrentDeliverable, deliverables, setDeliverables)}
                        className="px-3.5 py-2 bg-surface-card hover:bg-surface-card-hover border border-border-card text-xs font-bold text-accent-primary rounded-xl"
                      >
                        + Adicionar
                      </button>
                    </div>
                    <div className="space-y-1">
                      {deliverables.map((d, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-surface-card rounded-lg text-xs">
                          <span>{d}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(i, deliverables, setDeliverables)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Skills tags */}
                  <div>
                    <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                      Habilidades Desejadas
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={currentSkill}
                        onChange={(e) => setCurrentSkill(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItem(currentSkill, setCurrentSkill, skills, setSkills);
                          }
                        }}
                        placeholder="Ex: Blender, Figma, Next.js..."
                        className="flex-1 px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItem(currentSkill, setCurrentSkill, skills, setSkills)}
                        className="px-3.5 py-2 bg-surface-card hover:bg-surface-card-hover border border-border-card text-xs font-bold text-accent-primary rounded-xl"
                      >
                        + Adicionar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map((s, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-surface-card border border-border-card rounded-lg text-xs flex items-center gap-1.5"
                        >
                          {s}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(i, skills, setSkills)}
                            className="text-rose-400 hover:text-rose-300 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* If Gig */}
              {type === 'gig' && (
                <>
                  <div className="flex items-center justify-between p-4 bg-surface-card border border-border-card rounded-xl">
                    <div>
                      <span className="text-sm font-bold text-txt-primary block">
                        Estrutura de Pacotes (Básico, Padrão, Premium)
                      </span>
                      <span className="text-xs text-txt-tertiary">
                        Ofereça até 3 opções com preços, prazos e entregáveis customizados para seus clientes.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasTiers}
                        onChange={(e) => setHasTiers(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-base peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
                    </label>
                  </div>

                  {/* Standard or Basic Single Package */}
                  <div className="p-4 bg-surface-card border border-border-card rounded-xl space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent-primary">
                      {hasTiers ? 'Pacote 1: Básico' : 'Preço e Entrega Padrão'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                          Preço Inicial (R$) *
                        </label>
                        <input
                          type="number"
                          value={basicPrice}
                          onChange={(e) => setBasicPrice(e.target.value)}
                          placeholder="Ex: 350"
                          className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                          Prazo de Entrega (dias)
                        </label>
                        <input
                          type="number"
                          value={basicDays}
                          onChange={(e) => setBasicDays(e.target.value)}
                          placeholder="Ex: 3"
                          className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                          Revisões Incluídas
                        </label>
                        <input
                          type="number"
                          value={basicRevs}
                          onChange={(e) => setBasicRevs(e.target.value)}
                          placeholder="Ex: 2"
                          className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                        O que está incluído no pacote
                      </label>
                      <input
                        type="text"
                        value={basicDesc}
                        onChange={(e) => setBasicDesc(e.target.value)}
                        placeholder="Ex: 1 proposta de logo, arquivos em PNG/SVG e paleta de cores"
                        className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                      />
                    </div>
                  </div>

                  {/* Standard Package */}
                  {hasTiers && (
                    <div className="p-4 bg-surface-card border border-border-card rounded-xl space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                        Pacote 2: Padrão (Opcional)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-txt-secondary mb-1">Preço (R$)</label>
                          <input
                            type="number"
                            value={standardPrice}
                            onChange={(e) => setStandardPrice(e.target.value)}
                            placeholder="Ex: 700"
                            className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-txt-secondary mb-1">Prazo (dias)</label>
                          <input
                            type="number"
                            value={standardDays}
                            onChange={(e) => setStandardDays(e.target.value)}
                            placeholder="Ex: 5"
                            className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-txt-secondary mb-1">Revisões</label>
                          <input
                            type="number"
                            value={standardRevs}
                            onChange={(e) => setStandardRevs(e.target.value)}
                            placeholder="Ex: 4"
                            className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={standardDesc}
                          onChange={(e) => setStandardDesc(e.target.value)}
                          placeholder="Ex: 3 propostas de logo, manual de marca completo e artes para redes sociais"
                          className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Premium Package */}
                  {hasTiers && (
                    <div className="p-4 bg-surface-card border border-border-card rounded-xl space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Pacote 3: Premium (Opcional)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-txt-secondary mb-1">Preço (R$)</label>
                          <input
                            type="number"
                            value={premiumPrice}
                            onChange={(e) => setPremiumPrice(e.target.value)}
                            placeholder="Ex: 1500"
                            className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-txt-secondary mb-1">Prazo (dias)</label>
                          <input
                            type="number"
                            value={premiumDays}
                            onChange={(e) => setPremiumDays(e.target.value)}
                            placeholder="Ex: 7"
                            className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-txt-secondary mb-1">Revisões</label>
                          <input
                            type="number"
                            value={premiumRevs}
                            onChange={(e) => setPremiumRevs(e.target.value)}
                            placeholder="Ex: Ilimitadas"
                            className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={premiumDesc}
                          onChange={(e) => setPremiumDesc(e.target.value)}
                          placeholder="Ex: Identidade visual 360, mockups 3D, animação de logo e suporte prioritário"
                          className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Portfolio items */}
                  <div>
                    <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                      Links de Portfólio / Trabalhos Anteriores
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="url"
                        value={portfolioLink}
                        onChange={(e) => setPortfolioLink(e.target.value)}
                        placeholder="https://behance.net/meu-trabalho ou https://github.com/..."
                        className="flex-1 px-3 py-2 rounded-xl bg-surface-card border border-border-card text-txt-primary text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (portfolioLink.trim()) {
                            setPortfolioUrls([...portfolioUrls, portfolioLink.trim()]);
                            setPortfolioLink('');
                          }
                        }}
                        className="px-3.5 py-2 bg-surface-card hover:bg-surface-card-hover border border-border-card text-xs font-bold text-accent-primary rounded-xl"
                      >
                        + Adicionar
                      </button>
                    </div>
                    <div className="space-y-1">
                      {portfolioUrls.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-surface-card rounded-lg text-xs">
                          <span className="truncate">{p}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(i, portfolioUrls, setPortfolioUrls)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="p-4 bg-surface-base border border-border-card rounded-xl">
                <span className="text-[11px] font-bold text-txt-tertiary uppercase tracking-wider block mb-2">
                  Prévia do Card de Exibição
                </span>
                <div className="p-5 bg-surface-card border border-border-card rounded-xl max-w-md">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-accent-primary">{companyName || 'Empresa'}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-base border border-border-card text-txt-tertiary">
                      {workModality === 'remote' ? 'Remoto' : 'Presencial/Híbrido'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-txt-primary mb-1">{title || 'Título da Oportunidade'}</h3>
                  <p className="text-xs text-txt-secondary line-clamp-2 mb-3">
                    {description || 'Descrição detalhada aparecerá aqui...'}
                  </p>
                  <div className="text-xs font-bold text-txt-primary">
                    {type === 'job' && salaryMin ? `A partir de R$ ${salaryMin}` : ''}
                    {type === 'freelance' && budget ? `Orçamento: R$ ${budget}` : ''}
                    {type === 'gig' && basicPrice ? `A partir de R$ ${basicPrice}` : ''}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-border-card bg-surface-header flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-txt-tertiary hover:text-txt-primary transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit('draft')}
              className="px-4 py-2 rounded-xl border border-border-card bg-surface-card hover:bg-surface-card-hover text-xs font-semibold text-txt-secondary transition-colors"
            >
              Salvar Rascunho
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit('published')}
              className="px-6 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-accent-primary/20"
            >
              {isSubmitting ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Publicar Oportunidade'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
