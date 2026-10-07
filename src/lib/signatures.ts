import { useEffect, useState } from 'react'
import { ROLES, type AgreementSignatures, type Role, type StoredSignature } from './types'

// Signatures are saved per role in the browser's localStorage (for demo purposes).
// Signatures made in another tab are reflected immediately via the storage event.
const PREFIX = 'parallel-signature:signature'
const CHANGE_EVENT = 'parallel-signature:change'

const keyOf = (agreementId: string, role: Role) => `${PREFIX}:${agreementId}:${role}`

export function getSignatures(agreementId: string): AgreementSignatures {
  const result = {} as AgreementSignatures
  for (const role of ROLES) {
    const raw = localStorage.getItem(keyOf(agreementId, role))
    result[role] = raw ? (JSON.parse(raw) as StoredSignature) : null
  }
  return result
}

export function saveSignature(agreementId: string, role: Role, xfdf: string) {
  const value: StoredSignature = { xfdf, signedAt: new Date().toISOString() }
  localStorage.setItem(keyOf(agreementId, role), JSON.stringify(value))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function clearSignatures(agreementId: string, roles: Role[] = ROLES) {
  for (const role of roles) localStorage.removeItem(keyOf(agreementId, role))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Subscribes to an agreement's signature status */
export function useSignatures(agreementId: string | undefined): AgreementSignatures | null {
  const [signatures, setSignatures] = useState(() => (agreementId ? getSignatures(agreementId) : null))

  useEffect(() => {
    if (!agreementId) return
    const update = () => setSignatures(getSignatures(agreementId))
    update()
    window.addEventListener('storage', update)
    window.addEventListener(CHANGE_EVENT, update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener(CHANGE_EVENT, update)
    }
  }, [agreementId])

  return signatures
}
