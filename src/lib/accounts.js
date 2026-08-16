import accountsRaw from '../data/accounts.json'

const accounts = accountsRaw

export function getInstitutionName(id) {
  return accounts[id] || accounts[String(id)] || null
}

export function institutionLabel(id) {
  const name = getInstitutionName(id)
  return name || `#${id}`
}
