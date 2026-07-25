import { prisma } from '@/lib/prisma';
import PartnerRow from './PartnerRow';
import NewPartnerForm from './NewPartnerForm';
import ReferralLinkRow from './ReferralLinkRow';
import NewReferralLinkForm from './NewReferralLinkForm';

export default async function AdminPartenairesPage() {
  const [partners, referralLinks] = await Promise.all([
    prisma.partner.findMany({ orderBy: { order: 'asc' } }),
    prisma.referralLink.findMany({ orderBy: { order: 'asc' } }),
  ]);

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-1">Partenaires</h1>
        <p className="text-gray-500 mb-6">
          Affichés sur une seule ligne en bas de la page d&apos;accueil, avec leur logo si tu en fournis un.
        </p>

        <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 mb-6">
          {partners.length === 0 ? (
            <p className="p-5 text-gray-500 text-sm">Aucun partenaire pour le moment.</p>
          ) : (
            partners.map((p) => (
              <PartnerRow key={p.id} partner={{ id: p.id, name: p.name, logoUrl: p.logoUrl, linkUrl: p.linkUrl }} />
            ))
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h2 className="font-semibold mb-3">Ajouter un partenaire</h2>
          <NewPartnerForm />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-1">Liens de référencement</h2>
        <p className="text-gray-500 mb-6">
          Liens texte affichés sous les partenaires (annuaires, backlinks SEO...).
        </p>

        <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 mb-6">
          {referralLinks.length === 0 ? (
            <p className="p-5 text-gray-500 text-sm">Aucun lien pour le moment.</p>
          ) : (
            referralLinks.map((l) => (
              <ReferralLinkRow key={l.id} link={{ id: l.id, label: l.label, url: l.url }} />
            ))
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h2 className="font-semibold mb-3">Ajouter un lien</h2>
          <NewReferralLinkForm />
        </div>
      </div>
    </div>
  );
}
