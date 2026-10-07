import agreementsJson from '../data/agreements.json'
import usersJson from '../data/users.json'
import type { Agreement, AppUser, Role } from './types'

export const users = usersJson as AppUser[]
export const agreements = agreementsJson as Agreement[]

export function findAgreement(id: string | undefined): Agreement | undefined {
  return agreements.find((a) => a.id === id)
}

export function findUserByRole(role: Role): AppUser | undefined {
  return users.find((u) => u.role === role)
}
