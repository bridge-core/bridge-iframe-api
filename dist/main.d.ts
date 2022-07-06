export declare function trigger<ResponseData = any, TriggerData = any>(event: string, data: TriggerData, target?: Window | null): Promise<ResponseData>;
export declare function simpleTrigger<T = any>(event: string, data: T, target?: Window | null): string;
export declare function on<T = any>(eventName: string, callback: (data: T, origin: string, response: <T = any>(payload: T) => void) => void, receiver?: Window | null): void;
