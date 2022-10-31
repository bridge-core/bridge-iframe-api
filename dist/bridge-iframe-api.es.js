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
      this.target.postMessage("bridge-editor:connection-request", "*");
    });
  }
  connect() {
    const messageChannel = new MessageChannel();
    this._port = messageChannel.port1;
    this.startListening();
    const listener = (event) => {
      if (event.data !== "bridge-editor:connection-request")
        return;
      this.target.postMessage("bridge-editor:connect", "*", [
        messageChannel.port2
      ]);
      globalThis.removeEventListener("message", listener);
    };
    globalThis.addEventListener("message", listener);
    return new Promise((resolve) => {
      this.on("bridge-editor:connected", () => {
        resolve();
      });
    });
  }
  startListening() {
    this.port.addEventListener("message", async (event) => {
      const { type, noResponse, origin, uuid, error, payload } = event.data;
      if (type === "response") {
        const onResponse = this.awaitingResponse.get(uuid);
        if (!onResponse) {
          console.error(`No response handler for ${uuid}`);
          return;
        }
        onResponse(payload, error);
        this.awaitingResponse.delete(uuid);
        return;
      }
      const listener = this.listeners.get(type);
      if (!listener)
        return;
      let respPayload = null;
      let err = void 0;
      try {
        respPayload = await listener(payload, origin);
      } catch (currentErr) {
        err = typeof currentErr === "string" ? currentErr : currentErr.message;
      }
      if (!noResponse)
        this.respond(uuid, respPayload, err);
    });
    this.port.start();
  }
  respond(uuid, payload, error) {
    this.port.postMessage({
      type: "response",
      uuid,
      origin: window.origin,
      error,
      payload
    });
  }
  trigger(event, data, responseTimeout) {
    return new Promise((resolve, reject) => {
      const listener = (payload, error) => {
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
        reject(new Error("Response timed out"));
      }, responseTimeout) : null;
      const triggerId = crypto.randomUUID();
      this.awaitingResponse.set(triggerId, listener);
      this._simpleTrigger(event, data, triggerId);
    });
  }
  _simpleTrigger(event, data, triggerId = crypto.randomUUID(), noResponse) {
    this.port.postMessage({
      type: event,
      noResponse,
      uuid: triggerId,
      origin: window.origin,
      payload: data
    });
  }
  simpleTrigger(event, data) {
    this._simpleTrigger(event, data, void 0, true);
  }
  on(eventName, callback) {
    if (eventName === "response") {
      throw new Error(`The "response" event type is reserved for internal use.`);
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
}
export { Channel };
