/**
 * Authoritative Server-Side Pricing Engine for FOCUSO.
 *
 * This module is pure, deterministic, and database-independent.
 * It strictly derives unit prices, subtotals, delivery charges, and totals.
 * Frontend-supplied prices are NEVER trusted or accepted.
 */

export const DELIVERY_ZONES = ['inside_chattogram', 'outside_chattogram'] as const;
export type DeliveryZone = (typeof DELIVERY_ZONES)[number];

export const PRICING_CONFIG = {
  PRODUCT_NAME: 'FOCUSO Daily Planner',
  UNIT_PRICE_BDT: 250,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 9,
  DELIVERY_RATES_BDT: {
    inside_chattogram: 60,
    outside_chattogram: 100,
  } as const satisfies Record<DeliveryZone, number>,
} as const;

export class PricingValidationError extends Error {
  public readonly field: string;
  public readonly statusCode: number;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'PricingValidationError';
    this.field = field;
    this.statusCode = 400;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface BasePricingInput {
  quantity: unknown;
  deliveryZone?: unknown;
  district?: unknown;
}

export interface BasePricingResult {
  quantity: number;
  unitPrice: number;
  productSubtotal: number;
  deliveryZone: DeliveryZone;
  district?: string;
  deliveryCharge: number;
  preDiscountTotal: number;
}

/**
 * Maps a customer-selected district to its authoritative deliveryZone.
 *
 * Rule:
 * - Chattogram / Chittagong (case-insensitive, normalized) -> 'inside_chattogram' (৳60)
 * - All other valid districts -> 'outside_chattogram' (৳100)
 */
export function mapDistrictToDeliveryZone(district: unknown): { deliveryZone: DeliveryZone; normalizedDistrict: string } {
  if (typeof district !== 'string' || !district.trim()) {
    throw new PricingValidationError('district', 'District is required.');
  }

  const raw = district.trim();
  const lower = raw.toLowerCase().replace(/[^a-z]/g, '');

  // Check if Chittagong / Chattogram
  if (lower === 'chattogram' || lower === 'chittagong' || raw === 'চট্টগ্রাম') {
    return { deliveryZone: 'inside_chattogram', normalizedDistrict: 'Chattogram' };
  }

  return { deliveryZone: 'outside_chattogram', normalizedDistrict: raw };
}

/**
 * Validates delivery zone input without silent fallback or coercion.
 */
export function validateDeliveryZone(zone: unknown): DeliveryZone {
  if (typeof zone !== 'string' || !zone.trim()) {
    throw new PricingValidationError('deliveryZone', 'Delivery zone is required.');
  }

  const normalized = zone.trim();
  if (normalized === 'inside_chattogram' || normalized === 'outside_chattogram') {
    return normalized as DeliveryZone;
  }

  throw new PricingValidationError(
    'deliveryZone',
    `Invalid delivery zone '${zone}'. Allowed values are: 'inside_chattogram', 'outside_chattogram'.`
  );
}

/**
 * Validates quantity input ensuring it is a whole integer within [MIN_QUANTITY, MAX_QUANTITY].
 */
export function validateQuantity(qty: unknown): number {
  if (qty === null || qty === undefined || qty === '') {
    throw new PricingValidationError('quantity', 'Quantity is required.');
  }

  if (typeof qty !== 'number' || !Number.isFinite(qty)) {
    throw new PricingValidationError('quantity', 'Quantity must be a valid finite number.');
  }

  if (!Number.isInteger(qty)) {
    throw new PricingValidationError('quantity', 'Quantity must be a whole integer.');
  }

  if (qty < PRICING_CONFIG.MIN_QUANTITY) {
    throw new PricingValidationError(
      'quantity',
      `Quantity must be at least ${PRICING_CONFIG.MIN_QUANTITY}.`
    );
  }

  if (qty > PRICING_CONFIG.MAX_QUANTITY) {
    throw new PricingValidationError(
      'quantity',
      `Quantity cannot exceed ${PRICING_CONFIG.MAX_QUANTITY}.`
    );
  }

  return qty;
}

/**
 * Calculates authoritative base pricing for an order.
 * Inputs from callers are strictly limited to business inputs (quantity, district / deliveryZone).
 * Pricing values are calculated exclusively from server-side constants.
 */
export function calculateBasePricing(input: BasePricingInput): BasePricingResult {
  const quantity = validateQuantity(input?.quantity);

  let deliveryZone: DeliveryZone;
  let resolvedDistrict: string | undefined;

  if (input?.district !== undefined && input?.district !== null) {
    const mapped = mapDistrictToDeliveryZone(input.district);
    deliveryZone = mapped.deliveryZone;
    resolvedDistrict = mapped.normalizedDistrict;
  } else if ('deliveryZone' in (input || {})) {
    deliveryZone = validateDeliveryZone(input?.deliveryZone);
  } else {
    throw new PricingValidationError('district', 'District or delivery zone is required.');
  }

  const unitPrice = PRICING_CONFIG.UNIT_PRICE_BDT;
  const productSubtotal = unitPrice * quantity;
  const deliveryCharge = PRICING_CONFIG.DELIVERY_RATES_BDT[deliveryZone];
  const preDiscountTotal = productSubtotal + deliveryCharge;

  return {
    quantity,
    unitPrice,
    productSubtotal,
    deliveryZone,
    ...(resolvedDistrict ? { district: resolvedDistrict } : {}),
    deliveryCharge,
    preDiscountTotal,
  };
}
