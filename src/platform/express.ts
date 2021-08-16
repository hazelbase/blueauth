import { graphqlHTTP } from 'express-graphql';
import cookie from 'cookie';
import type { Request, Response } from 'express';
import debug from 'debug';
import {
  signInSubmit,
  makeConfig,
  makeGetConfig,
  whoami,
} from '../lib/core';
import type { ConfigOptions, GraphQLContext, GetConfigOptions } from '../types';
import { schema, root } from '../lib/graphql';

export { ConfigOptions } from '../types';

export function handler(configInput: ConfigOptions) {
  const config = makeConfig(configInput);

  return async (req: Request, res: Response) => {
    if (req.query?.signInToken) {
      const signInToken = Array.isArray(req.query.signInToken)
        ? req.query.signInToken[0]
        : req.query.signInToken;
      try {
        const {
          token,
          redirectURL,
        } = await signInSubmit({ jwtString: signInToken as string, config });
        const cookieString = cookie.serialize(`${config.cookieNamePrefix}-session`, token, config.cookieOptions);
        res.setHeader('Set-Cookie', cookieString);
        res.redirect(redirectURL || '/');
      } catch (error) {
        res.send(`Error: ${error.message}`);
      }
      return;
    }

    if (!req.url) throw new Error('missing url');
    const cookies = cookie.parse(req.headers.cookie || '');
    const context: GraphQLContext = {
      config,
      cookies,
      setCookie: (payload: string) => res.setHeader('Set-Cookie', payload),
    };
    await graphqlHTTP({
      schema,
      context,
      rootValue: root,
    })(req, res);

    // const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
    // const context: GraphQLContext = {
    //   config,
    //   cookies,
    //   setCookie: (payload: string) => res.setHeader('Set-Cookie', payload),
    // };
    //
    // const { method } = req;
    // const query = method === 'POST' ? req.body?.query : req.body.query;
    // const variables = method === 'POST' ? req.body?.variables : req.body.variables;
    //
    // const result1 = await graphql({
    //   schema,
    //   source: query,
    //   variableValues: variables,
    //   rootValue: root,
    //   contextValue: context,
    // });
    //
    // if (result1.data?.completeSignIn) return res.redirect(result1.data.completeSignIn);
    // return res.status(200).json(result1);
  };
}

export function getIdentity(configInput: GetConfigOptions) {
  const config = makeGetConfig(configInput);

  return async ({ req }: { req: Request }) => {
    try {
      const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
      const idCookie = cookies[`${config.cookieNamePrefix}-session`];
      debug('blueauth')('handler idCookie %s', idCookie);
      if (!idCookie) return null;
      const identity = await whoami({ jwtString: idCookie, config });
      return identity;
    } catch (error) {
      debug('blueauth')('getIdentity error %o', error);
      return null;
    }
  };
}

export { getIdentity as getUser };
