import AdminSidebar from '@/components/admin/AdminSidebar';

export const metadata = { title: 'Administration | ReparMonPhone' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
