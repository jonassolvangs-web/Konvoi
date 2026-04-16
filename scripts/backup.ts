/**
 * Database backup script for Konvoi
 * Exports all tables to a timestamped JSON file
 * Keeps 14 days of backups
 *
 * Run: npx tsx scripts/backup.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const KEEP_DAYS = 14;

async function backup() {
  console.log(`[${new Date().toISOString()}] Starting backup...`);

  const data: Record<string, any[]> = {};

  // Export all tables
  data.users = await prisma.user.findMany();
  data.organizations = await prisma.organization.findMany();
  data.appointments = await prisma.appointment.findMany();
  data.visits = await prisma.visit.findMany();
  data.dwellingUnits = await prisma.dwellingUnit.findMany();
  data.serviceProducts = await prisma.serviceProduct.findMany();
  data.workOrders = await prisma.workOrder.findMany();
  data.workOrderUnits = await prisma.workOrderUnit.findMany();
  data.filterSubscriptions = await prisma.filterSubscription.findMany();
  data.cleaningHistories = await prisma.cleaningHistory.findMany();
  data.callRecords = await prisma.callRecord.findMany();
  data.chatMessages = await prisma.chatMessage.findMany();
  data.notifications = await prisma.notification.findMany();
  data.availability = await prisma.availability.findMany();
  data.pushSubscriptions = await prisma.pushSubscription.findMany();
  data.territories = await prisma.territory.findMany();
  data.settings = await prisma.setting.findMany();
  data.smsTemplates = await prisma.smsTemplate.findMany();
  data.techVisits = await prisma.techVisit.findMany();

  // Summary
  const totalRecords = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`  Tables: ${Object.keys(data).length}`);
  console.log(`  Total records: ${totalRecords}`);
  for (const [table, rows] of Object.entries(data)) {
    if (rows.length > 0) console.log(`    ${table}: ${rows.length}`);
  }

  // Write to file
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `konvoi_backup_${timestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  const sizeMB = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`  Saved: ${filename} (${sizeMB} MB)`);

  // Clean old backups
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('konvoi_backup_') && f.endsWith('.json'))
    .sort();

  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000);
  let deleted = 0;
  for (const f of files) {
    const fpath = path.join(BACKUP_DIR, f);
    if (fs.statSync(fpath).mtime < cutoff) {
      fs.unlinkSync(fpath);
      deleted++;
    }
  }
  if (deleted > 0) console.log(`  Cleaned ${deleted} old backup(s)`);

  console.log(`[${new Date().toISOString()}] Backup complete!`);
}

backup()
  .catch((e) => {
    console.error('BACKUP FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
