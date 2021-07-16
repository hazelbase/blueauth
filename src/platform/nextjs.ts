import { graphql } from 'graphql';
// import { graphqlHTTP } from 'express-graphql';
import debug from 'debug';
import { makeConfig, makeGetConfig, whoami } from '../lib/core';
import type { ConfigOptions, GraphQLContext, GetConfigOptions } from '../types';
import type { GetServerSidePropsContextReq, NextApiRequest, NextApiResponse } from '../types/nextjs';
// import { schema } from '../lib/graphql';
import { schema, root } from '../lib/graphql';

export { ConfigOptions } from '../types';

export function handler(configInput: ConfigOptions) {
  const config = makeConfig(configInput);

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const context: GraphQLContext = {
      config,
      cookies: req.cookies,
      setCookie: (payload: string) => res.setHeader('Set-Cookie', payload),
    };

    const { method } = req;
    // debug('blueauth')('request body %O', req);
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

    if (result1.data?.completeLogin) return res.redirect(result1.data.completeLogin);
    return res.status(200).json(JSON.stringify(result1));
  };
}

export function getIdentity(configInput: GetConfigOptions) {
  const config = makeGetConfig(configInput);

  return async ({ req }: { req: NextApiRequest | GetServerSidePropsContextReq }) => {
    try {
      const idCookie = req.cookies[`${config.cookieNamePrefix}-session`];
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
