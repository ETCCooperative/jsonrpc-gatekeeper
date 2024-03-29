// const cors = require('cors');
const express = require('express');
const ethers = require("ethers");

require('dotenv').config();

const port = process.env.PORT || 3000;

const app = express();

// Enable CORS for all requests
// app.use(cors({ origin: config.corsOrigin }));

// For parsing application/json
app.use(express.json());

let whitelistedMethods = ['eth_blockNumber'];

if (process.env.WHITELISTED_METHODS) {
  whitelistedMethods = process.env.WHITELISTED_METHODS.split(',');
}


const CLIENT_PROVIDER_URL = process.env.CLIENT_PROVIDER_URL
let provider

// If the URL starts with http, it will be treated as an HTTP RPC server
if (CLIENT_PROVIDER_URL.startsWith('http')) {
  provider = new ethers.JsonRpcProvider(CLIENT_PROVIDER_URL);
  // If the URL starts with ws, it will be treated as a WebSocket RPC server
} else if (CLIENT_PROVIDER_URL.startsWith('ws')) {
  provider = new ethers.WebSocketProvider(CLIENT_PROVIDER_URL);
} else {
  // Any unmatched protocol scheme is assumed to be an IPC filepath.
  // A file path may be relative or absolute, so there's no way of further validating the filepath
  // under those conditions aside from testing if the file exists.
  // Since we'd need to validate more than simple file existence (eg. permissions, active geth connection)
  // to know if tthe Provider is going to work, we'll just pass the URL directly to the IPC provider
  // and let that throw an error if any.
  provider = new ethers.IpcSocketProvider(CLIENT_PROVIDER_URL);
}

const handleRequest = async requestBody => {
  try {
    // Assuming the JSON-RPC request is properly formatted
    const result = await provider.send(requestBody.method, requestBody.params);
    return {
        jsonrpc: "2.0",
        result: result,
        id: requestBody.id
    }
  } catch (error) {
      return {
          jsonrpc: "2.0",
          error: {
              code: -32603,
              message: error.message
          },
          id: requestBody.id
      }
  }
};

app.post('/', async (req, res) => {
  const { method, params } = req.body;
  try {
    console.log(
      `Serving method "${method}" with params: ${JSON.stringify(params)}`
    );
    if (whitelistedMethods.includes(method)) {
      const response = await handleRequest(req.body);
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
