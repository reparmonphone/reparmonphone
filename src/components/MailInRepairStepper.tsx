import type { MailInRepairStatus } from '@prisma/client';

const STEPS: { key: MailInRepairStatus; label: string; icon: string }[] = [
  { key: 'REQUESTED', label: 'Demande reçue', icon: '📝' },
  { key: 'AWAITING_DEVICE', label: 'Envoi de l’appareil', icon: '📦' },
  { key: 'DEVICE_RECEIVED', label: 'Diagnostic', icon: '🔍' },
  { key: 'AWAITING_PAYMENT', label: 'Paiement', icon: '💳' },
  { key: 'PAID', label: 'Réparation', icon: '🔧' },
  { key: 'SHIPPED_BACK', label: 'Renvoyée', icon: '✅' },
];

// Suivi visuel des étapes d'une réparation par correspondance, utilisé à la fois sur la page
// publique /reparation-a-distance/suivi/[id] et dans l'espace client /compte/reparation-a-distance.
// N'affiche rien pour une demande annulée — à gérer séparément par l'appelant (bandeau dédié).
export default function MailInRepairStepper({ status }: { status: MailInRepairStatus }) {
  if (status === 'CANCELLED') return null;

  const currentIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex items-start min-w-[460px]">
        {STEPS.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center text-center">
              <div className="flex items-center w-full">
                <div
                  className={`flex-1 h-0.5 ${i === 0 ? 'invisible' : state === 'upcoming' ? 'bg-gray-200' : 'bg-brand'}`}
                />
                <div
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm border-2 ${
                    state === 'upcoming'
                      ? 'border-gray-200 bg-white text-gray-300'
                      : state === 'current'
                      ? 'border-brand bg-brand text-white ring-4 ring-brand-light'
                      : 'border-brand bg-brand text-white'
                  }`}
                >
                  {step.icon}
                </div>
                <div
                  className={`flex-1 h-0.5 ${i === STEPS.length - 1 ? 'invisible' : i < currentIndex ? 'bg-brand' : 'bg-gray-200'}`}
                />
              </div>
              <p className={`mt-2 text-[11px] leading-tight ${state === 'upcoming' ? 'text-gray-400' : 'text-gray-700 font-medium'}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
