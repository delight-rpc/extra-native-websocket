import * as DelightRPC from 'delight-rpc'
import { getResult } from 'return-style'
import { isntNull } from '@blackglory/prelude'
import { ExtraNativeWebSocket } from 'extra-native-websocket'
import { AbortController } from 'extra-abort'
import { HashMap } from '@blackglory/structures'

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
  const channelIdToController: HashMap<
    {
      channel?: string
    , id: string
    }
  , AbortController
  > = new HashMap(({ channel, id }) => JSON.stringify([channel, id]))

  const removeMessageListener = socket.on('message', listener)
  socket.on('close', () => {
    for (const controller of channelIdToController.values()) {
      controller.abort()
    }

    channelIdToController.clear()
  })
  return () => removeMessageListener()

  async function listener(event: MessageEvent): Promise<void> {
    const message = getResult(() => JSON.parse(event.data))
    if (DelightRPC.isRequest(message) || DelightRPC.isBatchRequest(message)) {
      const controller = new AbortController()
      channelIdToController.set(message, controller)

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
        channelIdToController.delete(message)
      }
    } else if (DelightRPC.isAbort(message)) {
      if (DelightRPC.matchChannel(message, channel)) {
        channelIdToController.get(message)?.abort()
        channelIdToController.delete(message)
      }
    }
  }
}
