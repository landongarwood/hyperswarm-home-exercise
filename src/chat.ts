// chat.ts
import readline from 'readline';
import RPC from '@hyperswarm/rpc';
import { randomBytes } from 'crypto';

// Define the structure of a chat message
interface ChatMessage {
  from: string;
  message: string;
}

// Utility for reading user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// List of connected clients
const clients: any[] = [];

// Prompt the user to enter their username
const promptUserName = (): Promise<string> => {
  return new Promise((resolve) => {
    rl.question('Enter your username: ', (name) => {
      resolve(name);
    });
  });
};

// Delay function to simulate random wait times
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Main chat application logic
const createChatApp = async () => {
  const rpc = new RPC();
  const username = await promptUserName();

  // Function to start a new server
  const startServer = async () => {
    const server = rpc.createServer();
    await server.listen();

    console.log(
      `Started a new server as ${username}. Public Key: ${server.publicKey.toString('hex')}`,
    );

    // Register the 'message' handler on the server
    server.respond('message', (req: Buffer) => {
      const data = JSON.parse(req.toString()); // Parse the incoming buffer as JSON
      const { from, message } = data;
      console.log(`${from}: ${message}`);

      // Broadcast the message to all connected clients except the sender
      clients.forEach((client) => {
        if (client.stream !== server.stream) {
          client.request('message', req); // Forward the buffer (message) to all other clients
        }
      });

      return null;
    });

    server.on('connection', (client: any) => {
      clients.push(client); // Add new client to the list of connected clients
      console.log('A new client has connected.');

      client.on('close', () => {
        // Remove the client from the list when it disconnects
        const index = clients.indexOf(client);
        if (index > -1) {
          clients.splice(index, 1);
        }
      });
    });

    server.on('close', () => {
      console.log('Server closed.');
    });

    return server;
  };

  // Function to connect as client
  const connectAsClient = async (publicKey: Buffer) => {
    const client = rpc.connect(publicKey);

    return new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        console.log(`Connected to the chat server as ${username}.`);
        resolve();
      });

      client.on('close', () => {
        console.log('Server closed. Attempting to reconnect...');
        reject(new Error('Connection closed'));
      });

      client.on('error', (err: Error) => {
        // Properly typed err
        console.log('Error in connection:', err.message);
        reject(err);
      });

      // Listen for new messages from the user
      rl.removeAllListeners('line'); // Remove any previous 'line' listeners
      rl.on('line', async (input: string) => {
        const message = input.trim();
        if (message.length === 0) return;

        // Prepare the message to be sent as a buffer
        const data = Buffer.from(JSON.stringify({ from: username, message }));

        // Send the message to the server (which will forward it to other peers)
        await client.request('message', data);
      });

      // Listen for incoming messages from the server
      client.on('message', (req: Buffer) => {
        const data = JSON.parse(req.toString());
        const { from, message } = data;
        console.log(`${from}: ${message}`);
      });
    });
  };

  // Attempt to connect to the server by asking for the server's public key
  rl.question(
    'Enter server public key (leave empty to start a new server): ',
    async (publicKeyInput) => {
      if (publicKeyInput.trim() === '') {
        // No public key entered, so start a new server
        await startServer();
      } else {
        // Try to connect as a client to the given public key
        const publicKey = Buffer.from(publicKeyInput, 'hex');
        try {
          await connectAsClient(publicKey);
        } catch (err) {
          console.error(
            'Failed to connect as client. Starting a new server instead...',
          );
          await startServer();
        }
      }
    },
  );
};

// Run the chat app
createChatApp().catch(console.error);
