export interface Token {
  processId: string;
  denomination?: number;
  symbol?: string;
  name?: string;
}

export interface SwapQuoteResponse {
  fromTokenId: string;
  toTokenId: string;
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
  estimatedOutput: number;
  intermediateOutput?: number;
  estimatedFee: number;
  intermediateEstimatedFee?: number;
  intermediateTokenId?: string;
  error?: string;
}

export interface ReverseSwapEstimate {
  fee: number;
  inputRequired: number;
  inputWithFee: number;
}

export interface ReverseQuoteResponse {
  fromTokenId: string;
  toTokenId: string;
  desiredOutput: number;
  routes: RouteWithReverseEstimate[];
  bestRoute: RouteWithReverseEstimate | null;
  totalRoutesFound: number;
  validRoutesWithEstimates: number;
  executionTime: number;
}

export interface RouteWithReverseEstimate {
  dex: 'botega' | 'permaswap';
  pools: RoutePool[];
  hops: number;
  requiredInput: number;
  estimatedFee: number;
  inputWithFee: number;
  estimatedOutput: number;
  intermediateInputRequired?: number;
  intermediateEstimatedFee?: number;
  intermediateTokenId?: string;
  error?: string;
}

export interface RoutePool {
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  fee?: string;
}

export interface QuickQuoteResponse {
  bestRoute: RouteWithEstimate | null;
  estimatedOutput: number;
  estimatedFee: number;
  executionTime: number;
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
