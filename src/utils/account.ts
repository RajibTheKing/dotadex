/**
 * Account id resolution.
 * OpenDota keys everything off the 32-bit Dota `account_id`, but players usually
 * have a SteamID64 (7656119...) or a profile URL in their clipboard.
 */

const STEAM64_BASE = 76561197960265728n

/** Accepts "12345678", "76561198047011640" or a profile URL. Returns account_id. */
export function parseAccountInput(raw: string): number | null {
  const value = raw.trim()
  if (!value) return null

  // Pull digits out of Steam profile URLs such as steamcommunity.com/profiles/76561198047011640
  const urlMatch = value.match(/\/profiles\/(\d{5,20})/)
  const digits = urlMatch ? urlMatch[1] : value.replace(/[^\d]/g, '')

  if (!digits) return null
  if (!/^\d+$/.test(digits)) return null

  const number = Number(digits)
  if (!Number.isSafeInteger(number)) return null

  // SteamID64 -> account_id
  if (digits.length >= 17) {
    const converted = BigInt(digits) - STEAM64_BASE
    if (converted <= 0n) return null
    return Number(converted)
  }

  // Account ids are 32-bit unsigned integers.
  if (number > 4294967295) return null
  return number
}

/** True when the input looks like a vanity URL we cannot resolve without the Steam API. */
export function looksLikeVanityUrl(raw: string): boolean {
  return /steamcommunity\.com\/id\//i.test(raw.trim())
}

export function steamId64FromAccountId(accountId: number): string {
  return (BigInt(accountId) + STEAM64_BASE).toString()
}
