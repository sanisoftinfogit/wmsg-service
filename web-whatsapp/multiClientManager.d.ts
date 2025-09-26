import PersistentQueue from './queue';
import SenderPool from './senderPool';
import ClientManager from './clientManager';
/**
 * MultiClientManager
 * Handles multiple WhatsApp clients (sessions)
 */
type ClientResponse = {
    client: ClientManager;
    pool: SenderPool;
    queue: PersistentQueue;
};
declare class MultiClientManager {
    clients: Record<string, any>;
    constructor();
    addClient(clientId: string): Promise<ClientResponse>;
    getClient(clientId: string): ClientResponse;
    listClients(): string[];
}
export default MultiClientManager;
