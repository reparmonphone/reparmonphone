import { prisma } from '@/lib/prisma';
import MaintenanceToggle from './MaintenanceToggle';

export default async function AdminMaintenancePage() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: 'maintenance_mode' } });
  const enabled = setting?.value === 'true';

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-1">Mode maintenance</h1>
      <p className="text-gray-500 mb-6">
        Quand il est activé, les visiteurs voient une page d&apos;attente avec une illustration à la place du
        site. Toi (connecté en admin) continues de voir le site normalement, et tout l&apos;espace{' '}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/admin</code> reste accessible pour travailler
        pendant la maintenance.
      </p>

      <MaintenanceToggle initialEnabled={enabled} />
    </div>
  );
}
