import * as DelightRPC from 'delight-rpc'
import { getResult } from 'return-style'
import { isntNull } from '@blackglory/prelude'
import { ExtraNativeWebSocket } from 'extra-native-websocket'
import { AbortController } from 'extra-abort'

export function createServer<IAPI extends object>(
  api: DelightRPC.ImplementationOf<IAPI>
, socket: ExtraNativeWebSocket
, { parameterValidators, version, channel, ownPropsOnly }: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    version?: `${number}.${number}.${number}`
    channel?: string | RegExp | typeof DelightRPC.AnyChannel
    ownPropsOnly?: boolean
  } = {}
): () => void {
  const idToController: Map<string, AbortController> = new Map()

  const removeMessageListener = socket.on('message', listener)
  socket.on('close', () => {
    for (const controller of idToController.values()) {
      controller.abort()
    }

    idToController.clear()
  })
  return () => removeMessageListener()

  async function listener(event: MessageEvent): Promise<void> {
    const message = getResult(() => JSON.parse(event.data))
    if (DelightRPC.isRequest(message) || DelightRPC.isBatchRequest(message)) {
      const controller = new AbortController()
      idToController.set(message.id, controller)

      try {
        const response = await DelightRPC.createResponse(
          api
        , message
        , {
            parameterValidators
          , version
          , channel
          , ownPropsOnly
          , signal: controller.signal
          }
        )

        if (isntNull(response)) {
          socket.send(JSON.stringify(response))
        }
      } finally {
        idToController.delete(message.id)
      }
    } else if (DelightRPC.isAbort(message)) {
      if (DelightRPC.matchChannel(message, channel)) {
        idToController.get(message.id)?.abort()
        idToController.delete(message.id)
      }
    }
  }
}
