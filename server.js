/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  if (!process.env.SERVICE_AGENT_ADMIN_BASE_URL || !process.env.CREDENTIAL_DEFINITION_ID) {
    throw new Error(
      "Missing environment variables: SERVICE_AGENT_ADMIN_BASE_URL or CREDENTIAL_DEFINITION_ID"
    );
  }
  
  const PORT = process.env.NEXT_PUBLIC_PORT
    ? Number(process.env.NEXT_PUBLIC_PORT)
    : 3000;

  const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}`
    : `http://localhost:${PORT}`;

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    console.log("A client connected info is:", socket.id);
    let message = {};
    socket.on("generateQR", async (data) => {
      try {
        const url = `${process.env.SERVICE_AGENT_ADMIN_BASE_URL}/v1/invitation/presentation-request`;
        const requestBody = {
          callbackUrl: `${PUBLIC_BASE_URL}/api/presentation`,
          ref: data.socketConnectionId,
          requestedCredentials: [
            { 
              credentialDefinitionId: process.env.CREDENTIAL_DEFINITION_ID
            },
          ],
        };
        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify(requestBody),
        });
        const result = await response.json();
        message = {
          ok: true,
          shortUrl: result?.shortUrl,
        };
      } catch (error) {
        console.error(error);
        message = {
          ok: false,
          error: `${error}`,
        };
      } finally {
        io.to(data.socketConnectionId).emit("generateQREventMessage", {
          ...message,
        });
      }
    });
    socket.on("presentationEvent", (data) => {
      console.log("socket presentationEvent:", data);
      io.to(data.ref).emit("presentationEventMessage", data);
    });

    socket.on("error", (error) => {
      console.log("A server error has occurred", error);
    });

    socket.on("disconnect", () => {
      console.log("A client disconnected");
    });
  });

  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on ${PUBLIC_BASE_URL}`);
  });
});
