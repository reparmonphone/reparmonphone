'use client';

import { useState, useTransition } from 'react';
import PhotoUploader from '@/components/PhotoUploader';
import { updateMailInRepairPhotos } from '../actions';

// Photos de l'appareil une fois réparé, avant renvoi au client — affichées ensuite sur ses pages de
// suivi (voir MailInRepairStepper.tsx et suivi/[id]/page.tsx, compte/reparation-a-distance/[id]/page.tsx).
export default function MailInRepairPhotosForm({
  repairId,
  initialPhotos,
}: {
  repairId: string;
  initialPhotos: string[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function handleSave() {
    startTransition(async () => {
      await updateMailInRepairPhotos(repairId, photos);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h2 className="font-semibold text-gray-800 mb-1">Photos de l'appareil réparé</h2>
      <p className="text-xs text-gray-400 mb-3">
        Ajoutées ici, elles sont visibles par le client sur sa page de suivi — utile pour montrer
        l'appareil réparé avant de le renvoyer.
      </p>
      <PhotoUploader
        value={photos}
        onChange={setPhotos}
        uploadUrl="/api/reparation-a-distance/upload-photo"
        label=""
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="mt-3 bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition disabled:opacity-60"
      >
        {isPending ? 'Enregistrement...' : 'Enregistrer les photos'}
      </button>
      {sent && <span className="ml-3 text-green-600 text-sm font-medium">✓ Enregistré</span>}
    </div>
  );
}
