export type DryrunResult = {
  Messages: Array<{
    Tags: Array<{ name: string; value: string }>;
    Data: string;
  }>;
};
