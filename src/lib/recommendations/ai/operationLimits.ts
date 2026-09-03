/** Shared token limits for classifier requests and conservative cost planning. */
export const RECOMMENDATION_OPERATION_LIMITS = {
  classifyService: { conservativeInputTokens: 1800, maxOutputTokens: 2000 },
  classifyProduct: { conservativeInputTokens: 1800, maxOutputTokens: 2000 },
  rerank: { conservativeInputTokens: 2500, maxOutputTokens: 500 },
} as const;

export type RecommendationOperationKind = keyof typeof RECOMMENDATION_OPERATION_LIMITS;
