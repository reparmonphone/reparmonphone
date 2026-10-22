import { Resend } from 'resend';
import { stripBannedRecipients } from '@/lib/bannedClients';

let resendClient: Resend | null = null;

// Tous les e-mails du site passent par ce client : ceux adressés à un client banni (voir /admin/bannis)
// sont silencieusement ignorés — relances de panier, suivi de commande, demandes d'avis, alertes stock,
// réponses de l'admin, etc. Les e-mails vers l'admin (contact@reparmonphone.fr) ne sont pas touchés.
function withBanGuard(client: Resend): Resend {
  const guardedEmails = new Proxy(client.emails, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== 'send' || typeof value !== 'function') {
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return async (payload: Parameters<typeof target.send>[0], ...rest: unknown[]) => {
        const { payload: safePayload, skip } = await stripBannedRecipients(
          payload as unknown as { to?: string | string[]; cc?: string | string[]; bcc?: string | string[] },
        );
        if (skip) return { data: { id: 'skipped-banned' }, error: null };
        return (value as (...a: unknown[]) => unknown).call(target, safePayload, ...rest);
      };
    },
  });
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'emails') return guardedEmails;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = withBanGuard(new Resend(process.env.RESEND_API_KEY));
  return resendClient;
}
