import { prisma } from '@/lib/prisma';
import MessageHandledToggle from './MessageHandledToggle';

export default async function AdminMessagesPage() {
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Messages de contact</h1>

      {messages.length === 0 ? (
        <p className="text-gray-500">Aucun message reçu pour le moment.</p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`bg-white border rounded-xl p-5 ${m.handled ? 'border-gray-100' : 'border-brand'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800">{m.subject}</p>
                    {m.requestType && (
                      <span className="text-[10px] bg-brand-light text-brand-dark px-2 py-0.5 rounded-full font-medium">
                        {m.requestType}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {m.name} — <a href={`mailto:${m.email}`} className="text-brand hover:underline">{m.email}</a>
                  </p>
                </div>
                <MessageHandledToggle messageId={m.id} handled={m.handled} />
              </div>
              <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{m.message}</p>
              <p className="text-xs text-gray-400 mt-3">{new Date(m.createdAt).toLocaleString('fr-FR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
