import { WebSocketServer } from 'ws'
import { createServer } from '@src/server.js'
import { createClient } from '@src/client.js'
import { getErrorPromise } from 'return-style'
import * as DelightRPCWebSocket from '@delight-rpc/websocket'
import { ExtraNativeWebSocket } from 'extra-native-websocket'
import { delay, promisify } from 'extra-promise'
import { javascript } from 'extra-tags'
import { assert } from '@blackglory/errors'
import { AbortError } from 'extra-abort'

interface IAPI {
  eval(code: string): Promise<unknown>
}

const SERVER_URL = 'ws://localhost:8080'

const api = {
  echo(message: string): string {
    return message
  }
, error(message: string): never {
    throw new Error(message)
  }
, async loop(signal?: AbortSignal): Promise<never> {
    assert(signal)

    while (!signal.aborted) {
      await delay(100)
    }

    throw signal.reason
  }
}

let server: WebSocketServer
beforeEach(() => {
  server = new WebSocketServer({ port: 8080 })
  server.on('connection', socket => {
    const [client] = DelightRPCWebSocket.createClient(socket)
    const cancelServer = DelightRPCWebSocket.createServer<IAPI>({
      async eval(code) {
        return await eval(code)
      }
    }, socket)
  })
})
afterEach(async () => {
  await promisify(server.close.bind(server))()
})

describe('createServer', () => {
  test('result', async () => {
    const wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
    await wsClient.connect()

    const cancelServer = createServer(api, wsClient)
    const [client, close] = createClient<IAPI>(wsClient)
    try {
      const result = await client.eval(javascript`
        client.echo('hello')
      `)

      expect(result).toBe('hello')
    } finally {
      await wsClient.close()
      cancelServer()
    }
  })

  test('error', async () => {
    const wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
    await wsClient.connect()

    const cancelServer = createServer(api, wsClient)
    const [client, close] = createClient<IAPI>(wsClient)
    try {
      const err = await getErrorPromise(client.eval(javascript`
        client.error('hello')
      `))

      expect(err).toBeInstanceOf(Error)
      expect(err!.message).toMatch('hello')
    } finally {
      await wsClient.close()
      cancelServer()
    }
  })

  test('abort', async () => {
    const wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
    await wsClient.connect()

    const cancelServer = createServer(api, wsClient)
    const [client, close] = createClient<IAPI>(wsClient)
    try {
      const err = await getErrorPromise(client.eval(javascript`
        const controller = new AbortController()
        const promise = client.loop(controller.signal)
        controller.abort()
        promise
      `))

      expect(err).toBeInstanceOf(AbortError)
    } finally {
      await wsClient.close()
      cancelServer()
    }
  })
})
