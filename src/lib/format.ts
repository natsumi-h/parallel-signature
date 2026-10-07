import type { AgreementSignatures, Role } from './types'

/** e.g. Oct 4, 2026 */
export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export const roleLabel: Record<Role, string> = {
  seller: 'Seller',
  buyer: 'Buyer',
}

export type AgreementStatus = 'awaiting_signature' | 'partially_signed' | 'signed'

export function agreementStatus(signatures: AgreementSignatures): AgreementStatus {
  const count = Object.values(signatures).filter(Boolean).length
  if (count === 0) return 'awaiting_signature'
  return count === Object.keys(signatures).length ? 'signed' : 'partially_signed'
}

export const statusLabel: Record<AgreementStatus, string> = {
  awaiting_signature: 'Awaiting signatures',
  partially_signed: 'Partially signed',
  signed: 'Completed',
}

export const statusColor: Record<AgreementStatus, string> = {
  awaiting_signature: 'orange',
  partially_signed: 'blue',
  signed: 'green',
}
