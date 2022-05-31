import { Server, WebSocketServer } from 'ws'
import { createServer } from '@src/server'
import { createClient } from '@src/client'
import { getErrorPromise } from 'return-style'
import * as DelightRPCWebSocket from '@delight-rpc/websocket'
import { ExtraNativeWebSocket } from 'extra-native-websocket'

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
}

let server: WebSocketServer
beforeEach(() => {
  server = new Server({ port: 8080 })
  server.on('connection', socket => {
    const [client] = DelightRPCWebSocket.createClient(socket)
    const cancelServer = DelightRPCWebSocket.createServer<IAPI>({
      async eval(code) {
        return await eval(code)
      }
    }, socket)
  })
})
afterEach(() => {
  server.close()
})

describe('createServer', () => {
  test('echo', async () => {
    const wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
    await wsClient.connect()

    const cancelServer = createServer(api, wsClient)
    const [client, close] = createClient<IAPI>(wsClient)
    try {
      const result = await client.eval('client.echo("hello")')

      expect(result).toBe('hello')
    } finally {
      cancelServer()
    }
  })

  test('error', async () => {
    const wsClient = new ExtraNativeWebSocket(() => new WebSocket(SERVER_URL))
    await wsClient.connect()

    const cancelServer = createServer(api, wsClient)
    const [client, close] = createClient<IAPI>(wsClient)
    try {
      const err = await getErrorPromise(client.eval('client.error("hello")'))

      expect(err).toBeInstanceOf(Error)
      expect(err!.message).toMatch('hello')
    } finally {
      cancelServer()
    }
  })
})
