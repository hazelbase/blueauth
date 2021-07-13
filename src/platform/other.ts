/* eslint-disable no-console */
import { graphql } from 'graphql';
import { defaultConfigOptions, whoami } from '../lib/core';
import type { ConfigOptions, GraphQLContext } from '../types';
import type { NextApiRequest, NextApiResponse } from '../types/nextjs';
import { schema, root } from '../lib/graphql';

export function handler(configInput: ConfigOptions) {
  const config = { ...defaultConfigOptions, ...configInput };

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const context: GraphQLContext = {
      config,
      cookies: req.cookies,
      setCookie: (payload: string) => res.setHeader('Set-Cookie', payload),
    };

    const { method } = req;
    const query = method === 'POST' ? req.body?.query : req.query.query;
    const variables = method === 'POST' ? req.body?.variables : req.query.variables;

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

export function deepTest(color: string) {
  return `you like color ${color}!!!!!`;
}

export function getIdentity(configInput: ConfigOptions) {
  const config = { ...defaultConfigOptions, ...configInput };
  return async ({ req }: { req: NextApiRequest }) => {
    try {
      const idCookie = req.cookies[`${config.cookieNamePrefix}-session`];
      if (!idCookie) return null;
      const identity = await whoami({ jwtString: idCookie, config });
      return identity;
    } catch (error) {
      console.error('[blueauth][error]', error);
      return null;
    }
  };
}

export { getIdentity as getUser };
