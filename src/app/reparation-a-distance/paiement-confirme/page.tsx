export const metadata = {
  title: 'Paiement confirmé — Réparation par correspondance | ReparMonPhone',
  robots: { index: false },
};

export default function PaiementConfirmePage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h1 className="text-2xl font-bold mb-3">Paiement bien reçu, merci !</h1>
      <p className="text-gray-600">
        Votre appareil réparé part en Chronopost 24h. Vous recevrez un email avec le numéro de suivi
        dès l'expédition.
      </p>
    </div>
  );
}
