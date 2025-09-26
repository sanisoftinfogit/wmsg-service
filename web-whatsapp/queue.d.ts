declare class PersistentQueue {
    private filename;
    private queue;
    constructor(filename: string);
    push(item: Record<string, any>): void;
    shift(): Record<string, any> | undefined;
    peek(): Record<string, any>;
    isEmpty(): boolean;
    length(): number;
    _save(): void;
}
export default PersistentQueue;
