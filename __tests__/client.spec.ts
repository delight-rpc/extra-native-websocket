import { createClient } from '@src/client'
import { getErrorPromise } from 'return-style'
import { Server, WebSocketServer } from 'ws'
import * as DelightRPCWebSocket from '@delight-rpc/websocket'
import { ExtraNativeWebSocket } from 'extra-native-websocket'

interface IAPI {
  echo(message: string): string
  error(message: string): never
}

const SERVER_URL = 'ws://localhost:8080'

let server: WebSocketServer
beforeEach(() => {
  server = new Server({ port: 8080 })
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
afterEach(() => {
  server.close()
})

describe('createClient', () => {
  test('echo', async () => {
    const wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
    await wsClient.connect()

    const [client] = createClient<IAPI>(wsClient)
    const result = await client.echo('hello')

    expect(result).toBe('hello')
  })

  test('error', async () => {
    const wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
    await wsClient.connect()

    const [client] = createClient<IAPI>(wsClient)
    const err = await getErrorPromise(client.error('hello'))

    expect(err).toBeInstanceOf(Error)
    expect(err!.message).toMatch('hello')
  })
})
