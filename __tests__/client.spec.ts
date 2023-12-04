import { createBatchClient, createClient } from '@src/client.js'
import { getErrorPromise } from 'return-style'
import { WebSocketServer } from 'ws'
import * as DelightRPCWebSocket from '@delight-rpc/websocket'
import { ExtraNativeWebSocket } from 'extra-native-websocket'
import { promisify } from 'extra-promise'
import { createBatchProxy } from 'delight-rpc'

interface IAPI {
  echo(message: string): string
  error(message: string): never
}

const SERVER_URL = 'ws://localhost:8080'

let server: WebSocketServer
beforeEach(() => {
  server = new WebSocketServer({ port: 8080 })
  server.on('connection', socket => {
    const cancelServer = DelightRPCWebSocket.createServer<IAPI>({
      echo(message) {
        return message
      }
    , error(message) {
        throw new Error(message)
      }
    }, socket)
  })
})
afterEach(async () => {
  await promisify(server.close.bind(server))()
})

describe('createClient', () => {
  test('echo', async () => {
    const wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
    await wsClient.connect()

    try {
      const [client] = createClient<IAPI>(wsClient)
      const result = await client.echo('hello')

      expect(result).toBe('hello')
    } finally {
      await wsClient.close()
    }
  })
  
  test('echo (batch)', async () => {
    const wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
    await wsClient.connect()

    try {
      const [client, close] = createBatchClient(wsClient)
      const proxy = createBatchProxy<IAPI>()

      const result = await client.parallel(proxy.echo('hello'))
      close()

      expect(result.length).toBe(1)
      expect(result[0].unwrap()).toBe('hello')
    } finally {
      await wsClient.close()
    }
  })

  test('error', async () => {
    const wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
    await wsClient.connect()

    try {
      const [client] = createClient<IAPI>(wsClient)
      const err = await getErrorPromise(client.error('hello'))

      expect(err).toBeInstanceOf(Error)
      expect(err!.message).toMatch('hello')
    } finally {
      await wsClient.close()
    }
  })

  test('error (batch)', async () => {
    const wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
    await wsClient.connect()

    try {
      const [client, close] = createBatchClient(wsClient)
      const proxy = createBatchProxy<IAPI>()

      const result = await client.parallel(proxy.error('hello'))
      close()

      expect(result.length).toBe(1)
      const err = result[0].unwrapErr()
      expect(err).toBeInstanceOf(Error)
      expect(err!.message).toMatch('hello')
    } finally {
      await wsClient.close()
    }
  })
})
