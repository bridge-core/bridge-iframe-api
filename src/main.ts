interface ITriggerEventData {
	type: string
	uuid: string
	origin: string
	payload: any
}

export function trigger<ResponseData = any, TriggerData = any>(
	event: string,
	data: TriggerData,
	target = window.top
) {
	const triggerId = simpleTrigger<TriggerData>(event, data, target)

	return new Promise<ResponseData>((resolve, reject) => {
		const listener = (event: MessageEvent) => {
			const { type, uuid, error, payload } = event.data
			if (type !== 'response' || uuid !== triggerId) return

			if (error) {
				reject(error)
				return
			}

			globalThis.removeEventListener('message', listener)
			resolve(payload)
		}

		globalThis.addEventListener('message', listener)
	})
}

export function simpleTrigger<T = any>(
	event: string,
	data: T,
	target = window.top
) {
	if (!target) throw new Error('A trigger target is required')

	const triggerId = crypto.randomUUID()
	target.postMessage(
		<ITriggerEventData>{
			type: event,
			uuid: triggerId,
			origin: window.origin,
			payload: data,
		},
		'*'
	)

	return triggerId
}

export function on<T = any>(
	eventName: string,
	callback: (
		data: T,
		origin: string,
		response: <T = any>(payload: T) => void
	) => void,
	receiver = window.top
) {
	if (eventName === 'response') {
		throw new Error(`The response event type is reserved for internal use.`)
	}

	const listener = (event: MessageEvent) => {
		const { type, origin, uuid, payload } = <ITriggerEventData>event.data

		if (type === eventName) {
			callback(payload, origin, createResponseFunction(uuid, receiver))
		}
	}

	globalThis.addEventListener('message', listener)

	return {
		dispose: () => {
			globalThis.removeEventListener('message', listener)
		},
	}
}

function createResponseFunction(uuid: string, target = window.top) {
	if (!target) throw new Error('A response target is required')

	return (payload: any) => {
		target.postMessage(
			<ITriggerEventData>{
				type: 'response',
				uuid,
				origin: window.origin,
				payload,
			},
			'*'
		)
	}
}

on('openWithFile', (data, origin, response) => {
	response(data)
})
