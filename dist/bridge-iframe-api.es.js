class Channel {
  constructor(target = window.top) {
    this.listeners = /* @__PURE__ */ new Map();
    this.awaitingResponse = /* @__PURE__ */ new Map();
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
    return new Promise((resolve) => {
      const listener = async (event) => {
        if (event.data !== "bridge-editor:connect" || event.ports.length === 0)
          return;
        this._port = event.ports[0];
        this.startListening();
        globalThis.removeEventListener("message", listener);
        await this.trigger("bridge-editor:connected", null);
        resolve();
      };
      globalThis.addEventListener("message", listener);
    });
  }
  connect() {
    const messageChannel = new MessageChannel();
    this._port = messageChannel.port1;
    this.startListening();
    this.target.postMessage("bridge-editor:connect", "*", [
      messageChannel.port2
    ]);
    return new Promise((resolve) => {
      this.on("bridge-editor:connected", () => {
        resolve();
      });
    });
  }
  startListening() {
    this.port.addEventListener("message", async (event) => {
      const { type, origin, uuid, payload } = event.data;
      console.log(event);
      if (type === "response") {
        const onResponse = this.awaitingResponse.get(uuid);
        if (!onResponse)
          throw new Error(`No response handler for ${uuid}`);
        onResponse(event);
        this.awaitingResponse.delete(uuid);
        return;
      }
      const listener = this.listeners.get(type);
      if (!listener)
        return;
      this.respond(uuid, await listener(payload, origin));
    });
  }
  trigger(event, data, responseTimeout) {
    return new Promise((resolve, reject) => {
      const listener = (event2) => {
        const { error, payload } = event2.data;
        if (error) {
          reject(error);
          return;
        }
        if (timeout)
          clearTimeout(timeout);
        resolve(payload);
      };
      const timeout = responseTimeout ? setTimeout(() => {
        this.awaitingResponse.delete(triggerId);
      }, responseTimeout) : null;
      const triggerId = crypto.randomUUID();
      this.awaitingResponse.set(triggerId, listener);
      this.simpleTrigger(event, data, triggerId);
    });
  }
  simpleTrigger(event, data, triggerId = crypto.randomUUID()) {
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
    if (this.listeners.has(eventName))
      throw new Error(`Event handler for event "${eventName}" already exists`);
    this.listeners.set(eventName, callback);
    return {
      dispose: () => {
        this.listeners.delete(eventName);
      }
    };
  }
  respond(uuid, payload) {
    this.port.postMessage({
      type: "response",
      uuid,
      origin: window.origin,
      payload
    });
  }
}
export { Channel };
