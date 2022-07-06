interface ITriggerEventData {
	type: string
	channelId?: string
	error?: string
	uuid: string
	origin: string
	payload: any
}

export class Channel {
	protected target: Window
	protected _port?: MessagePort
	protected listeners = new Map<string, (data: any, origin: string) => any>()
	protected awaitingResponse = new Map<
		string,
		(event: MessageEvent) => void
	>()

	constructor(target = window.top) {
		if (!target)
			throw new Error(
				'You must provide a valid target in order to create a channel'
			)

		this.target = target
	}

	protected get port() {
		if (!this._port)
			throw new Error(
				'You must open the channel/connect to a channel before triggering events'
			)
		return this._port
	}

	open() {
		return new Promise<void>((resolve) => {
			const listener = async (event: MessageEvent) => {
				if (
					event.data !== 'bridge-editor:connect' ||
					event.ports.length === 0
				)
					return

				this._port = event.ports[0]
				this.startListening()
				globalThis.removeEventListener('message', listener)

				await this.trigger<void, null>('bridge-editor:connected', null)
				resolve()
			}

			globalThis.addEventListener('message', listener)
		})
	}

	connect() {
		const messageChannel = new MessageChannel()
		this._port = messageChannel.port1

		this.startListening()

		// Post port2 to the target window
		this.target.postMessage('bridge-editor:connect', '*', [
			messageChannel.port2,
		])

		return new Promise<void>((resolve) => {
			this.on('bridge-editor:connected', () => {
				resolve()
			})
		})
	}

	protected startListening() {
		this.port.addEventListener('message', (event) => {
			const { type, origin, uuid, payload } = <ITriggerEventData>(
				event.data
			)

			if (type === 'response') {
				const response = this.awaitingResponse.get(uuid)
				if (!response)
					throw new Error(`No response handler for ${uuid}`)

				response(event)
				this.awaitingResponse.delete(uuid)
				return
			}

			const listener = this.listeners.get(type)
			if (!listener) return

			this.respond(uuid, listener(payload, origin))
		})
	}

	trigger<ResponseData = any, TriggerData = any>(
		event: string,
		data: TriggerData,
		responseTimeout?: number
	) {
		const triggerId = this.simpleTrigger<TriggerData>(event, data)

		return new Promise<ResponseData>((resolve, reject) => {
			const listener = (event: MessageEvent) => {
				const { error, payload } = <ITriggerEventData>event.data

				if (error) {
					reject(error)
					return
				}

				if (timeout) clearTimeout(timeout)
				resolve(payload)
			}

			const timeout = responseTimeout
				? setTimeout(() => {
						this.awaitingResponse.delete(triggerId)
				  }, responseTimeout)
				: null

			this.awaitingResponse.set(triggerId, listener)
		})
	}

	simpleTrigger<T = any>(event: string, data: T) {
		const triggerId = crypto.randomUUID()
		this.port.postMessage(<ITriggerEventData>{
			type: event,
			uuid: triggerId,
			origin: window.origin,
			payload: data,
		})

		return triggerId
	}

	on<Data = any, Response = void>(
		eventName: string,
		callback: (data: Data, origin: string) => Response
	) {
		if (eventName === 'response') {
			throw new Error(
				`The response event type is reserved for internal use.`
			)
		}

		if (this.listeners.has(eventName))
			throw new Error(
				`Event handler for event "${eventName}" already exists`
			)
		this.listeners.set(eventName, callback)

		return {
			dispose: () => {
				this.listeners.delete(eventName)
			},
		}
	}

	protected respond(uuid: string, payload: any) {
		this.port.postMessage(<ITriggerEventData>{
			type: 'response',
			uuid,
			origin: window.origin,
			payload,
		})
	}
}
