import cors from "@fastify/cors";
import websocketPlugin from "@fastify/websocket";
import fastify, { FastifyRequest } from "fastify";
import type { RawData } from "ws";
import { loadAsset, storeAsset } from "./assets";
import { makeOrLoadRoom } from "./rooms";
import { unfurl } from "./unfurl";
import fastifyStatic from "@fastify/static";
import path from "path";
import isSvg from "is-svg";
import imageType from "image-type";
import oauth from "@fastify/oauth2";
import crypto from "crypto";
import secrets from "./secrets";

const PORT = 5858;
// in dev mode, all requests are automatically authenticated. in non-dev mode,
// this server serves the result of a vite build (since vite is assumed to not
// be running)
const DEV = process.argv.includes("--dev");

const SESSION_COOKIE_NAME = "mountain-session";
// simple in-memory session cookie storage. maps session cookies to github
// usernames
const sessionCookies = new Map<string, string>();

// For this example we use a simple fastify server with the official websocket
// plugin. To keep things simple we're skipping normal production concerns like
// rate limiting and input validation.

const app = fastify({ trustProxy: true });
app.register(websocketPlugin);
app.register(cors, { origin: "*" });

if (!DEV) {
  console.log("starting in production mode");

  // serve the last vite build
  app.register(fastifyStatic, { root: path.resolve(process.cwd(), "./src/client/dist") });

  // allow github logins
  app.register(oauth, {
    name: "githubOauth",
    credentials: {
      client: { id: secrets.githubClientId, secret: secrets.githubClientSecret },
      auth: oauth.GITHUB_CONFIGURATION,
    },
    startRedirectPath: "/login/github",
    callbackUri(req) {
      const host = req.protocol === "http" ? `http://localhost:${PORT}` : `https://${req.hostname}`;
      return `${host}/login/github/callback`;
    },
  });

  app.get("/login/github/callback", async (req, reply) => {
    const { token } = await app.githubOauth.getAccessTokenFromAuthorizationCodeFlow(req);

    if (!token?.access_token) {
      reply.redirect(`/?error=Github credentials non-functional.`);
      return;
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const user = await userRes.json();
    if (secrets.githubAllowedUsers.includes(user.login)) {
      const secureCookie = crypto.randomBytes(32).toString("hex");
      sessionCookies.set(secureCookie, user.login);
      reply.setCookie(SESSION_COOKIE_NAME, secureCookie, {
        httpOnly: true,
        secure: "auto",
        path: "/",
        sameSite: "strict",
      });
      reply.redirect("/");
      return;
    } else {
      reply.redirect(`/?error=User ${user.login} not found.`);
    }
  });

  app.post("/logout", (req, res) => {
    const cookieToDelete = getSessionCookie(req);
    sessionCookies.delete(cookieToDelete);
    return res.send("done");
  });

  app.addHook("preValidation", async (req, reply) => {
    if (req.ws && getCurrentUser(req) === null) {
      console.warn("unauthenticated req made it to websocket");
      reply.code(403).send("No");
    }
  });
} else {
  console.log("starting in dev mode; authentication disabled");
}

function getSessionCookie(req: FastifyRequest) {
  return req.cookies[SESSION_COOKIE_NAME] || "";
}

function getCurrentUser(req: FastifyRequest) {
  if (DEV) {
    return "dev-mode";
  }
  const sessionCookie = getSessionCookie(req);
  if (!sessionCookie || !sessionCookies.has(sessionCookie)) {
    return null;
  }
  return sessionCookies.get(sessionCookie)!;
}

app.get("/isauthenticated", (req, reply) => {
  const user = getCurrentUser(req);
  reply.send(JSON.stringify({ user, success: user !== null }));
});

app.register(async (app) => {
  // This is the main entrypoint for the multiplayer sync
  app.get("/connect/:roomId", { websocket: true }, async (socket, req) => {
    // authentication is checked for this endpoint by the preValidation hook
    // defined in the oauth section

    // The roomId comes from the URL pathname
    const roomId = (req.params as any).roomId as string;
    // The sessionId is passed from the client as a query param,
    // you need to extract it and pass it to the room.
    const sessionId = (req.query as any)?.["sessionId"] as string;

    // At least one message handler needs to
    // be attached before doing any kind of async work
    // https://github.com/fastify/fastify-websocket?tab=readme-ov-file#attaching-event-handlers
    // We collect messages that came in before the room was loaded, and re-emit them
    // after the room is loaded.
    const caughtMessages: RawData[] = [];

    const collectMessagesListener = (message: RawData) => {
      caughtMessages.push(message);
    };

    socket.on("message", collectMessagesListener);

    // Here we make or get an existing instance of TLSocketRoom for the given roomId
    const room = await makeOrLoadRoom(roomId);
    // and finally connect the socket to the room
    room.handleSocketConnect({ sessionId, socket });

    socket.off("message", collectMessagesListener);

    // Finally, we replay any caught messages so the room can process them
    for (const message of caughtMessages) {
      socket.emit("message", message);
    }
  });

  // To enable blob storage for assets, we add a simple endpoint supporting PUT and GET requests
  // But first we need to allow all content types with no parsing, so we can handle raw data
  app.addContentTypeParser("*", (_, __, done) => done(null));
  app.put("/uploads/:id", {}, async (req, res) => {
    if (!getCurrentUser(req)) {
      return res.code(400).send("no");
    }
    const id = (req.params as any).id as string;
    await storeAsset(id, req.raw);
    res.send({ ok: true });
  });
  app.get("/uploads/:id", async (req, res) => {
    if (!getCurrentUser(req)) {
      return res.code(400).send("no");
    }
    const id = (req.params as any).id as string;
    const data = await loadAsset(id);
    if (isSvg(data.toString("utf-8"))) {
      // for some reason, browsers really want MIME types for SVGs specifically
      // (unlike JPEGs or whatever)
      res.header("Content-Type", "image/svg+xml");
    } else {
      const type = await imageType(data);
      if (type && type.mime) {
        res.header("Content-Type", type.mime);
      } else {
        console.warn("mime type for asset " + id + " not known");
      }
    }
    res.send(data);
  });

  // To enable unfurling of bookmarks, we add a simple endpoint that takes a URL query param
  app.get("/unfurl", async (req, res) => {
    if (!getCurrentUser(req)) {
      return res.code(400).send("no");
    }
    const url = (req.query as any).url as string;
    res.send(await unfurl(url));
  });
});

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  console.log(`Backend server started on port ${PORT}`);
  if (DEV) {
    console.log("Don't go there, though, go to port 5757 for Vite dev");
  }
});
