import cookie from 'cookie';
import { graphqlHTTP } from 'express-graphql';
import debug from 'debug';
import {
  signInSubmit,
  makeConfig,
  makeGetConfig,
  whoami,
} from '../lib/core.js';
import type { ConfigOptions, GraphQLContext, GetConfigOptions } from '../types';
import type { GetServerSidePropsContextReq, NextApiRequest, NextApiResponse } from '../types/nextjs';
import { schema, root } from '../lib/graphql.js';

export { ConfigOptions } from '../types';

interface NextApiRequestV2 extends NextApiRequest { url: string; }

export function handler(configInput: ConfigOptions) {
  const config = makeConfig(configInput);
  debug('blueauth')('handler config %O', config);

  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.query?.signInToken) {
      const signInToken = Array.isArray(req.query.signInToken)
        ? req.query.signInToken[0]
        : req.query.signInToken;
      try {
        const { token, redirectURL } = await signInSubmit({ jwtString: signInToken, config });
        const cookieString = cookie.serialize(`${config.cookieNamePrefix}-session`, token, config.cookieOptions);
        res.setHeader('Set-Cookie', cookieString);
        res.redirect(redirectURL || '/');
      } catch (error) {
        res.send(`Error: ${error.message}`);
      }
      return;
    }

    if (!req.url) throw new Error('missing url');
    const context: GraphQLContext = {
      config,
      cookies: req.cookies,
      setCookie: (payload: string) => res.setHeader('Set-Cookie', payload),
    };
    await graphqlHTTP({
      schema,
      context,
      rootValue: root,
    })(req as NextApiRequestV2, res);
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
