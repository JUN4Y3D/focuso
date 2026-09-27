import assert from 'node:assert/strict';
import {
  calculateBasePricing,
  PricingValidationError,
  PRICING_CONFIG,
} from './pricing.js';

interface TestCase {
  name: string;
  fn: () => void;
}

const tests: TestCase[] = [
  // 1. Valid Calculations
  {
    name: 'Valid: Quantity 1 + Inside Chattogram (unit: 250, subtotal: 250, delivery: 60, total: 310)',
    fn: () => {
      const res = calculateBasePricing({ quantity: 1, deliveryZone: 'inside_chattogram' });
      assert.equal(res.quantity, 1);
      assert.equal(res.unitPrice, 250);
      assert.equal(res.productSubtotal, 250);
      assert.equal(res.deliveryZone, 'inside_chattogram');
      assert.equal(res.deliveryCharge, 60);
      assert.equal(res.preDiscountTotal, 310);
    },
  },
  {
    name: 'Valid: Quantity 1 + Outside Chattogram (unit: 250, subtotal: 250, delivery: 100, total: 350)',
    fn: () => {
      const res = calculateBasePricing({ quantity: 1, deliveryZone: 'outside_chattogram' });
      assert.equal(res.quantity, 1);
      assert.equal(res.unitPrice, 250);
      assert.equal(res.productSubtotal, 250);
      assert.equal(res.deliveryZone, 'outside_chattogram');
      assert.equal(res.deliveryCharge, 100);
      assert.equal(res.preDiscountTotal, 350);
    },
  },
  {
    name: 'Valid: Quantity 2 + Inside Chattogram (subtotal: 500, delivery: 60, total: 560)',
    fn: () => {
      const res = calculateBasePricing({ quantity: 2, deliveryZone: 'inside_chattogram' });
      assert.equal(res.quantity, 2);
      assert.equal(res.productSubtotal, 500);
      assert.equal(res.deliveryCharge, 60);
      assert.equal(res.preDiscountTotal, 560);
    },
  },
  {
    name: 'Valid: Quantity 2 + Outside Chattogram (subtotal: 500, delivery: 100, total: 600)',
    fn: () => {
      const res = calculateBasePricing({ quantity: 2, deliveryZone: 'outside_chattogram' });
      assert.equal(res.quantity, 2);
      assert.equal(res.productSubtotal, 500);
      assert.equal(res.deliveryCharge, 100);
      assert.equal(res.preDiscountTotal, 600);
    },
  },
  {
    name: 'Valid: Quantity 9 (maximum valid quantity succeeds)',
    fn: () => {
      const res = calculateBasePricing({ quantity: 9, deliveryZone: 'inside_chattogram' });
      assert.equal(res.quantity, 9);
      assert.equal(res.productSubtotal, 2250);
      assert.equal(res.deliveryCharge, 60);
      assert.equal(res.preDiscountTotal, 2310);
    },
  },

  // 1b. District-based calculations (Step 4B)
  {
    name: 'District: Quantity 1 + Chattogram (unit: 250, subtotal: 250, delivery: 60, total: 310)',
    fn: () => {
      const res = calculateBasePricing({ quantity: 1, district: 'Chattogram' });
      assert.equal(res.quantity, 1);
      assert.equal(res.deliveryZone, 'inside_chattogram');
      assert.equal(res.deliveryCharge, 60);
      assert.equal(res.preDiscountTotal, 310);
    },
  },
  {
    name: 'District: Quantity 1 + Chittagong (alias inside_chattogram -> delivery: 60, total: 310)',
    fn: () => {
      const res = calculateBasePricing({ quantity: 1, district: 'Chittagong' });
      assert.equal(res.quantity, 1);
      assert.equal(res.deliveryZone, 'inside_chattogram');
      assert.equal(res.deliveryCharge, 60);
      assert.equal(res.preDiscountTotal, 310);
    },
  },
  {
    name: 'District: Quantity 1 + Dhaka (outside_chattogram -> delivery: 100, total: 350)',
    fn: () => {
      const res = calculateBasePricing({ quantity: 1, district: 'Dhaka' });
      assert.equal(res.quantity, 1);
      assert.equal(res.deliveryZone, 'outside_chattogram');
      assert.equal(res.deliveryCharge, 100);
      assert.equal(res.preDiscountTotal, 350);
    },
  },
  {
    name: 'District: Quantity 2 + Chattogram (subtotal: 500, delivery: 60, total: 560)',
    fn: () => {
      const res = calculateBasePricing({ quantity: 2, district: 'Chattogram' });
      assert.equal(res.quantity, 2);
      assert.equal(res.productSubtotal, 500);
      assert.equal(res.deliveryCharge, 60);
      assert.equal(res.preDiscountTotal, 560);
    },
  },
  {
    name: 'District: Quantity 2 + Rajshahi (subtotal: 500, delivery: 100, total: 600)',
    fn: () => {
      const res = calculateBasePricing({ quantity: 2, district: 'Rajshahi' });
      assert.equal(res.quantity, 2);
      assert.equal(res.productSubtotal, 500);
      assert.equal(res.deliveryCharge, 100);
      assert.equal(res.preDiscountTotal, 600);
    },
  },
  {
    name: 'District: Quantity 2 + Khulna (subtotal: 500, delivery: 100, total: 600)',
    fn: () => {
      const res = calculateBasePricing({ quantity: 2, district: 'Khulna' });
      assert.equal(res.quantity, 2);
      assert.equal(res.productSubtotal, 500);
      assert.equal(res.deliveryCharge, 100);
      assert.equal(res.preDiscountTotal, 600);
    },
  },

  // 2. Invalid Quantity Rejections
  {
    name: 'Invalid: Quantity 0 rejected with PricingValidationError',
    fn: () => {
      assert.throws(
        () => calculateBasePricing({ quantity: 0, deliveryZone: 'inside_chattogram' }),
        (err: unknown) => err instanceof PricingValidationError && err.field === 'quantity'
      );
    },
  },
  {
    name: 'Invalid: Negative quantity (-1) rejected',
    fn: () => {
      assert.throws(
        () => calculateBasePricing({ quantity: -1, deliveryZone: 'inside_chattogram' }),
        (err: unknown) => err instanceof PricingValidationError && err.field === 'quantity'
      );
    },
  },
  {
    name: 'Invalid: Decimal quantity (1.5) rejected',
    fn: () => {
      assert.throws(
        () => calculateBasePricing({ quantity: 1.5, deliveryZone: 'inside_chattogram' }),
        (err: unknown) => err instanceof PricingValidationError && err.field === 'quantity'
      );
    },
  },
  {
    name: 'Invalid: Quantity 10 (> max 9) rejected',
    fn: () => {
      assert.throws(
        () => calculateBasePricing({ quantity: 10, deliveryZone: 'inside_chattogram' }),
        (err: unknown) => err instanceof PricingValidationError && err.field === 'quantity'
      );
    },
  },
  {
    name: 'Invalid: NaN quantity rejected',
    fn: () => {
      assert.throws(
        () => calculateBasePricing({ quantity: NaN, deliveryZone: 'inside_chattogram' }),
        (err: unknown) => err instanceof PricingValidationError && err.field === 'quantity'
      );
    },
  },
  {
    name: 'Invalid: Infinity quantity rejected',
    fn: () => {
      assert.throws(
        () => calculateBasePricing({ quantity: Infinity, deliveryZone: 'inside_chattogram' }),
        (err: unknown) => err instanceof PricingValidationError && err.field === 'quantity'
      );
    },
  },

  // 3. Invalid Delivery Zone Rejections
  {
    name: 'Invalid: Unsupported delivery zone rejected without silent fallback',
    fn: () => {
      assert.throws(
        () => calculateBasePricing({ quantity: 1, deliveryZone: 'dhaka_express' }),
        (err: unknown) => err instanceof PricingValidationError && err.field === 'deliveryZone'
      );
    },
  },
  {
    name: 'Invalid: Missing delivery zone (undefined) rejected',
    fn: () => {
      assert.throws(
        () => calculateBasePricing({ quantity: 1, deliveryZone: undefined }),
        (err: unknown) => err instanceof PricingValidationError && err.field === 'deliveryZone'
      );
    },
  },
  {
    name: 'Invalid: Empty string delivery zone rejected',
    fn: () => {
      assert.throws(
        () => calculateBasePricing({ quantity: 1, deliveryZone: '' }),
        (err: unknown) => err instanceof PricingValidationError && err.field === 'deliveryZone'
      );
    },
  },
];

let passed = 0;
let failed = 0;

console.log('Running FOCUSO Pricing Engine Tests:');
for (const test of tests) {
  try {
    test.fn();
    console.log(`  ✓ ${test.name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${test.name}`);
    console.error(`    ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${tests.length} tests.`);
if (failed > 0) {
  process.exit(1);
}
