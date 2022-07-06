export declare class Channel {
    protected target: Window;
    protected _port?: MessagePort;
    protected listeners: Map<string, (data: any, origin: string) => Promise<any> | any>;
    protected awaitingResponse: Map<string, (payload: any, error?: string) => void>;
    constructor(target?: Window | null);
    protected get port(): MessagePort;
    open(): Promise<void>;
    connect(): Promise<void>;
    protected startListening(): void;
    protected respond(uuid: string, payload: any): void;
    trigger<ResponseData = any, TriggerData = any>(event: string, data: TriggerData, responseTimeout?: number): Promise<ResponseData>;
    protected _simpleTrigger<T = any>(event: string, data: T, triggerId?: string, noResponse?: true): void;
    simpleTrigger<T = any>(event: string, data: T): void;
    on<Data = any, Response = void>(eventName: string, callback: (data: Data, origin: string) => Response): {
        dispose: () => void;
    };
}
