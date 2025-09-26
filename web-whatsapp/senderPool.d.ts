import ClientManager from "./clientManager";
import PersistentQueue from "./queue";
declare class SenderPool {
    private client;
    private queue;
    private concurrency;
    private running;
    private stopped;
    private lastSentAt;
    constructor(client: ClientManager, queue: PersistentQueue, concurrency: number);
    start(): void;
    stop(): void;
    _maybeStartWorker(): void;
    _worker(): Promise<void>;
    _sendWithRetries(task: Record<string, any>): Promise<void>;
}
export default SenderPool;
