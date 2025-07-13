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

export type DryrunResult = {
  Messages: Array<{
    Tags: Array<{ name: string; value: string }>;
    Data: string;
  }>;
};

export interface NoteStatus {
  Issuer: string;
  HolderAssetID: string;
  Price: number;
  Status: string;
  AssetID: string;
  IssueDate: number;
  ExpireDate: number;
  UsePredicted: boolean;
  ID: number;
  SettleVersion: string;
  NoteID: string;
  Amount: string;
  MakeTx: string;
  HolderAmount: string;
  Settle: string;
}
