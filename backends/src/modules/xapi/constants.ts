export const XAPI_QUEUE_NAMES = {
  STATEMENTS: 'xapi-statements',
} as const;

export const XAPI_JOB_NAMES = {
  TRANSMIT_STATEMENT: 'transmit-statement',
} as const;

export interface TransmitStatementJobData {
  statementId: string;
}
