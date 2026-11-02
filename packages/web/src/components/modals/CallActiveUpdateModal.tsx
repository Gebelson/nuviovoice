import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface CallActiveUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CallActiveUpdateModal({
  isOpen,
  onClose,
  onConfirm,
}: CallActiveUpdateModalProps) {
  const { t } = useTranslation(['desktop', 'common']);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t('desktop:update.callWarning.title', 'Chamada em andamento')}
      description={t(
        'desktop:update.callWarning.description',
        'Você está em uma chamada. Reiniciar o Nuvio encerrará sua conexão.',
      )}
      confirmLabel={t('desktop:update.callWarning.confirm', 'Reiniciar e atualizar')}
      cancelLabel={t('desktop:update.callWarning.cancel', 'Atualizar depois')}
      variant="warning"
    />
  );
}
