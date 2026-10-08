import { describe, expect, it } from 'vitest';
import {
  SQUARE_FACTS_CHECKED_ISO,
  SQUARE_SOURCES,
  SQUARE_UK_PLANS,
  SQUARE_CALCULATOR_LIMITS,
  SQUARE_SUBSCRIPTION_FACTS,
  SQUARE_PAYMENT_CHANNEL_FACTS,
  squareBaseMonthlyPriceGbp,
  requireVerifiedSquarePaymentFact,
  estimateSquarePaymentFeeGbp,
} from './squareFacts';

describe('Square Appointments UK source of truth — calculator readiness', () => {
 it('locks exact publicly verified plan headline prices, sources and checked date', () => {
   expect(SQUARE_FACTS_CHECKED_ISO).toBe('2026-10-08');
   expect(SQUARE_UK_PLANS.map(x => x.monthlyGbp)).toEqual([0,29,69]);
   expect(squareBaseMonthlyPriceGbp('free')).toBe(0);
   expect(squareBaseMonthlyPriceGbp('plus')).toBe(29);
   expect(squareBaseMonthlyPriceGbp('premium')).toBe(69);
   expect(SQUARE_SUBSCRIPTION_FACTS.plus.vatBasis).toBe('unverified');
   expect(SQUARE_SUBSCRIPTION_FACTS.premium.vatBasis).toBe('unverified');
   expect(SQUARE_SOURCES.every(x=>x.url.startsWith('https://squareup.com/'))).toBe(true);
   expect(new Set(SQUARE_SOURCES.map(x=>x.url)).size).toBe(SQUARE_SOURCES.length);
 });
 it('retains provenance and unresolved status for every payment channel', () => {
   for(const fact of Object.values(SQUARE_PAYMENT_CHANNEL_FACTS)) {
     expect(fact.sourceUrl).toMatch(/^https:\/\/squareup\.com\//);
     expect(fact.checkedIso).toBe(SQUARE_FACTS_CHECKED_ISO);
     expect(fact.note.length).toBeGreaterThan(20);
   }
   expect(SQUARE_PAYMENT_CHANNEL_FACTS['appointments-online-deposit'].status).toBe('unresolved');
   expect(() => requireVerifiedSquarePaymentFact('appointments-online-deposit')).toThrow(/unresolved/);
   expect(estimateSquarePaymentFeeGbp(5,'free','appointments-online-deposit')).toBeNull();
   expect(estimateSquarePaymentFeeGbp(5,'premium','appointments-online-deposit')).toBeNull();
   expect(SQUARE_CALCULATOR_LIMITS.appDepositProcessingRateVerified).toBe(false);
   expect(SQUARE_CALCULATOR_LIMITS.paidSubscriptionVatVerified).toBe(false);
 });
 it('computes only separately identified, verified payment types per transaction', () => {
   expect(estimateSquarePaymentFeeGbp(5,'free','square-online-uk')).toBe(0.32);
   expect(estimateSquarePaymentFeeGbp(5,'plus','square-online-uk')).toBe(0.32);
   expect(estimateSquarePaymentFeeGbp(5,'free','square-online-non-uk')).toBe(0.38);
   expect(estimateSquarePaymentFeeGbp(5,'free','in-person-uk')).toBe(0.09);
   expect(estimateSquarePaymentFeeGbp(5,'premium','in-person-uk')).toBe(0.08);
   expect(estimateSquarePaymentFeeGbp(5,'plus','manual-or-card-on-file-uk')).toBe(0.13);
   expect(estimateSquarePaymentFeeGbp(0,'free','square-online-uk')).toBe(0);
 });
 it('rejects invalid amounts instead of producing corrupt pricing', () => {
   expect(()=>estimateSquarePaymentFeeGbp(-1,'free','square-online-uk')).toThrow();
   expect(()=>estimateSquarePaymentFeeGbp(Number.NaN,'free','square-online-uk')).toThrow();
   expect(()=>estimateSquarePaymentFeeGbp(Number.POSITIVE_INFINITY,'free','square-online-uk')).toThrow();
 });
});
