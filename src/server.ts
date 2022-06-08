import * as DelightRPC from 'delight-rpc'
import { getResult } from 'return-style'
import { isntNull } from '@blackglory/prelude'
import { ExtraNativeWebSocket } from 'extra-native-websocket'

export function createServer<IAPI extends object>(
  api: DelightRPC.ImplementationOf<IAPI>
, socket: ExtraNativeWebSocket
, { parameterValidators, version, channel, ownPropsOnly }: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    version?: `${number}.${number}.${number}`
    channel?: string
    ownPropsOnly?: boolean
  } = {}
): () => void {
  const removeMessageListener = socket.on('message', listener)
  return () => removeMessageListener()

  async function listener(event: MessageEvent): Promise<void> {
    const request = getResult(() => JSON.parse(event.data))
    if (DelightRPC.isRequest(request) || DelightRPC.isBatchRequest(request)) {
      const response = await DelightRPC.createResponse(
        api
      , request
      , {
          parameterValidators
        , version
        , channel
        , ownPropsOnly
        }
      )

      if (isntNull(response)) {
        socket.send(JSON.stringify(response))
      }
    }
  }
}
