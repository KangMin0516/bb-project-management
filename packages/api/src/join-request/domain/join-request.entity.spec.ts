import { describe, expect, it } from '@jest/globals';
import { JoinRequest, JoinRequestDomainError } from './join-request.entity.js';
import { JoinRequestApprovedEvent } from './events/join-request-approved.event.js';
import { JoinRequestCreatedEvent } from './events/join-request-created.event.js';
import { JoinRequestRejectedEvent } from './events/join-request-rejected.event.js';

const base = {
  id: 'jr-1',
  projectId: 'p-1',
  requesterId: 'u-requester',
};

describe('JoinRequest.create', () => {
  it('starts in PENDING with no resolved fields', () => {
    const r = JoinRequest.create(base);
    expect(r.status).toBe('PENDING');
    expect(r.isPending).toBe(true);
    expect(r.resolvedById).toBeNull();
    expect(r.resolvedAt).toBeNull();
    expect(r.rejectionReason).toBeNull();
  });

  it('trims whitespace-only messages to null', () => {
    const r = JoinRequest.create({ ...base, message: '   ' });
    expect(r.message).toBeNull();
  });

  it('preserves non-empty messages verbatim after trim', () => {
    const r = JoinRequest.create({ ...base, message: '  please add me  ' });
    expect(r.message).toBe('please add me');
  });

  it('emits a Created event', () => {
    const r = JoinRequest.create(base);
    const events = r.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(JoinRequestCreatedEvent);
  });
});

describe('JoinRequest.approve (J-4)', () => {
  it('transitions PENDING → APPROVED with resolver + timestamp', () => {
    const r = JoinRequest.create(base);
    r.pullEvents();

    r.approve('u-admin');

    expect(r.status).toBe('APPROVED');
    expect(r.resolvedById).toBe('u-admin');
    expect(r.resolvedAt).toBeInstanceOf(Date);
  });

  it('emits an Approved event', () => {
    const r = JoinRequest.create(base);
    r.pullEvents();
    r.approve('u-admin');

    const events = r.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(JoinRequestApprovedEvent);
  });

  it('rejects a second approval (already resolved)', () => {
    const r = JoinRequest.create(base);
    r.approve('u-admin');

    expect(() => r.approve('u-other')).toThrow(JoinRequestDomainError);
  });
});

describe('JoinRequest.reject (J-6)', () => {
  it('transitions PENDING → REJECTED with reason', () => {
    const r = JoinRequest.create(base);
    r.reject('u-admin', 'not eligible');

    expect(r.status).toBe('REJECTED');
    expect(r.rejectionReason).toBe('not eligible');
    expect(r.resolvedById).toBe('u-admin');
  });

  it('trims rejection reason; whitespace becomes null', () => {
    const r = JoinRequest.create(base);
    r.reject('u-admin', '   ');
    expect(r.rejectionReason).toBeNull();
  });

  it('rejects a second resolve (already approved)', () => {
    const r = JoinRequest.create(base);
    r.approve('u-admin');
    expect(() => r.reject('u-admin', 'oops')).toThrow(JoinRequestDomainError);
  });

  it('emits a Rejected event with the trimmed reason', () => {
    const r = JoinRequest.create(base);
    r.pullEvents();
    r.reject('u-admin', '  bad fit  ');
    const events = r.pullEvents();
    expect(events).toHaveLength(1);
    const ev = events[0] as JoinRequestRejectedEvent;
    expect(ev.reason).toBe('bad fit');
  });
});

describe('JoinRequest.ensureCancellableBy (J-7)', () => {
  it('passes when called by requester on a PENDING request', () => {
    const r = JoinRequest.create(base);
    expect(() => r.ensureCancellableBy('u-requester')).not.toThrow();
  });

  it('throws NOT_REQUESTER when caller is not the requester', () => {
    const r = JoinRequest.create(base);
    try {
      r.ensureCancellableBy('u-imposter');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(JoinRequestDomainError);
      expect((err as JoinRequestDomainError).code).toBe('NOT_REQUESTER');
    }
  });

  it('throws ALREADY_RESOLVED when status is APPROVED', () => {
    const r = JoinRequest.create(base);
    r.approve('u-admin');
    try {
      r.ensureCancellableBy('u-requester');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(JoinRequestDomainError);
      expect((err as JoinRequestDomainError).code).toBe('ALREADY_RESOLVED');
    }
  });
});
