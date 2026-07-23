function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function estimateTokenCostMicrousd({
  inputTokens = 0,
  outputTokens = 0,
  inputUsdPerMillion = 0,
  outputUsdPerMillion = 0
} = {}) {
  const input = nonNegativeNumber(inputTokens);
  const output = nonNegativeNumber(outputTokens);
  const inputRate = nonNegativeNumber(inputUsdPerMillion);
  const outputRate = nonNegativeNumber(outputUsdPerMillion);
  const usd = ((input * inputRate) + (output * outputRate)) / 1_000_000;
  return Math.max(0, Math.round(usd * 1_000_000));
}

export function estimateFixedRequestCostMicrousd(usdPerRequest = 0) {
  return Math.max(0, Math.round(nonNegativeNumber(usdPerRequest) * 1_000_000));
}

export function formatMicrousd(microusd = 0) {
  return (Math.max(0, Number(microusd) || 0) / 1_000_000).toFixed(6);
}

export const estimateOpenAiCostMicrousd = estimateTokenCostMicrousd;
