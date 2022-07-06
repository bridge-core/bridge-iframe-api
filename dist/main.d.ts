export declare class Channel {
    protected target: Window;
    protected _port?: MessagePort;
    constructor(target?: Window | null);
    protected get port(): MessagePort;
    open(): void;
    connect(): Promise<void>;
    trigger<ResponseData = any, TriggerData = any>(event: string, data: TriggerData, responseTimeout?: number): Promise<ResponseData>;
    simpleTrigger<T = any>(event: string, data: T): string;
    on<T = any>(eventName: string, callback: (data: T, origin: string, response: <T = any>(payload: T) => void) => void): {
        dispose: () => void;
    };
    protected createResponseFunction(uuid: string): (payload: any) => void;
}
