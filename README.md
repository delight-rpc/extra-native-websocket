# @delight-rpc/extra-native-websocket
## Install
```sh
npm install --save @delight-rpc/extra-native-websocket
# or
yarn add @delight-rpc/extra-native-websocket
```

## API
### createClient
```ts
function createClient<IAPI extends object>(
  socket: ExtraNativeWebSocket
, options?: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    expectedVersion?: string
    channel?: string
    timeout?: number
  }
): [client: DelightRPC.ClientProxy<IAPI>, close: () => void]
```

### createBatchClient
```ts
function createBatchClient(
  socket: ExtraNativeWebSocket
, options?: {
    expectedVersion?: string
    channel?: string
    timeout?: number
  }
): [client: DelightRPC.BatchClient, close: () => void]
```

### createServer
```ts
function createServer<IAPI extends object>(
  api: DelightRPC.ImplementationOf<IAPI>
, socket: ExtraNativeWebSocket
, options?: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    version?: `${number}.${number}.${number}`
    channel?: string | RegExp | AnyChannel
    ownPropsOnly?: boolean
  }
): () => void
```
