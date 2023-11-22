// const cors = require('cors');
const express = require('express');
const ipc = require('node-ipc').default;

require('dotenv').config();

const GETH_IPC_NAME = 'geth';
const GETH_IPC_PATH = process.env.GETH_IPC_PATH || '/tmp/core-geth_classic.ipc';

const port = process.env.PORT || 3000;

const app = express();

// Enable CORS for all requests
// app.use(cors({ origin: config.corsOrigin }));

// For parsing application/json
app.use(express.json());

ipc.config.id = GETH_IPC_NAME;
ipc.config.retry = 1500;
ipc.config.rawBuffer = true;
ipc.config.silent = true;

ipc.connectTo(GETH_IPC_NAME, GETH_IPC_PATH);

let whitelistedMethods = ['eth_blockNumber'];

if (process.env.WHITELISTED_METHODS) {
  whitelistedMethods = process.env.WHITELISTED_METHODS.split(',');
}

const sendRequestToGeth = (requestBody) => {
  // Handle byte stream till end of connection
  let buffer = Buffer.alloc(0);

  return new Promise((resolve, reject) => {
    // Send data to Geth
    ipc.of[GETH_IPC_NAME].emit(JSON.stringify(requestBody));

    // Listen for data from Geth
    ipc.of[GETH_IPC_NAME].on('data', (data) => {
      // Concatenate new data chunk to the existing buffer
      buffer = Buffer.concat([buffer, data]);

      // Check if reponse is finished
      if (buffer.includes('\n')) {
        resolve(JSON.parse(buffer.toString()));

        // Reset the buffer for the next message
        buffer = Buffer.alloc(0);
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
    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
});

// Start the server
app.listen(port, () => {
  console.log(`JSON RPC Proxy server running on port ${port}`);
});
