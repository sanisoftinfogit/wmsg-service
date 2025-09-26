import { Client } from "whatsapp-web.js";
import { EventEmitter } from "events";
import SenderPool from "./senderPool";
declare class ClientManager extends EventEmitter {
    private clientId;
    private qr;
    private ready;
    private reconnectAttempts;
    client: Client;
    constructor(clientId: string);
    initialize(pool: SenderPool): Promise<void>;
    getQR(retries?: number): Promise<string | undefined>;
    isReady(): boolean;
    getClient(): Client;
    attemptReconnect(): Promise<void>;
}
export default ClientManager;
