// ─── Pipeline stage definitions ─────────────────────

export interface PipelineStage {
  key: string;
  label: string;
  short: string;
  emoji: string;
  color: string;
  colorLight: string;
  colorMid: string;
  text: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'ikke_ringt', label: 'Ikke ringt', short: 'Ikke ringt', emoji: '\u{1F4CD}', color: '#6B7280', colorLight: '#F3F4F6', colorMid: '#E5E7EB', text: '#374151' },
  { key: 'ringt_folg_opp', label: 'Ringt \u2014 f\u00f8lg opp', short: 'F\u00f8lg opp', emoji: '\u{1F4DE}', color: '#EAB308', colorLight: '#FEF9C3', colorMid: '#FDE68A', text: '#854D0E' },
  { key: 'venter', label: 'Venter p\u00e5 videresending', short: 'Venter', emoji: '\u23F3', color: '#F97316', colorLight: '#FFEDD5', colorMid: '#FDBA74', text: '#9A3412' },
  { key: 'videresendt', label: 'Mail videresendt', short: 'Videresendt', emoji: '\u2705', color: '#3B82F6', colorLight: '#DBEAFE', colorMid: '#93C5FD', text: '#1E40AF' },
  { key: 'klar', label: 'Klar', short: 'Klar', emoji: '\u{1F3AF}', color: '#111827', colorLight: '#F3F4F6', colorMid: '#D1D5DB', text: '#111827' },
];

export function getStage(key: string): PipelineStage | undefined {
  return PIPELINE_STAGES.find((s) => s.key === key);
}

/**
 * Compute the pipeline stage for an organization based on its latest call result
 * and whether it has a feltselger assigned.
 */
export function computePipelineStage(
  latestCallResult: string | null,
  hasFeltselger: boolean,
): string {
  if (!latestCallResult) return 'ikke_ringt';

  if (latestCallResult === 'mote_booket' || hasFeltselger) return 'klar';
  if (latestCallResult === 'videresendt') return 'videresendt';
  if (latestCallResult === 'mail_sendt') return 'venter';

  // ikke_svar, ring_tilbake, nei -> follow up
  return 'ringt_folg_opp';
}
