export const alertTypes = {
  WARNING: 'WARNING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  INFO: 'INFO',
} as const;

export type AlertType = (typeof alertTypes)[keyof typeof alertTypes];

export const slackAlertPrefaceMap = {
  [alertTypes.ERROR]: '🟥',
  [alertTypes.SUCCESS]: '🟩',
  [alertTypes.INFO]: 'ℹ️',
  [alertTypes.WARNING]: '⚠️',
};
