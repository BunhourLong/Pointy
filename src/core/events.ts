type Handler<T> = (payload: T) => void;

/** Minimal typed pub/sub. `on` returns an unsubscribe function. */
export class EventBus<M> {
  private handlers: { [K in keyof M]?: Set<Handler<M[K]>> } = {};

  on<K extends keyof M>(type: K, handler: Handler<M[K]>): () => void {
    (this.handlers[type] ??= new Set()).add(handler);
    return () => this.handlers[type]?.delete(handler);
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    this.handlers[type]?.forEach((h) => h(payload));
  }
}
