// const cors = require('cors');
const express = require('express');
const ipc = require('@node-ipc/node-ipc').default;

require('dotenv').config();

const GETH_IPC_NAME = 'geth';
const GETH_IPC_PATH = process.env.GETH_IPC_PATH || '/tmp/core-geth_classic.ipc';

const port = process.env.PORT || 3000;
const rpcTimeoutSeconds = 10;

const app = express();

// Enable CORS for all requests
// app.use(cors({ origin: config.corsOrigin }));

// For parsing application/json
app.use(express.json());

ipc.config.id = GETH_IPC_NAME;
ipc.config.retry = 1500;
ipc.config.rawBuffer = true;
ipc.config.silent = true;
ipc.config.sync = true; // Pass single request through IPC and wait for response

ipc.connectTo(GETH_IPC_NAME, GETH_IPC_PATH, () => {
  ipc.of.geth
    .on('connect', function() {
      console.log('Connected to Geth');
    })
    .on('disconnect', function() {
      console.log('Disconnected from Geth');
    })
    .on('error', function(error) {
      console.error('IPC Error:', error);
    });
});

let whitelistedMethods = ['eth_blockNumber'];

if (process.env.WHITELISTED_METHODS) {
  whitelistedMethods = process.env.WHITELISTED_METHODS.split(',');
}

// This will be used to generate unique ids for peers
let jsonRpcId = 1;

// Generate unique id for peer
const generatePeerId = () => {
  if (jsonRpcId >= Number.MAX_SAFE_INTEGER) {
    jsonRpcId = 1;
  }
  return jsonRpcId++;
};

const sendRequestToGeth = requestBody => {
  // Handle byte stream till end of connection
  let buffer = Buffer.alloc(0);

  let orginalRequestId = requestBody.id;
  requestBody.id = generatePeerId();

  return new Promise((resolve, reject) => {
    // Timeout after some seconds
    const timeout = setTimeout(() => {
      reject(new Error('Request timed out'));
    }, rpcTimeoutSeconds * 1000);

    // Send data to Geth
    ipc.of[GETH_IPC_NAME].emit(JSON.stringify(requestBody));

    // Listen for data from Geth
    ipc.of[GETH_IPC_NAME].on('data', data => {
      // Concatenate new data chunk to the existing buffer
      buffer = Buffer.concat([buffer, data]);

      // Geth doesn't have a delimiter to catch end of a JSON.
      // For this reason we try by JSON.parse
      // https://github.com/ethereum/go-ethereum/issues/3702
      try {
        let jsonString = buffer.toString();
        const res = JSON.parse(jsonString);

        clearTimeout(timeout);

        res.id = orginalRequestId;

        resolve(res);

        // Reset the buffer for the next message
        buffer = Buffer.alloc(0);
      } catch (err) {
        // Wait for more data until JSON.parse performs without throwing
      }
    });
  });
};

app.post('/', async (req, res) => {
  const { method, params } = req.body;
  try {
    console.log(
      `Serving method "${method}" with params: ${JSON.stringify(params)}`
    );
    if (whitelistedMethods.includes(method)) {
      const response = await sendRequestToGeth(req.body);
      res.json(response);
    } else {
      res.status(403).send('Method not allowed');
    }
  } catch (err) {
    console.error('Error processing RPC response:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`JSON RPC Proxy server running on port ${port}`);
});
