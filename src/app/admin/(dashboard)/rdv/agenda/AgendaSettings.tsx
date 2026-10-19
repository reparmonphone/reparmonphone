'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveCalendarSettings, syncUpcomingAppointments, testCalendar } from './actions';

export default function AgendaSettings({
  initialCalendarId,
  initialEnabled,
  credentialsOk,
  serviceAccountEmail,
  notInCalendar,
}: {
  initialCalendarId: string;
  initialEnabled: boolean;
  credentialsOk: boolean;
  serviceAccountEmail: string;
  notInCalendar: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [calendarId, setCalendarId] = useState(initialCalendarId);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState<string | null>(null);

  function run(fn: () => Promise<string>) {
    setMessage(null);
    startTransition(async () => {
      try {
        setMessage(await fn());
      } catch {
        setMessage('⚠️ Une erreur est survenue, réessaie.');
      }
      router.refresh();
    });
  }

  const card = 'bg-white border border-gray-100 rounded-xl p-5 mb-6';
  const btn = 'px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50';

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-gray-600 mb-6">
        Quand un client demande un rendez-vous, il s&apos;ajoute tout seul dans ton Google Agenda (🕓 jaune = à confirmer, ✅ vert =
        confirmé). Si tu annules le RDV dans l&apos;admin, il disparaît de l&apos;agenda.
      </p>

      {message && <p className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">{message}</p>}

      <div className={card}>
        <h2 className="font-semibold mb-3">Ton agenda</h2>

        <p className={`text-sm mb-4 ${credentialsOk ? 'text-green-700' : 'text-orange-700'}`}>
          {credentialsOk
            ? '✅ Les identifiants Google (compte de service) sont bien installés sur le site.'
            : '⚠️ Les identifiants Google ne sont pas encore installés sur le site : suis les étapes 1 à 4 ci-dessous.'}
        </p>

        <label className="block text-xs text-gray-500 mb-1">Identifiant de l&apos;agenda (ton adresse Gmail pour ton agenda principal)</label>
        <input
          value={calendarId}
          onChange={(e) => setCalendarId(e.target.value)}
          placeholder="vipsttropez@gmail.com"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
        />

        <label className="flex items-center gap-3 cursor-pointer mb-5">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-brand" />
          <span className="text-sm font-medium text-gray-800">Ajouter automatiquement les rendez-vous à mon Google Agenda</span>
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await saveCalendarSettings(calendarId, enabled);
                return r.error ? `⚠️ ${r.error}` : '✅ Réglages enregistrés.';
              })
            }
            className={`${btn} bg-brand text-white hover:bg-brand-dark`}
          >
            Enregistrer
          </button>
          <button
            type="button"
            disabled={pending || !calendarId.trim()}
            onClick={() =>
              run(async () => {
                const r = await testCalendar(calendarId);
                return r.error ? `⚠️ ${r.error}` : '✅ Connexion réussie : un événement de test a été créé puis supprimé de ton agenda.';
              })
            }
            className={`${btn} bg-gray-700 text-white hover:bg-gray-800`}
          >
            {pending ? '…' : 'Tester la connexion'}
          </button>
          <button
            type="button"
            disabled={pending || !enabled || notInCalendar === 0}
            onClick={() =>
              run(async () => {
                const r = await syncUpcomingAppointments();
                return r.error ? `⚠️ ${r.error}` : `✅ ${r.sent} rendez-vous ajouté(s) à l’agenda.`;
              })
            }
            className={`${btn} bg-amber-500 text-white hover:bg-amber-600`}
            title="Envoie dans l'agenda les RDV à venir qui n'y sont pas encore"
          >
            Ajouter les RDV déjà reçus ({notInCalendar})
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">Pense à cliquer sur « Enregistrer » avant de tester ou d&apos;ajouter les RDV déjà reçus.</p>
      </div>

      <div className={card}>
        <h2 className="font-semibold mb-3">Mise en place (à faire une seule fois)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Google n&apos;autorise pas le site à utiliser ton mot de passe : on crée donc un « robot » (compte de service) à qui tu donnes accès à ton agenda.
        </p>
        <ol className="text-sm text-gray-700 space-y-3 list-decimal pl-5">
          <li>
            Va sur <strong>console.cloud.google.com</strong> (connecte-toi avec ton compte Google), crée un projet « ReparMonPhone », puis
            cherche <strong>« Google Calendar API »</strong> et clique sur <strong>Activer</strong>.
          </li>
          <li>
            Menu <strong>IAM et administration → Comptes de service → Créer un compte de service</strong> (nom : « agenda-rdv », rien d&apos;autre à
            remplir). Ouvre-le, onglet <strong>Clés → Ajouter une clé → JSON</strong> : un fichier se télécharge.
          </li>
          <li>
            Ouvre <strong>agenda.google.com</strong> → à gauche, ton agenda → <strong>Paramètres et partage → Partager avec des personnes</strong> →
            ajoute l&apos;e-mail du robot
            {serviceAccountEmail ? <> (<code className="bg-gray-100 px-1 rounded text-xs">{serviceAccountEmail}</code>)</> : ' (le « client_email » du fichier JSON)'}
            avec l&apos;autorisation <strong>« Apporter des modifications aux événements »</strong>.
          </li>
          <li>
            Dans <strong>Vercel → ton projet → Settings → Environment Variables</strong>, ajoute <code className="bg-gray-100 px-1 rounded text-xs">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> (la valeur
            « client_email » du fichier JSON) et <code className="bg-gray-100 px-1 rounded text-xs">GOOGLE_PRIVATE_KEY</code> (la valeur « private_key », tout le texte entre guillemets, avec les « \n »). Puis
            <strong> Redeploy</strong>. Pour tester en local, mets les deux mêmes lignes dans ton fichier <code className="bg-gray-100 px-1 rounded text-xs">.env</code>.
          </li>
          <li>Reviens ici, renseigne ton adresse Gmail, coche la case, <strong>Enregistrer</strong>, puis <strong>Tester la connexion</strong>.</li>
        </ol>
        <p className="text-xs text-gray-500 mt-4">
          En attendant, chaque e-mail de nouvelle demande de RDV contient aussi un lien « 📆 Ajouter à Google Agenda » (un clic, sans rien configurer).
        </p>
      </div>
    </div>
  );
}
