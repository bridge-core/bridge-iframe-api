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
	protected channelId?: string

	constructor(target = window.top) {
		if (!target)
			throw new Error(
				'You must provide a valid target in order to create a channel'
			)

		this.target = target
	}

	matchesChannel(id?: string) {
		// id is undefined, so we match all channels
		if (id === undefined) return true

		// If we have a channelId, force it to match
		if (this.channelId) return this.channelId === id

		// If we don't have a channelId, but the message has one, we don't match
		return false
	}

	async open(responseTimeout = 3000) {
		const channelId = await this.trigger<string, null>(
			'connect',
			null,
			responseTimeout
		)
		this.channelId = channelId
	}

	connect() {
		this.on('connect', (data, origin, response) => {
			if (this.channelId) return

			this.channelId = crypto.randomUUID()
			response(this.channelId)
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
				const { type, uuid, channelId, error, payload } = <
					ITriggerEventData
				>event.data
				if (
					type !== 'response' ||
					!this.matchesChannel(channelId) ||
					uuid !== triggerId
				)
					return

				if (error) {
					reject(error)
					return
				}

				if (timeout) clearTimeout(timeout)
				globalThis.removeEventListener('message', listener)
				resolve(payload)
			}

			const timeout = responseTimeout
				? setTimeout(() => {
						globalThis.removeEventListener('message', listener)
				  }, responseTimeout)
				: null

			globalThis.addEventListener('message', listener)
		})
	}

	simpleTrigger<T = any>(event: string, data: T) {
		const triggerId = crypto.randomUUID()
		this.target.postMessage(
			<ITriggerEventData>{
				type: event,
				channelId: this.channelId,
				uuid: triggerId,
				origin: window.origin,
				payload: data,
			},
			'*'
		)

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
			const { type, channelId, origin, uuid, payload } = <
				ITriggerEventData
			>event.data

			if (type !== eventName || !this.matchesChannel(channelId)) return

			callback(payload, origin, this.createResponseFunction(uuid))
		}

		globalThis.addEventListener('message', listener)

		return {
			dispose: () => {
				globalThis.removeEventListener('message', listener)
			},
		}
	}

	protected createResponseFunction(uuid: string) {
		return (payload: any) => {
			this.target.postMessage(
				<ITriggerEventData>{
					type: 'response',
					channelId: this.channelId,
					uuid,
					origin: window.origin,
					payload,
				},
				'*'
			)
		}
	}
}
