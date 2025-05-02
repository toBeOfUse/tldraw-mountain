import { OAuth2Namespace } from "@fastify/oauth2";

declare module "fastify" {
  interface FastifyInstance {
    githubOauth: OAuth2Namespace;
  }
}
