import { graphql } from 'graphql';
import cookie from 'cookie';
import type { Request, Response } from 'express';
import debug from 'debug';
import { defaultConfigOptions, whoami } from '../lib/core';
import type { ConfigOptions, GraphQLContext } from '../types';
import { schema, root } from '../lib/graphql';

export function handler(configInput: ConfigOptions) {
  const config = { ...defaultConfigOptions, ...configInput };

  return async (req: Request, res: Response) => {
    const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
    const context: GraphQLContext = {
      config,
      cookies,
      setCookie: (payload: string) => res.setHeader('Set-Cookie', payload),
    };

    const { method } = req;
    const query = method === 'POST' ? req.body?.query : req.body.query;
    const variables = method === 'POST' ? req.body?.variables : req.body.variables;

    const result1 = await graphql({
      schema,
      source: query,
      variableValues: variables,
      rootValue: root,
      contextValue: context,
    });

    if (result1.data?.completeLogin) return res.redirect(result1.data.completeLogin);
    return res.status(200).json(result1);
  };
}

export function getIdentity(configInput: ConfigOptions) {
  const config = { ...defaultConfigOptions, ...configInput };
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
