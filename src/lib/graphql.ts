import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { buildSchema } from 'graphql';
import GraphQLJSON from 'graphql-type-json';
import debug from 'debug';
// import { readFileSync } from 'fs';
// import { join } from 'path';
import {
  loginStart,
  loginSubmit,
  whoami,
} from './core';
import type { GraphQLContext } from '../types';

// const typeDefs = readFileSync(join(__dirname, './schema.graphql'), 'utf-8');
// export const schema = buildSchema(typeDefs);
export const schema = buildSchema(`
  scalar JSON

  enum ActionResult {
    LOGIN_STARTED
    LOGIN_COMPLETED
  }

  type Query {
    whoami: JSON
  }

  type Mutation {
    registerOrStartEmailLogin(identity: JSON!, redirectURL: String): ActionResult!
    startEmailLogin(identity: JSON!, redirectURL: String): Boolean!
    register(identity: JSON!): JSON!
    logout: Boolean!
  }
`);

export const root = {
  JSON: GraphQLJSON,

  registerOrStartEmailLogin: async (args: any, context: GraphQLContext) => {
    debug('blueauth')('registerOrStartEmailLogin %O', args);
    const existingIdentity = await context.config.findUniqueIdentity(args.identity);
    if (existingIdentity) {
      await loginStart({
        identityPayload: args.identity,
        config: context.config,
        redirectURL: args.redirectURL,
      });
      return 'LOGIN_STARTED';
    }

    const identity = await context.config.createIdentity(args.identity);

    if (context.config.loginAfterRegistration) {
      const token = jwt.sign(
        { id: identity.id },
        context.config.secret,
        { expiresIn: context.config.sessionLifespan },
      );

      const cookieString = cookie.serialize(`${context.config.cookieNamePrefix}-session`, token, context.config.cookieOptions);
      context.setCookie(cookieString);
      return 'LOGIN_COMPLETED';
    }

    await loginStart({
      identityPayload: identity,
      config: context.config,
      redirectURL: args.redirectURL,
    });
    return 'LOGIN_STARTED';
  },

  register: async (args: any, { config, ...context }: GraphQLContext) => {
    const existingIdentity = await config.findUniqueIdentity(args.identity);
    if (existingIdentity) throw new Error('already exists');
    const identity = await config.createIdentity(args.identity);

    if (config.loginAfterRegistration) {
      const token = jwt.sign(
        { id: identity.id },
        config.secret,
        { expiresIn: config.sessionLifespan },
      );
      const cookieString = cookie.serialize(`${config.cookieNamePrefix}-session`, token, config.cookieOptions);
      context.setCookie(cookieString);
    }

    return identity;
  },

  startEmailLogin: async (args: any, { config }: GraphQLContext) => {
    await loginStart({
      identityPayload: args.identity,
      config,
      redirectURL: args.redirectURL,
    });
    return true;
  },

  completeLogin: async ({ token: inputToken }: any, { config, ...context }: GraphQLContext) => {
    const { token, redirectURL } = await loginSubmit({ jwtString: inputToken, config });
    const cookieString = cookie.serialize(`${config.cookieNamePrefix}-session`, token, config.cookieOptions);
    context.setCookie(cookieString);
    return redirectURL || '/';
  },

  logout: async (_args: any, { config, ...context }: GraphQLContext) => {
    const idCookie = context.cookies[`${config.cookieNamePrefix}-session`];
    if (!idCookie) return true;
    const cookieString = cookie.serialize(`${config.cookieNamePrefix}-session`, 'nope', {
      ...config.cookieOptions,
      ...{ maxAge: 0, expires: new Date(0) },
    });
    context.setCookie(cookieString);
    return true;
  },

  whoami: async (_args: any, { config, ...context }: GraphQLContext) => {
    const idCookie = context.cookies[`${config.cookieNamePrefix}-session`];
    if (!idCookie) return null;
    const identity = await whoami({ jwtString: idCookie, config });

    if (config.refreshSession) {
      // TODO: DRY this up, it's in a few spots
      const token = jwt.sign(
        { id: identity.id },
        config.secret,
        { expiresIn: config.sessionLifespan },
      );
      context.setCookie(cookie.serialize(`${config.cookieNamePrefix}-session`, token, config.cookieOptions));
    }

    return identity;
  },
};
