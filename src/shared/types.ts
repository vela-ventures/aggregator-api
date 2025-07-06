export interface SwapQuoteResponse {
  fromToken: Token;
  toToken: Token;
  inputAmount: number;
  routes: RouteWithEstimate[];
  bestRoute: RouteWithEstimate | null;
  totalRoutesFound: number;
  validRoutesWithEstimates: number;
  executionTime: number;
}

export interface RouteWithEstimate {
  dex: 'botega' | 'permaswap';
  pools: RoutePool[];
  hops: number;
  estimatedOutput?: number;
  intermediateOutput?: number;
  estimatedFee?: number;
  intermediateToken?: Token;
  error?: string;
}

export interface RoutePool {
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  fee?: string;
}

export interface Token {
  processId: string;
  denomination: number;
  symbol?: string;
  name?: string;
}

export interface QuickQuoteResponse {
  bestRoute: RouteWithEstimate | null;
  estimatedOutput: number;
  estimatedFee: number;
  executionTime: number;
}

export function convertToDenomination(
  amount: number,
  denomination: number,
): string {
  return Math.floor(amount * Math.pow(10, denomination)).toString();
}

export function convertFromDenomination(
  amount: number,
  denomination: number,
): number {
  return amount / Math.pow(10, denomination);
} 