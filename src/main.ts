interface ITriggerEventData {
	type: string
	noResponse?: boolean
	error?: string
	uuid: string
	origin: string
	payload: any
}

export class Channel {
	protected target: Window
	protected _port?: MessagePort
	protected listeners = new Map<
		string,
		(data: any, origin: string) => Promise<any> | any
	>()
	protected awaitingResponse = new Map<
		string,
		(payload: any, error?: string) => void
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
		this.port.addEventListener('message', async (event) => {
			const { type, noResponse, origin, uuid, error, payload } = <
				ITriggerEventData
			>event.data

			if (type === 'response') {
				const onResponse = this.awaitingResponse.get(uuid)
				if (!onResponse) {
					console.error(`No response handler for ${uuid}`)
					return
				}

				onResponse(payload, error)
				this.awaitingResponse.delete(uuid)
				return
			}

			const listener = this.listeners.get(type)
			if (!listener) return

			let respPayload = null
			let err = undefined
			try {
				respPayload = await listener(payload, origin)
			} catch (err: any) {
				err = typeof err === 'string' ? err : err.message
			}

			if (!noResponse) this.respond(uuid, respPayload, error)
		})
		this.port.start()
	}
	protected respond(uuid: string, payload: any, error?: string) {
		this.port.postMessage(<ITriggerEventData>{
			type: 'response',
			uuid,
			origin: window.origin,
			error,
			payload,
		})
	}

	trigger<ResponseData = any, TriggerData = any>(
		event: string,
		data: TriggerData,
		responseTimeout?: number
	) {
		return new Promise<ResponseData>((resolve, reject) => {
			const listener = (payload: any, error?: string) => {
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
						reject(new Error('Response timed out'))
				  }, responseTimeout)
				: null

			const triggerId = crypto.randomUUID()
			this.awaitingResponse.set(triggerId, listener)

			this._simpleTrigger<TriggerData>(event, data, triggerId)
		})
	}

	protected _simpleTrigger<T = any>(
		event: string,
		data: T,
		triggerId = crypto.randomUUID(),
		noResponse?: true
	) {
		this.port.postMessage(<ITriggerEventData>{
			type: event,
			noResponse,
			uuid: triggerId,
			origin: window.origin,
			payload: data,
		})
	}

	simpleTrigger<T = any>(event: string, data: T) {
		this._simpleTrigger(event, data, undefined, true)
	}

	on<Data = any, Response = void>(
		eventName: string,
		callback: (data: Data, origin: string) => Response | Promise<Response>
	) {
		if (eventName === 'response') {
			throw new Error(
				`The "response" event type is reserved for internal use.`
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
}
