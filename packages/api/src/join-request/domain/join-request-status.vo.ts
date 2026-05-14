export const JOIN_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
] as const;

export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

export function isJoinRequestStatus(v: unknown): v is JoinRequestStatus {
  return (
    typeof v === 'string' &&
    (JOIN_REQUEST_STATUSES as readonly string[]).includes(v)
  );
}
