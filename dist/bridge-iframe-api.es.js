function trigger(event, data, target = window.top) {
  if (!target)
    throw new Error("A trigger target is required");
  const triggerId = crypto.randomUUID();
  target.postMessage({
    type: event,
    uuid: triggerId,
    origin: window.origin,
    payload: data
  });
  return new Promise((resolve, reject) => {
    const listener = (event2) => {
      const { type, uuid, error, payload } = event2.data;
      if (type !== "response" || uuid !== triggerId)
        return;
      if (error) {
        reject(error);
        return;
      }
      globalThis.removeEventListener("message", listener);
      resolve(payload);
    };
    globalThis.addEventListener("message", listener);
  });
}
function on(eventName, callback, receiver = window.top) {
  if (eventName === "response") {
    throw new Error(`The response event type is reserved for internal use.`);
  }
  globalThis.addEventListener("message", (event) => {
    const { type, origin, uuid, payload } = event.data;
    if (type === eventName) {
      callback(payload, origin, createResponseFunction(uuid, receiver));
    }
  });
}
function createResponseFunction(uuid, target = window.top) {
  if (!target)
    throw new Error("A response target is required");
  return (payload) => {
    target.postMessage({
      type: "response",
      uuid,
      origin: window.origin,
      payload
    });
  };
}
on("openWithFile", (data, origin, response) => {
  response(data);
});
export { on, trigger };
