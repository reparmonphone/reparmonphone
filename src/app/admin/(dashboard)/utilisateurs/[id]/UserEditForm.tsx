'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateAdminUser, deleteAdminUser } from '../actions';

type UserData = {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressCity: string;
  addressZip: string;
  isAdmin: boolean;
};

export default function UserEditForm({ userId, user }: { userId: string; user: UserData }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone);
  const [addressLine1, setAddressLine1] = useState(user.addressLine1);
  const [addressCity, setAddressCity] = useState(user.addressCity);
  const [addressZip, setAddressZip] = useState(user.addressZip);
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);

  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAdminUser(userId, {
        firstName, lastName, phone, addressLine1, addressCity, addressZip, isAdmin,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function handleDelete() {
    if (!confirm('Supprimer définitivement ce compte utilisateur ? Cette action est irréversible.')) return;
    setDeleting(true);
    startTransition(async () => {
      const result = await deleteAdminUser(userId);
      if (result.error) {
        setError(result.error);
        setDeleting(false);
        return;
      }
      router.push('/admin/utilisateurs');
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Prénom</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Téléphone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Adresse</label>
          <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Numéro et nom de rue" className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-2" />
          <div className="grid grid-cols-2 gap-2">
            <input value={addressZip} onChange={(e) => setAddressZip(e.target.value)} placeholder="Code postal" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
            <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="Ville" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm border-t border-gray-100 pt-4">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
          Accès administrateur (peut se connecter à <code>/admin</code>)
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60">
            {pending && !deleting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {saved && <span className="text-green-600 text-sm">✅ Enregistré</span>}
        </div>
      </form>

      <div className="bg-white border border-red-100 rounded-xl p-6">
        <h2 className="font-semibold text-red-700 mb-1">Zone dangereuse</h2>
        <p className="text-sm text-gray-500 mb-3">
          Supprime définitivement ce compte utilisateur. Ses commandes et RDV passés resteront en base mais ne
          seront plus rattachés à un compte.
        </p>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-60"
        >
          {deleting ? 'Suppression...' : 'Supprimer ce compte'}
        </button>
      </div>
    </div>
  );
}
