// const cors = require('cors');
const express = require('express');
const ipc = require('node-ipc').default;

require('dotenv').config();

const port = process.env.PORT || 3000;

const app = express();

// Enable CORS for all requests
// app.use(cors({ origin: config.corsOrigin }));

// For parsing application/json
app.use(express.json());

ipc.config.id = 'geth';
ipc.config.retry = 1500;
ipc.config.rawBuffer = true;
ipc.config.silent = true;

const GETH_IPC = 'geth';

ipc.connectTo(GETH_IPC, '/tmp/core-geth_classic.ipc');

let whitelistedMethods = ['eth_blockNumber'];

if (process.env.WHITELISTED_METHODS) {
  whitelistedMethods = process.env.WHITELISTED_METHODS.split(',');
}

const sendRequestToGeth = (requestBody) => {
  return new Promise((resolve, reject) => {
    ipc.of[GETH_IPC].emit(JSON.stringify(requestBody));
    ipc.of[GETH_IPC].on('data', (response) => {
      resolve(JSON.parse(response));
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
