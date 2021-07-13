import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { buildSchema } from 'graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  loginStart,
  loginSubmit,
  whoami,
} from './core';
import type { GraphQLContext } from '../types';

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
    registerOrStartEmailLogin(identity: JSON!): ActionResult!
    startEmailLogin(identity: JSON!): Boolean!
    register(identity: JSON!): JSON!
    completeLogin(token: String!): String!
    logout: Boolean!
  }
`);

export const root = {
  JSON: GraphQLJSON,

  registerOrStartEmailLogin: async (args: any, context: GraphQLContext) => {
    console.log('> lib starting registerOrStartEmailLogin', { args, context });
    const existingIdentity = await context.config.findUniqueIdentity(args.identity);
    console.log('> lib registerOrStartEmailLogin debug', { existingIdentity });
    if (existingIdentity) {
      await loginStart({ identityPayload: args.identity, config: context.config });
      return 'LOGIN_STARTED';
    }

    console.log('> lib registerOrStartEmailLogin debug v2');
    const identity = await context.config.createIdentity(args.identity);
    console.log('> lib registerOrStartEmailLogin debug v3', { identity });

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

    await loginStart({ identityPayload: identity, config: context.config });
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
    await loginStart({ identityPayload: args.identity, config });
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
