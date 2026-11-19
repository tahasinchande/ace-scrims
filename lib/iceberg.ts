export type IcebergConfig = {
  realConfirmed: number
  maxTeams: number
  icebergEnabled: boolean
  icebergShowAllFilled?: boolean
  icebergAmount: number
  icebergThreshold: number
  icebergStartRealCount: number
}

export function isIcebergActiveForScrim(cfg: IcebergConfig): boolean {
  const max = Math.max(1, cfg.maxTeams || 12)
  const real = Math.max(0, cfg.realConfirmed || 0)
  if (real >= max) return false
  return Boolean(cfg.icebergShowAllFilled || (cfg.icebergEnabled && cfg.icebergAmount > 0))
}

/**
 * Computes the public displayed slot fill count for a scrim.
 * - Safety override: if realConfirmed >= maxTeams, always returns realConfirmed.
 * - Marketing full override: if icebergShowAllFilled is enabled and realConfirmed < maxTeams,
 *   returns maxTeams so public UI displays all slots filled (e.g. 12/12).
 * - Otherwise if Iceberg is enabled, displays `icebergAmount + (deltaReal % icebergThreshold)`,
 *   clamped below `maxTeams` so an open lobby never prematurely appears full.
 */
export function computeIcebergDisplayCount(cfg: IcebergConfig): number {
  const max = Math.max(1, cfg.maxTeams || 12)
  const real = Math.max(0, cfg.realConfirmed || 0)

  if (real >= max) {
    return real
  }

  if (cfg.icebergShowAllFilled) {
    return max
  }

  if (!cfg.icebergEnabled) {
    return real
  }

  const baseAmount = Math.max(0, Math.min(max - 1, Math.floor(cfg.icebergAmount || 0)))
  if (baseAmount <= 0) {
    return real
  }

  const threshold = Math.max(1, Math.floor(cfg.icebergThreshold || 1))
  const startReal = Math.max(0, Math.floor(cfg.icebergStartRealCount || 0))
  const deltaReal = Math.max(0, real - startReal)
  const cycleOffset = threshold > 0 ? deltaReal % threshold : 0

  return Math.min(max - 1, baseAmount + cycleOffset)
}

export function getIcebergCycleProgress(cfg: IcebergConfig): {
  deltaReal: number
  cycleOffset: number
  remainingUntilReset: number
  displayedCount: number
  isSafetyOverridden: boolean
  isShowAllFilled: boolean
} {
  const max = Math.max(1, cfg.maxTeams || 12)
  const real = Math.max(0, cfg.realConfirmed || 0)
  const threshold = Math.max(1, Math.floor(cfg.icebergThreshold || 1))
  const startReal = Math.max(0, Math.floor(cfg.icebergStartRealCount || 0))
  const deltaReal = Math.max(0, real - startReal)
  const cycleOffset = deltaReal % threshold

  return {
    deltaReal,
    cycleOffset,
    remainingUntilReset: threshold - cycleOffset,
    displayedCount: computeIcebergDisplayCount(cfg),
    isSafetyOverridden: real >= max,
    isShowAllFilled: Boolean(cfg.icebergShowAllFilled) && real < max,
  }
}

export type PublicScrim<T> = Omit<
  T,
  | "publicConfirmedTeams"
  | "icebergEnabled"
  | "icebergShowAllFilled"
  | "icebergAmount"
  | "icebergThreshold"
  | "icebergStartRealCount"
> & {
  confirmedTeams: number
  roomId: null
  roomPassword: null
}

/**
 * Strips internal Iceberg settings & room credentials before sending scrim objects
 * to public Server/Client Components or public API responses, replacing `confirmedTeams`
 * with the Iceberg-adjusted public count when active.
 */
export function sanitizePublicScrim<
  T extends {
    confirmedTeams: number
    publicConfirmedTeams?: number
    roomId?: string | null
    roomPassword?: string | null
    icebergEnabled?: boolean
    icebergShowAllFilled?: boolean
    icebergAmount?: number
    icebergThreshold?: number
    icebergStartRealCount?: number
  },
>(scrim: T): PublicScrim<T> {
  const {
    publicConfirmedTeams,
    icebergEnabled: _ie,
    icebergShowAllFilled: _isaf,
    icebergAmount: _ia,
    icebergThreshold: _it,
    icebergStartRealCount: _isr,
    ...rest
  } = scrim

  return {
    ...rest,
    roomId: null,
    roomPassword: null,
    confirmedTeams:
      typeof publicConfirmedTeams === "number" ? publicConfirmedTeams : scrim.confirmedTeams,
  }
}
