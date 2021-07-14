/* eslint-disable no-console */
import { graphql } from 'graphql';
// import { graphqlHTTP } from 'express-graphql';
import { defaultConfigOptions, whoami } from '../lib/core';
import type { ConfigOptions, GraphQLContext, GetConfigOptions } from '../types';
import type { GetServerSidePropsContextReq, NextApiRequest, NextApiResponse } from '../types/nextjs';
// import { schema } from '../lib/graphql';
import { schema, root } from '../lib/graphql';

// TODO second
// check req and disable all GETs except login
// get less options from identity option
// dev auto build
// write tests
// hooks
// add secure cookies by default
// other defaults from other projects?
// on graphql, get operation name. other missing args?
// check expected behavior of merging cookie config
// url encode login email query?
// optimize client use. move to microbundle with multiple import spots? lighten up config sig
// signout all sessions
// secret key rotation
// validating of config file
// be able to import directly from 'blueauth/handles/this'
// better handle signaling of redirect from resolver for completeLogin

export function handler(configInput: ConfigOptions) {
  console.log('> lib starting nextjs', { configInput });
  const config = { ...defaultConfigOptions, ...configInput };

  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (!req.url) throw new Error('missing url');
    const context: GraphQLContext = {
      config,
      cookies: req.cookies,
      setCookie: (payload: string) => res.setHeader('Set-Cookie', payload),
    };

    const { method } = req;
    console.log('> lib method', method);
    const query = method === 'POST' ? req.body.query : req.query.query;
    const variables = method === 'POST' ? req.body.variables : req.query.variables;

    // console.log('> lib starting nextjs result1', {
    //   query,
    //   variables,
    //   method,
    //   body: req.body,
    // });

    // TODO: look into redirecting, maybe using extension
    // graphqlHTTP({ schema, context })(req as any, res);

    const result1 = await graphql({
      schema,
      source: query,
      variableValues: variables,
      rootValue: root,
      contextValue: context,
    });
    console.log('> lib ending nextjs result1', { result1 });

    if (result1.data?.completeLogin) return res.redirect(result1.data.completeLogin);
    return res.status(200).json(JSON.stringify(result1));
  };
}

export function getIdentity(configInput: GetConfigOptions) {
  console.log('> lib getIdentity');
  const config = { ...defaultConfigOptions, ...configInput };
  return async ({ req }: { req: NextApiRequest | GetServerSidePropsContextReq }) => {
    try {
      const idCookie = req.cookies[`${config.cookieNamePrefix}-session`];
      console.log('> lib getIdentity idCookie', idCookie);
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