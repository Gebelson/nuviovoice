import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import type { SpaceFolder } from '@concord/shared';

export const FOLDER_COLORS = [
  { name: 'default', value: null, hex: 'rgba(255, 255, 255, 0.1)' },
  { name: 'mint', value: '#86efac', hex: '#86efac' },
  { name: 'peach', value: '#fbbf93', hex: '#fbbf93' },
  { name: 'lavender', value: '#c4b5fd', hex: '#c4b5fd' },
  { name: 'sky', value: '#7dd3fc', hex: '#7dd3fc' },
  { name: 'amber', value: '#fcd34d', hex: '#fcd34d' },
  { name: 'rose', value: '#fda4af', hex: '#fda4af' },
  { name: 'coral', value: '#fb7185', hex: '#fb7185' },
  { name: 'emerald', value: '#34d399', hex: '#34d399' },
  { name: 'violet', value: '#a78bfa', hex: '#a78bfa' },
  { name: 'blue', value: '#60a5fa', hex: '#60a5fa' },
] as const;

interface FolderSettingsModalProps {
  isOpen: boolean;
  folder: SpaceFolder;
  onClose: () => void;
  onSave: (folderId: string, name: string | null, color: string | null) => void;
}

export function FolderSettingsModal({
  isOpen,
  folder,
  onClose,
  onSave,
}: FolderSettingsModalProps) {
  const { t } = useTranslation(['spaces', 'common']);
  const [name, setName] = useState(folder.name || '');
  const [selectedColor, setSelectedColor] = useState<string | null>(folder.color);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(folder.id, name.trim() || null, selectedColor);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('spaces:sidebar.folder.settings', 'Configurações da pasta')}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-2">
            {t('spaces:sidebar.folder.nameLabel', 'Nome da pasta')}
          </label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('spaces:sidebar.folder.unnamed', 'Pasta sem nome')}
            maxLength={64}
            className="w-full px-3 py-2 bg-surface-base border border-white/10 rounded-lg text-sm text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-accent-mint/70 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-2">
            {t('spaces:sidebar.folder.colorLabel', 'Cor da pasta')}
          </label>
          <div className="flex flex-wrap gap-2.5 items-center">
            {FOLDER_COLORS.map((c) => {
              const isSelected = selectedColor === c.value;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedColor(c.value)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative ${
                    isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-base scale-105' : ''
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name === 'default' ? t('common:states.default', 'Padrão') : c.name}
                >
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={c.value ? 'text-black/80' : 'text-white'}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-txt-secondary hover:text-txt-primary hover:bg-white/[0.06] transition-colors"
          >
            {t('common:actions.cancel', 'Cancelar')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-mint text-black hover:bg-accent-mint/90 transition-colors font-semibold"
          >
            {t('common:actions.save', 'Salvar')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
