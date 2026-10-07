export type Role = 'seller' | 'buyer'

export const ROLES: Role[] = ['seller', 'buyer']

export interface AppUser {
  id: string
  username: string
  password: string
  name: string
  company: string
  role: Role
}

export interface Agreement {
  id: string
  title: string
  file: string
  createdAt: string
  /** PDF signature field name that each role can sign */
  signatureFields: Record<Role, string>
}

export interface StoredSignature {
  /** XFDF containing only the signature annotation */
  xfdf: string
  signedAt: string
}

export type AgreementSignatures = Record<Role, StoredSignature | null>
