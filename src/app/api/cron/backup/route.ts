import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { uploadBackup, listBackups, deleteFiles } from '@/lib/supabase-storage';

/**
 * Cron job: Daily database backup to Supabase Storage.
 * Runs daily at 03:00 UTC via Vercel Cron.
 *
 * - Exports all tables via Prisma
 * - Strips base64 image data to keep backups small
 * - Uploads JSON to the 'backups' bucket
 * - Cleans up backups older than 14 days
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Export all tables
    const [
      users,
      organizations,
      appointments,
      visits,
      dwellingUnits,
      serviceProducts,
      workOrders,
      workOrderUnits,
      filterSubscriptions,
      cleaningHistories,
      callRecords,
      chatMessages,
      notifications,
      availability,
      pushSubscriptions,
      territories,
      settings,
      smsTemplates,
      techVisits,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.organization.findMany(),
      prisma.appointment.findMany(),
      prisma.visit.findMany(),
      prisma.dwellingUnit.findMany(),
      prisma.serviceProduct.findMany(),
      prisma.workOrder.findMany(),
      prisma.workOrderUnit.findMany(),
      prisma.filterSubscription.findMany(),
      prisma.cleaningHistory.findMany(),
      prisma.callRecord.findMany(),
      prisma.chatMessage.findMany(),
      prisma.notification.findMany(),
      prisma.availability.findMany(),
      prisma.pushSubscription.findMany(),
      prisma.territory.findMany(),
      prisma.setting.findMany(),
      prisma.smsTemplate.findMany(),
      prisma.techVisit.findMany(),
    ]);

    // Strip base64 data from profile images and photo URLs to keep backups small
    const stripBase64 = (val: string | null): string | null => {
      if (!val) return null;
      if (val.startsWith('data:')) return '[base64-stripped]';
      return val;
    };

    const cleanedUsers = users.map((u) => ({
      ...u,
      profileImageUrl: stripBase64(u.profileImageUrl),
      passwordHash: '[redacted]',
    }));

    const cleanedWorkOrderUnits = workOrderUnits.map((wu) => ({
      ...wu,
      photoBeforeUrl: stripBase64(wu.photoBeforeUrl),
      photoAfterUrl: stripBase64(wu.photoAfterUrl),
    }));

    const backup = {
      exportedAt: new Date().toISOString(),
      tables: {
        users: cleanedUsers,
        organizations,
        appointments,
        visits,
        dwellingUnits,
        serviceProducts,
        workOrders,
        workOrderUnits: cleanedWorkOrderUnits,
        filterSubscriptions,
        cleaningHistories,
        callRecords,
        chatMessages,
        notifications,
        availability,
        pushSubscriptions,
        territories,
        settings,
        smsTemplates,
        techVisits,
      },
      counts: {
        users: users.length,
        organizations: organizations.length,
        appointments: appointments.length,
        visits: visits.length,
        dwellingUnits: dwellingUnits.length,
        serviceProducts: serviceProducts.length,
        workOrders: workOrders.length,
        workOrderUnits: workOrderUnits.length,
        filterSubscriptions: filterSubscriptions.length,
        cleaningHistories: cleaningHistories.length,
        callRecords: callRecords.length,
        chatMessages: chatMessages.length,
        notifications: notifications.length,
        availability: availability.length,
        pushSubscriptions: pushSubscriptions.length,
        territories: territories.length,
        settings: settings.length,
        smsTemplates: smsTemplates.length,
        techVisits: techVisits.length,
      },
    };

    // Upload backup
    const date = new Date().toISOString().split('T')[0];
    const fileName = `backup-${date}.json`;
    await uploadBackup(fileName, JSON.stringify(backup));

    // Clean up backups older than 14 days
    const allBackups = await listBackups();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    const oldBackups = allBackups.filter(
      (b) => b.created_at && new Date(b.created_at) < cutoff
    );

    if (oldBackups.length > 0) {
      await deleteFiles(
        'backups',
        oldBackups.map((b) => b.name)
      );
    }

    return NextResponse.json({
      ok: true,
      fileName,
      totalRecords: Object.values(backup.counts).reduce((a, b) => a + b, 0),
      cleanedUp: oldBackups.length,
    });
  } catch (error) {
    console.error('Cron backup error:', error);
    return NextResponse.json({ error: 'Backup feilet' }, { status: 500 });
  }
}
