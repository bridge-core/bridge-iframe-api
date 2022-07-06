export declare class Channel {
    protected target: Window;
    protected _port?: MessagePort;
    protected listeners: Map<string, (data: any, origin: string) => any>;
    protected awaitingResponse: Map<string, (event: MessageEvent) => void>;
    constructor(target?: Window | null);
    protected get port(): MessagePort;
    open(): Promise<void>;
    connect(): Promise<void>;
    protected startListening(): void;
    trigger<ResponseData = any, TriggerData = any>(event: string, data: TriggerData, responseTimeout?: number): Promise<ResponseData>;
    simpleTrigger<T = any>(event: string, data: T): string;
    on<Data = any, Response = void>(eventName: string, callback: (data: Data, origin: string) => Response): {
        dispose: () => void;
    };
    protected respond(uuid: string, payload: any): void;
}
