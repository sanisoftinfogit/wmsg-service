import PersistentQueue from "./queue";
import SenderPool from "./senderPool";
type Payload = {
    to: string;
    message?: string;
    options?: Record<string, any>;
};
declare function addToQueue(queue: PersistentQueue, pool: SenderPool, messagePayload: Payload): void;
export default addToQueue;
