import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { TaskStore } from './task-store.js';

export class TaskStoreController implements ReactiveController {
  private host: ReactiveControllerHost;
  private store: TaskStore;
  private onChanged = () => this.host.requestUpdate();
  private onSnapshot = () => this.host.requestUpdate();

  constructor(host: ReactiveControllerHost, store: TaskStore) {
    this.host = host;
    this.store = store;
    host.addController(this);
  }

  hostConnected(): void {
    this.store.addEventListener('tasks-changed', this.onChanged);
    this.store.addEventListener('snapshot-complete', this.onSnapshot);
  }

  hostDisconnected(): void {
    this.store.removeEventListener('tasks-changed', this.onChanged);
    this.store.removeEventListener('snapshot-complete', this.onSnapshot);
  }

  get taskStore(): TaskStore {
    return this.store;
  }
}
