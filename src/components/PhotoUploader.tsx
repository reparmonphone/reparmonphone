'use client';

import { useState } from 'react';

// Sélecteur de plusieurs photos, uploadées une à une vers `uploadUrl` (même pattern que
// ClaimForm.tsx mais pour plusieurs images) — le composant ne connaît que des URLs déjà en ligne,
// jamais les fichiers eux-mêmes après upload, pour rester simple à intégrer à un formulaire JSON
// ou à une Server Action existante (voir RepairByMailForm.tsx et MailInRepairPhotosForm.tsx).
export default function PhotoUploader({
  value,
  onChange,
  uploadUrl,
  max = 6,
  label = 'Ajouter des photos',
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  uploadUrl: string;
  max?: number;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permet de resélectionner le même fichier plus tard si besoin
    if (files.length === 0) return;

    const remaining = max - value.length;
    if (remaining <= 0) {
      setError(`Maximum ${max} photos.`);
      return;
    }

    setError(null);
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files.slice(0, remaining)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(uploadUrl, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Échec de l'envoi d'une photo.");
          continue;
        }
        newUrls.push(data.url);
      } catch {
        setError("Échec de l'envoi d'une photo. Réessaie.");
      }
    }
    if (newUrls.length > 0) onChange([...value, ...newUrls]);
    setUploading(false);
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((url, i) => (
            <div key={url} className="relative">
              <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Retirer cette photo"
                className="absolute -top-1.5 -right-1.5 bg-white border border-gray-200 rounded-full w-5 h-5 text-xs leading-none text-gray-500 hover:text-red-600 hover:border-red-300 shadow-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {value.length < max && (
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          disabled={uploading}
          className="text-sm"
        />
      )}
      {uploading && <p className="text-xs text-gray-400 mt-1">Envoi en cours...</p>}
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}
