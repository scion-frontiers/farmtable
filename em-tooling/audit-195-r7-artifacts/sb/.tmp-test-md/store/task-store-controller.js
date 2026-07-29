export class TaskStoreController {
    constructor(host, store) {
        this.onChanged = () => this.host.requestUpdate();
        this.onSnapshot = () => this.host.requestUpdate();
        this.host = host;
        this.store = store;
        host.addController(this);
    }
    hostConnected() {
        this.store.addEventListener('tasks-changed', this.onChanged);
        this.store.addEventListener('snapshot-complete', this.onSnapshot);
    }
    hostDisconnected() {
        this.store.removeEventListener('tasks-changed', this.onChanged);
        this.store.removeEventListener('snapshot-complete', this.onSnapshot);
    }
    get taskStore() {
        return this.store;
    }
}
//# sourceMappingURL=task-store-controller.js.map