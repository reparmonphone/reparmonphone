'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type UserData = {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export default function ProfileForm({ user }: { user: UserData }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setInfoError(null);
    const supabase = createSupabaseBrowserClient();

    try {
      const {
        data: { user: current },
      } = await supabase.auth.getUser();
      if (!current) throw new Error('Non connecté');

      const ext = file.name.split('.').pop();
      const path = `${current.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: url } });
      if (updateError) throw updateError;

      setAvatarUrl(url);
      router.refresh();
    } catch (err) {
      setInfoError(
        err instanceof Error && err.message.includes('Bucket not found')
          ? "Le bucket de stockage 'avatars' n'existe pas encore côté Supabase (voir le README)."
          : "Erreur lors de l'envoi de la photo."
      );
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingInfo(true);
    setInfoError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim() },
    });

    setSavingInfo(false);
    if (error) {
      setInfoError('Erreur lors de la mise à jour.');
      return;
    }
    setInfoSaved(true);
    router.refresh();
    setTimeout(() => setInfoSaved(false), 2000);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSavingPassword(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordError('Erreur lors du changement de mot de passe.');
      return;
    }
    setPasswordSaved(true);
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSaved(false), 2000);
  }

  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || user.email[0]?.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Photo de profil */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 flex items-center gap-5">
        <div className="relative w-20 h-20 shrink-0 rounded-full overflow-hidden bg-brand-light flex items-center justify-center text-2xl font-bold text-brand-dark">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="Photo de profil" fill className="object-cover" />
          ) : (
            initials
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="text-sm font-semibold text-brand hover:underline disabled:opacity-50"
          >
            {avatarUploading ? 'Envoi en cours...' : 'Changer la photo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <p className="text-xs text-gray-400 mt-1">JPG ou PNG, quelques Mo max.</p>
        </div>
      </div>

      {/* Informations personnelles */}
      <form onSubmit={handleInfoSubmit} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Informations personnelles</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Prénom</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input value={user.email} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500" />
          <p className="text-xs text-gray-400 mt-1">L&apos;email ne peut pas être modifié ici.</p>
        </div>

        {infoError && <p className="text-red-600 text-sm">{infoError}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={savingInfo}
            className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            {savingInfo ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {infoSaved && <span className="text-green-600 text-sm">✅ Enregistré</span>}
        </div>
      </form>

      {/* Mot de passe */}
      <form onSubmit={handlePasswordSubmit} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Changer le mot de passe</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Nouveau mot de passe</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirmer le nouveau mot de passe</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>

        {passwordError && <p className="text-red-600 text-sm">{passwordError}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={savingPassword}
            className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            {savingPassword ? 'Enregistrement...' : 'Changer le mot de passe'}
          </button>
          {passwordSaved && <span className="text-green-600 text-sm">✅ Mot de passe changé</span>}
        </div>
      </form>
    </div>
  );
}
