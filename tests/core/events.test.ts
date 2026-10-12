import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/events';

interface TestEvents {
  ping: number;
  pong: string;
}

describe('EventBus', () => {
  it('delivers the payload only to handlers of that event', () => {
    const bus = new EventBus<TestEvents>();
    const ping = vi.fn();
    const pong = vi.fn();
    bus.on('ping', ping);
    bus.on('pong', pong);

    bus.emit('ping', 42);

    expect(ping).toHaveBeenCalledWith(42);
    expect(pong).not.toHaveBeenCalled();
  });

  it('calls every handler of an event', () => {
    const bus = new EventBus<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('ping', a);
    bus.on('ping', b);

    bus.emit('ping', 1);

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('stops delivering after the returned unsubscribe is called', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const off = bus.on('ping', handler);

    off();
    bus.emit('ping', 1);

    expect(handler).not.toHaveBeenCalled();
  });

  it('emitting with no handlers is a no-op', () => {
    expect(() => new EventBus<TestEvents>().emit('pong', 'x')).not.toThrow();
  });
});
