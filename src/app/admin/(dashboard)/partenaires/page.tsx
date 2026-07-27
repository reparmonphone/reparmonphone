import { prisma } from '@/lib/prisma';
import PartnerRow from './PartnerRow';
import NewPartnerForm from './NewPartnerForm';
import ReferralLinkRow from './ReferralLinkRow';
import NewReferralLinkForm from './NewReferralLinkForm';
import InstagramFollowersForm from './InstagramFollowersForm';
import SocialFollowersCountForm from './SocialFollowersCountForm';

export default async function AdminPartenairesPage() {
  const [partners, referralLinks, instagramSetting, countSettings] = await Promise.all([
    prisma.partner.findMany({ orderBy: { order: 'asc' } }),
    prisma.referralLink.findMany({ orderBy: { order: 'asc' } }),
    prisma.siteSetting.findUnique({ where: { key: 'instagram_followers' } }),
    prisma.siteSetting.findMany({ where: { key: { in: ['facebook_followers_count', 'instagram_followers_count'] } } }),
  ]);
  const getCount = (key: string) => countSettings.find((s) => s.key === key)?.value ?? '';

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-1">Réseaux sociaux</h1>
        <p className="text-gray-500 mb-6">
          Instagram ne propose pas de widget public avec le nombre d&apos;abonnés en direct (contrairement à
          Facebook) — renseigne-le ici manuellement, il s&apos;affichera sur la page d&apos;accueil à côté du
          widget Facebook.
        </p>
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <InstagramFollowersForm initialValue={instagramSetting?.value ?? ''} />
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5 mt-4 space-y-3">
          <h2 className="font-semibold mb-1">Compteurs à volets (page d&apos;accueil)</h2>
          <p className="text-xs text-gray-400 -mt-2 mb-2">
            Nombres exacts (pas d&apos;abréviation) pour l&apos;affichage façon compteur mécanique en haut de la
            page d&apos;accueil.
          </p>
          <SocialFollowersCountForm platform="facebook" label="Abonnés Facebook" initialValue={getCount('facebook_followers_count')} />
          <SocialFollowersCountForm platform="instagram" label="Abonnés Instagram" initialValue={getCount('instagram_followers_count')} />
        </div>
      </div>

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
