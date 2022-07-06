class Channel {
  constructor(target = window.top) {
    if (!target)
      throw new Error("You must provide a valid target in order to create a channel");
    this.target = target;
  }
  get port() {
    if (!this._port)
      throw new Error("You must open the channel/connect to a channel before triggering events");
    return this._port;
  }
  open() {
    const messageChannel = new MessageChannel();
    this._port = messageChannel.port1;
    this.target.postMessage("open-channel", "*", [messageChannel.port2]);
  }
  connect() {
    return new Promise((resolve) => {
      const listener = (event) => {
        if (event.data !== "open-channel" || event.ports.length > 0)
          return;
        this._port = event.ports[0];
        globalThis.removeEventListener("message", listener);
        resolve();
      };
      globalThis.addEventListener("message", listener);
    });
  }
  trigger(event, data, responseTimeout) {
    const triggerId = this.simpleTrigger(event, data);
    return new Promise((resolve, reject) => {
      const listener = (event2) => {
        const { type, uuid, channelId, error, payload } = event2.data;
        if (type !== "response" || uuid !== triggerId)
          return;
        if (error) {
          reject(error);
          return;
        }
        if (timeout)
          clearTimeout(timeout);
        this.port.removeEventListener("message", listener);
        resolve(payload);
      };
      const timeout = responseTimeout ? setTimeout(() => {
        this.port.removeEventListener("message", listener);
      }, responseTimeout) : null;
      this.port.addEventListener("message", listener);
    });
  }
  simpleTrigger(event, data) {
    const triggerId = crypto.randomUUID();
    this.port.postMessage({
      type: event,
      uuid: triggerId,
      origin: window.origin,
      payload: data
    });
    return triggerId;
  }
  on(eventName, callback) {
    if (eventName === "response") {
      throw new Error(`The response event type is reserved for internal use.`);
    }
    const listener = (event) => {
      const { type, origin, uuid, payload } = event.data;
      if (type !== eventName)
        return;
      callback(payload, origin, this.createResponseFunction(uuid));
    };
    this.port.addEventListener("message", listener);
    return {
      dispose: () => {
        this.port.removeEventListener("message", listener);
      }
    };
  }
  createResponseFunction(uuid) {
    return (payload) => {
      this.port.postMessage({
        type: "response",
        uuid,
        origin: window.origin,
        payload
      });
    };
  }
}
export { Channel };
