'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import type { AppointmentStatus } from '@prisma/client';

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
  await requireAdminUser();
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });
  revalidatePath('/admin/rdv');
}
