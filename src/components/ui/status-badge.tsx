import Badge from './badge';
import {
  orgStatusConfig,
  appointmentStatusConfig,
  visitStatusConfig,
  dwellingVisitStatusConfig,
  paymentStatusConfig,
  workOrderStatusConfig,
  callResultConfig,
  reminderStatusConfig,
} from '@/lib/utils';

type StatusType =
  | 'organization'
  | 'appointment'
  | 'visit'
  | 'dwelling'
  | 'payment'
  | 'workOrder'
  | 'call'
  | 'reminder';

interface StatusBadgeProps {
  type: StatusType;
  status: string;
  size?: 'sm' | 'md';
}

const configMap: Record<StatusType, Record<string, { label: string; color: string }>> = {
  organization: orgStatusConfig,
  appointment: appointmentStatusConfig,
  visit: visitStatusConfig,
  dwelling: dwellingVisitStatusConfig,
  payment: paymentStatusConfig,
  workOrder: workOrderStatusConfig,
  call: callResultConfig,
  reminder: reminderStatusConfig,
};

export default function StatusBadge({ type, status, size = 'sm' }: StatusBadgeProps) {
  const config = configMap[type]?.[status];
  if (!config) return <Badge size={size}>{status}</Badge>;
  return (
    <Badge color={config.color} size={size}>
      {config.label}
    </Badge>
  );
}
