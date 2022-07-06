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
		const messageChannel = new MessageChannel()
		this._port = messageChannel.port1

		// Post port2 to the target window
		this.target.postMessage('open-channel', '*', [messageChannel.port2])
	}

	async connect() {
		const listener = (event: MessageEvent) => {
			if (event.data === 'open-channel' && event.ports.length > 0)
				this._port = event.ports[0]

			globalThis.removeEventListener('message', listener)
		}

		globalThis.addEventListener('message', listener)
	}

	trigger<ResponseData = any, TriggerData = any>(
		event: string,
		data: TriggerData,
		responseTimeout?: number
	) {
		const triggerId = this.simpleTrigger<TriggerData>(event, data)

		return new Promise<ResponseData>((resolve, reject) => {
			const listener = (event: MessageEvent) => {
				const { type, uuid, channelId, error, payload } = <
					ITriggerEventData
				>event.data
				if (type !== 'response' || uuid !== triggerId) return

				if (error) {
					reject(error)
					return
				}

				if (timeout) clearTimeout(timeout)
				this.port.removeEventListener('message', listener)
				resolve(payload)
			}

			const timeout = responseTimeout
				? setTimeout(() => {
						this.port.removeEventListener('message', listener)
				  }, responseTimeout)
				: null

			this.port.addEventListener('message', listener)
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

	on<T = any>(
		eventName: string,
		callback: (
			data: T,
			origin: string,
			response: <T = any>(payload: T) => void
		) => void
	) {
		if (eventName === 'response') {
			throw new Error(
				`The response event type is reserved for internal use.`
			)
		}

		const listener = (event: MessageEvent) => {
			const { type, origin, uuid, payload } = <ITriggerEventData>(
				event.data
			)

			if (type !== eventName) return

			callback(payload, origin, this.createResponseFunction(uuid))
		}

		this.port.addEventListener('message', listener)

		return {
			dispose: () => {
				this.port.removeEventListener('message', listener)
			},
		}
	}

	protected createResponseFunction(uuid: string) {
		return (payload: any) => {
			this.port.postMessage(<ITriggerEventData>{
				type: 'response',
				uuid,
				origin: window.origin,
				payload,
			})
		}
	}
}
