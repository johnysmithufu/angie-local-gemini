import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class InMemoryTransport implements Transport {
    private peer?: InMemoryTransport;
    public onmessage?: (message: JSONRPCMessage) => void;
    public onclose?: () => void;
    public onerror?: (error: Error) => void;

    connect(peer: InMemoryTransport) {
        this.peer = peer;
        peer.peer = this;
    }

    async start() {}

    async send(message: JSONRPCMessage) {
        if (!this.peer) throw new Error("Transport not connected.");
        setTimeout(() => this.peer?.onmessage?.(message), 0);
    }

    async close() {
        this.onclose?.();
    }
}
