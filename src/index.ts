const RPC = require('@hyperswarm/rpc');

const run = async () => {
  const rpc = new RPC();

  const server = rpc.createServer();

  await server.listen();

  server.respond('echo', (req: Buffer) => console.log(req.toString()));

  const client = rpc.connect(server.publicKey);

  await client.request('echo', Buffer.from('hello world'));
};

run();
