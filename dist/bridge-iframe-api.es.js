class Channel {
  constructor(target = window.top) {
    if (!target)
      throw new Error("You must provide a valid target in order to create a channel");
    this.target = target;
  }
  matchesChannel(id) {
    if (id === void 0)
      return true;
    if (this.channelId)
      return this.channelId === id;
    return false;
  }
  open(responseTimeout = 3e3) {
    if (this.channelId)
      return;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Channel target did not respond"));
      }, responseTimeout);
      const disposable = this.on("connect", (data, origin, response) => {
        if (this.channelId)
          throw new Error(`Invalid state: Channel is already open but still listens for connect events`);
        clearTimeout(timeout);
        disposable.dispose();
        this.channelId = crypto.randomUUID();
        response(this.channelId);
        resolve();
      });
    });
  }
  async connect() {
    if (this.channelId)
      return;
    const channelId = await this.trigger("connect", null);
    this.channelId = channelId;
  }
  trigger(event, data, responseTimeout) {
    const triggerId = this.simpleTrigger(event, data);
    return new Promise((resolve, reject) => {
      const listener = (event2) => {
        const { type, uuid, channelId, error, payload } = event2.data;
        if (type !== "response" || !this.matchesChannel(channelId) || uuid !== triggerId)
          return;
        if (error) {
          reject(error);
          return;
        }
        if (timeout)
          clearTimeout(timeout);
        globalThis.removeEventListener("message", listener);
        resolve(payload);
      };
      const timeout = responseTimeout ? setTimeout(() => {
        globalThis.removeEventListener("message", listener);
      }, responseTimeout) : null;
      globalThis.addEventListener("message", listener);
    });
  }
  simpleTrigger(event, data) {
    const triggerId = crypto.randomUUID();
    this.target.postMessage({
      type: event,
      channelId: this.channelId,
      uuid: triggerId,
      origin: window.origin,
      payload: data
    }, "*");
    return triggerId;
  }
  on(eventName, callback) {
    if (eventName === "response") {
      throw new Error(`The response event type is reserved for internal use.`);
    }
    const listener = (event) => {
      const { type, channelId, origin, uuid, payload } = event.data;
      if (type !== eventName || !this.matchesChannel(channelId))
        return;
      callback(payload, origin, this.createResponseFunction(uuid));
    };
    globalThis.addEventListener("message", listener);
    return {
      dispose: () => {
        globalThis.removeEventListener("message", listener);
      }
    };
  }
  createResponseFunction(uuid) {
    return (payload) => {
      this.target.postMessage({
        type: "response",
        channelId: this.channelId,
        uuid,
        origin: window.origin,
        payload
      }, "*");
    };
  }
}
export { Channel };
