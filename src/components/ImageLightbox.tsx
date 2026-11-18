import React from 'react';
import { Attachment } from '../types';
import { Modal } from './Modal';
import { formatDateTime } from '../utils/formatters';

interface ImageLightboxProps {
  attachment: Attachment | null;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ attachment, onClose }) => {
  return (
    <Modal
      open={Boolean(attachment)}
      onClose={onClose}
      title={attachment?.name || 'Attachment Preview'}
      subtitle={attachment ? `Uploaded ${formatDateTime(attachment.uploadedAt)}` : undefined}
      size="xl"
    >
      {attachment && (
        <div className="flex flex-col items-center">
          <img
            src={attachment.dataUrl}
            alt={attachment.name}
            referrerPolicy="no-referrer"
            className="max-h-[70vh] w-auto rounded-lg border border-slate-200 dark:border-slate-800 object-contain"
          />
        </div>
      )}
    </Modal>
  );
};
