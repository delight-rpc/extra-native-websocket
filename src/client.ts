import * as DelightRPC from 'delight-rpc'
import { isUndefined } from '@blackglory/prelude'
import { Deferred } from 'extra-promise'
import { CustomError } from '@blackglory/errors'
import { getResult } from 'return-style'
import { IResponse, IError, IBatchResponse } from '@delight-rpc/protocol'
import { ExtraNativeWebSocket } from 'extra-native-websocket'
import { withAbortSignal, timeoutSignal } from 'extra-abort'

export function createClient<IAPI extends object>(
  socket: ExtraNativeWebSocket
, { parameterValidators, expectedVersion, channel, timeout }: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    expectedVersion?: `${number}.${number}.${number}`
    channel?: string
    timeout?: number
  } = {}
): [client: DelightRPC.ClientProxy<IAPI>, close: () => void] {
  const pendings: { [id: string]: Deferred<IResponse<unknown>> } = {}

  const removeMessageListener = socket.on('message', listener)

  const client = DelightRPC.createClient<IAPI>(
    async function send(request) {
      const res = new Deferred<IResponse<unknown>>()
      pendings[request.id] = res
      try {
        socket.send(JSON.stringify(request))
        if (isUndefined(timeout)) {
          return await res
        } else {
          return await withAbortSignal(timeoutSignal(timeout), () => res)
        }
      } finally {
        delete pendings[request.id]
      }
    }
  , {
      parameterValidators
    , expectedVersion
    , channel
    }
  )

  return [client, close]

  function close(): void {
    removeMessageListener()

    for (const [key, deferred] of Object.entries(pendings)) {
      deferred.reject(new ClientClosed())
      delete pendings[key]
    }
  }

  function listener(event: MessageEvent): void {
    const res = getResult(() => JSON.parse(event.data))
    if (DelightRPC.isResult(res) || DelightRPC.isError(res)) {
      pendings[res.id].resolve(res)
    }
  }
}

export function createBatchClient(
  socket: ExtraNativeWebSocket
, { expectedVersion, channel, timeout }: {
    expectedVersion?: `${number}.${number}.${number}`
    channel?: string
    timeout?: number
  } = {}
): [client: DelightRPC.BatchClient, close: () => void] {
  const pendings: {
    [id: string]: Deferred<
    | IError
    | IBatchResponse<unknown>
    >
  } = {}

  const removeMessageListener = socket.on('message', listener)

  const client = new DelightRPC.BatchClient(
    async function send(request) {
      const res = new Deferred<
      | IError
      | IBatchResponse<unknown>
      >()
      pendings[request.id] = res
      try {
        socket.send(JSON.stringify(request))
        if (isUndefined(timeout)) {
          return await res
        } else {
          return await withAbortSignal(timeoutSignal(timeout), () => res)
        }
      } finally {
        delete pendings[request.id]
      }
    }
  , {
      expectedVersion
    , channel
    }
  )

  return [client, close]

  function close(): void {
    removeMessageListener()

    for (const [key, deferred] of Object.entries(pendings)) {
      deferred.reject(new ClientClosed())
      delete pendings[key]
    }
  }

  function listener(event: MessageEvent): void {
    const res = getResult(() => JSON.parse(event.data))
    if (DelightRPC.isError(res) || DelightRPC.isBatchResponse(res)) {
      pendings[res.id].resolve(res)
    }
  }
}

export class ClientClosed extends CustomError {}
