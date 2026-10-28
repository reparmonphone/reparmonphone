'use server';

import { redirect } from 'next/navigation';
import { addUnsubscribed, verifyUnsubToken } from '@/lib/marketing';

// Désinscription des e-mails commerciaux. Le lien de l'e-mail est signé (token) : impossible de désinscrire
// quelqu'un d'autre. Il faut CLIQUER sur le bouton de confirmation (un simple scan du lien par un antivirus
// ou une messagerie ne désinscrit personne).
export async function confirmUnsubscribe(formData: FormData) {
  const email = String(formData.get('e') ?? '').trim();
  const token = String(formData.get('t') ?? '');
  if (!email || !verifyUnsubToken(email, token)) redirect('/desinscription?erreur=1');
  await addUnsubscribed(email);
  redirect('/desinscription?fait=1');
}
