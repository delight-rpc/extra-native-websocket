import * as DelightRPC from 'delight-rpc'
import { isntUndefined } from '@blackglory/prelude'
import { Deferred } from 'extra-promise'
import { CustomError } from '@blackglory/errors'
import { getResult } from 'return-style'
import { IResponse, IError, IBatchResponse } from '@delight-rpc/protocol'
import { ExtraNativeWebSocket } from 'extra-native-websocket'
import { withAbortSignal, raceAbortSignals, timeoutSignal } from 'extra-abort'
import { SyncDestructor } from 'extra-defer'

export function createClient<IAPI extends object>(
  socket: ExtraNativeWebSocket
, { parameterValidators, expectedVersion, channel, timeout }: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    expectedVersion?: string
    channel?: string
    timeout?: number
  } = {}
): [client: DelightRPC.ClientProxy<IAPI>, close: () => void] {
  const destructor = new SyncDestructor()

  const pendings: Map<string, Deferred<IResponse<unknown>>> = new Map()
  destructor.defer(abortAllPendings)

  const removeMessageListener = socket.on('message', receive)
  destructor.defer(removeMessageListener)

  // ExtraNativeWebSocket有重连的可能性, 因此调用abortAllPendings而不是close.
  const removeCloseListener = socket.on('close', abortAllPendings)
  destructor.defer(removeCloseListener)

  const client = DelightRPC.createClient<IAPI>(
    async function send(request, signal) {
      const destructor = new SyncDestructor()

      const res = new Deferred<IResponse<unknown>>()
      pendings.set(request.id, res)
      destructor.defer(() => pendings.delete(request.id))

      try {
        socket.send(JSON.stringify(request))

        const mergedSignal = raceAbortSignals([
          isntUndefined(timeout) && timeoutSignal(timeout)
        , signal
        ])
        mergedSignal.addEventListener('abort', sendAbort)
        destructor.defer(() => mergedSignal.removeEventListener('abort', sendAbort))

        return await withAbortSignal(mergedSignal, () => res)
      } finally {
        destructor.execute()
      }

      function sendAbort(): void {
        const abort = DelightRPC.createAbort(request.id, channel)
        socket.send(JSON.stringify(abort))
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
    destructor.execute()
  }

  function abortAllPendings(): void {
    const err = new ClientClosed()

    for (const deferred of pendings.values()) {
      deferred.reject(err)
    }

    pendings.clear()
  }

  function receive(event: MessageEvent): void {
    const res = getResult(() => JSON.parse(event.data))
    if (DelightRPC.isResult(res) || DelightRPC.isError(res)) {
      pendings.get(res.id)?.resolve(res)
    }
  }
}

export function createBatchClient(
  socket: ExtraNativeWebSocket
, { expectedVersion, channel, timeout }: {
    expectedVersion?: string
    channel?: string
    timeout?: number
  } = {}
): [client: DelightRPC.BatchClient, close: () => void] {
  const destructor = new SyncDestructor()

  const pendings: Map<string, Deferred<IError | IBatchResponse<unknown>>> = new Map()
  destructor.defer(abortAllPendings)

  const removeMessageListener = socket.on('message', receive)
  destructor.defer(removeMessageListener)

  // ExtraNativeWebSocket有重连的可能性, 因此调用abortAllPendings而不是close.
  const removeCloseListener = socket.on('close', abortAllPendings)
  destructor.defer(removeCloseListener)

  const client = new DelightRPC.BatchClient(
    async function send(request) {
      const destructor = new SyncDestructor()

      const res = new Deferred<IError | IBatchResponse<unknown>>()
      pendings.set(request.id, res)
      destructor.defer(() => pendings.delete(request.id))

      try {
        socket.send(JSON.stringify(request))

        const mergedSignal = raceAbortSignals([
          isntUndefined(timeout) && timeoutSignal(timeout)
        ])
        mergedSignal.addEventListener('abort', sendAbort)

        return await withAbortSignal(mergedSignal, () => res)
      } finally {
        destructor.execute()
      }

      function sendAbort(): void {
        const abort = DelightRPC.createAbort(request.id, channel)
        socket.send(JSON.stringify(abort))
      }
    }
  , {
      expectedVersion
    , channel
    }
  )

  return [client, close]

  function close(): void {
    destructor.execute()
  }

  function abortAllPendings(): void {
    const err = new ClientClosed()

    for (const deferred of pendings.values()) {
      deferred.reject(err)
    }

    pendings.clear()
  }

  function receive(event: MessageEvent): void {
    const res = getResult(() => JSON.parse(event.data))
    if (DelightRPC.isError(res) || DelightRPC.isBatchResponse(res)) {
      pendings.get(res.id)?.resolve(res)
    }
  }
}

export class ClientClosed extends CustomError {}
