import { createBatchClient, createClient } from '@src/client.js'
import { getErrorPromise } from 'return-style'
import { WebSocketServer } from 'ws'
import * as DelightRPCWebSocket from '@delight-rpc/websocket'
import { ExtraNativeWebSocket } from 'extra-native-websocket'
import { delay, promisify } from 'extra-promise'
import { createBatchProxy } from 'delight-rpc'
import { AbortController, AbortError } from 'extra-abort'
import { assert } from '@blackglory/errors'

interface IAPI {
  echo(message: string): string
  error(message: string): never
  loop(): never
}

const SERVER_URL = 'ws://localhost:8080'

let server: WebSocketServer
let wsClient: ExtraNativeWebSocket
beforeEach(async () => {
  server = new WebSocketServer({ port: 8080 })
  server.on('connection', socket => {
    const cancelServer = DelightRPCWebSocket.createServer<IAPI>({
      echo(message) {
        return message
      }
    , error(message) {
        throw new Error(message)
      }
    , async loop(signal) {
        assert(signal)

        while (!signal.aborted) {
          await delay(100)
        }

        throw signal.reason
      }
    }, socket)
  })

  wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
  await wsClient.connect()
})
afterEach(async () => {
  await wsClient.close()

  await promisify(server.close.bind(server))()
})

describe('createClient', () => {
  test('result', async () => {
    const [client] = createClient<IAPI>(wsClient)
    const result = await client.echo('hello')

    expect(result).toBe('hello')
  })
  
  test('result (batch)', async () => {
    const [client, close] = createBatchClient(wsClient)
    const proxy = createBatchProxy<IAPI>()

    const result = await client.parallel(proxy.echo('hello'))
    close()

    expect(result.length).toBe(1)
    expect(result[0].unwrap()).toBe('hello')
  })

  test('error', async () => {
    const [client] = createClient<IAPI>(wsClient)

    const err = await getErrorPromise(client.error('hello'))

    expect(err).toBeInstanceOf(Error)
    expect(err!.message).toMatch('hello')
  })

  test('error (batch)', async () => {
    const [client, close] = createBatchClient(wsClient)
    const proxy = createBatchProxy<IAPI>()

    const result = await client.parallel(proxy.error('hello'))
    close()

    expect(result.length).toBe(1)
    const err = result[0].unwrapErr()
    expect(err).toBeInstanceOf(Error)
    expect(err!.message).toMatch('hello')
  })

  test('abort', async () => {
    const [client] = createClient<IAPI>(wsClient)
    const controller = new AbortController()

    const promise = getErrorPromise(client.loop(controller.signal))
    controller.abort()
    const err = await promise

    expect(err).toBeInstanceOf(AbortError)
  })
})
