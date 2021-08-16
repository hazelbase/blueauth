import type { APIGatewayProxyEvent } from 'aws-lambda';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { handler, getIdentity } from './lambda';
import { createJWTSessionToken } from '../lib/core';

const {
  config,
  identities,
} = global.testHelpers;

const exampleUser = identities[0];
let event: APIGatewayProxyEvent = <APIGatewayProxyEvent>{};

beforeEach(() => {
  event = {
    headers: { 'content-type': 'application/graphql' },
  } as unknown as APIGatewayProxyEvent;
});

describe('handler', () => {
  describe('whoami', () => {
    it('responds with null when no cookie', async () => {
      event.httpMethod = 'GET';
      event.body = 'query mecheck { whoami }';

      const res = await handler(config)(event);
      const body = JSON.parse(res.body);

      expect(body.data.whoami).toBeNull();
    });

    it('responds with user when cookie', async () => {
      event.httpMethod = 'GET';
      event.body = 'query mecheck { whoami }';

      const { id } = exampleUser;
      const { secret } = config;
      const expiresIn = config.sessionLifespan;
      const signInCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      event.headers = { ...event.headers, ...{ cookie: signInCookie } };

      const res = await handler(config)(event);

      const body = JSON.parse(res.body);
      expect(body.data.whoami.id).toBe(id);
      expect(body.data.whoami.email).toBe(exampleUser.email);
    });

    it('responds with error when invalid cookie', async () => {
      event.httpMethod = 'GET';
      event.body = 'query mecheck { whoami }';
      const { id } = exampleUser;
      const secret = `someWrongSecret${config.secret}`;
      const expiresIn = config.sessionLifespan;
      const signInCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      event.headers = { ...event.headers, ...{ cookie: signInCookie } };

      const res = await handler(config)(event);

      const body = JSON.parse(res.body);
      const firstError = body.errors[0];
      expect(firstError.message).toBe('invalid signature');
    });
  });

  describe('register', () => {
    it('responds with identity', async () => {
      event.httpMethod = 'POST';
      event.body = `
          mutation register {
            register(identity: { email: "222@test.com" })
          }
        `;

      const res = await handler(config)(event);

      const body = JSON.parse(res.body);
      expect(body.data.register.email).toBe('222@test.com');
    });
  });

  describe('start email signIn', () => {
    // TODO: check email is sent / not sent

    describe('no existing user', () => {
      it('responds with an error', async () => {
        event.httpMethod = 'POST';
        event.body = `
            mutation register {
              startEmailSignIn(identity: { email: "startEmailSignIn@test.com" })
            }
          `;

        const res = await handler(config)(event);

        const body = JSON.parse(res.body);
        expect(body.errors[0].message).toBe('no existing identity');
      });
    });

    describe('existing user', () => {
      it('responds with true', async () => {
        const existingIdentity = identities[0];
        event.httpMethod = 'POST';
        event.body = `
            mutation register {
              startEmailSignIn(identity: { email: "${existingIdentity.email}" })
            }
          `;

        const res = await handler(config)(event);

        const body = JSON.parse(res.body);
        expect(body.data.startEmailSignIn).toBe(true);
      });
    });
  });

  describe('start email signIn or register', () => {
    describe('existing user', () => {
      // TODO check email sending
      it('starts signIn in process for user', async () => {
        const existingIdentity = identities[0];
        event.httpMethod = 'POST';
        event.body = `
            mutation register {
              registerOrStartEmailSignIn(identity: { email: "${existingIdentity.email}" })
            }
          `;

        const res = await handler(config)(event);

        const body = JSON.parse(res.body);
        expect(res.headers && res.headers['Set-Cookie']).toBeFalsy();
        expect(body.data.registerOrStartEmailSignIn).toBe('SIGN_IN_STARTED');
      });
    });

    describe('no existing user', () => {
      describe('auto signIn', () => {
        // TODO check email sending
        it('signs them in', async () => {
          event.httpMethod = 'POST';
          event.body = `
              mutation register {
                registerOrStartEmailSignIn(identity: { email: "someNewPerson@test.com" })
              }
            `;

          const signInConfig = { ...config, ...{ signInAfterRegistration: true } };

          const res = await handler(signInConfig)(event);

          const cookieHeader = res.headers && res.headers['Set-Cookie'];
          const cookieParsed = cookie.parse(cookieHeader as string);
          const sessionToken = cookieParsed['blueauth-session'];
          const sessionTokenDecoded = jwt.verify(sessionToken, config.secret);
          const sessionId = typeof sessionTokenDecoded === 'string' ? JSON.parse(sessionTokenDecoded).id : sessionTokenDecoded.id;

          const body = JSON.parse(res.body);
          expect(body.data.registerOrStartEmailSignIn).toBe('SIGN_IN_COMPLETED');
          expect(sessionId).toBe('aaaa'); // TODO: better handle new user creation ID
        });
      });

      describe('no auto signIn', () => {
        it('does not sign them in, starts sign in process', async () => {
          // TODO: check email sending
          event.httpMethod = 'POST';
          event.body = `
              mutation register {
                registerOrStartEmailSignIn(identity: { email: "someNewPerson@test.com" })
              }
            `;

          const res = await handler(config)(event);

          const body = JSON.parse(res.body);
          expect(res.headers && res.headers['Set-Cookie']).toBeFalsy();
          expect(body.data.registerOrStartEmailSignIn).toBe('SIGN_IN_STARTED');
        });
      });
    });
  });

  describe('complete signIn', () => {
    describe('valid token', () => {
      it('responds with token in cookie and body, and redirects', async () => {
        const existingIdentity = identities[0];
        const tokenBody = { email: existingIdentity.email };
        const token = jwt.sign(tokenBody, config.secret, { expiresIn: '15m' });

        event.httpMethod = 'GET';
        event.queryStringParameters = { signInToken: token };

        const res = await handler(config)(event);

        const cookieHeader = res.headers && res.headers['Set-Cookie'];
        const cookieParsed = cookie.parse(cookieHeader as string);
        const sessionToken = cookieParsed['blueauth-session'];
        const sessionTokenDecoded = jwt.verify(sessionToken, config.secret);
        const sessionId = typeof sessionTokenDecoded === 'string' ? JSON.parse(sessionTokenDecoded).id : sessionTokenDecoded.id;

        expect(res.headers && res.headers.Location).toBe('/');
        expect(sessionId).toBe(existingIdentity.id);
      });
    });

    describe('invalid token', () => {
      it('responds with no token in cookie or body', async () => {
        const existingIdentity = identities[0];
        const tokenBody = { email: existingIdentity.email };
        const token = jwt.sign(tokenBody, `INVALID_SECRET_${config.secret}`, { expiresIn: '15m' });

        event.httpMethod = 'GET';
        event.queryStringParameters = { signInToken: token };

        const res = await handler(config)(event);

        const cookieHeader = res.headers && res.headers['Set-Cookie'];

        expect(res.body).toBe('Error: invalid signature');
        expect(cookieHeader).toBeFalsy();
      });
    });

    describe('no token', () => {
      it('responds with no token in cookie or body', async () => {
        event.httpMethod = 'GET';
        event.queryStringParameters = { signInToken: 'just some random string' };

        const res = await handler(config)(event);

        const cookieHeader = res.headers && res.headers['Set-Cookie'];

        expect(res.body).toBe('Error: jwt malformed');
        expect(cookieHeader).toBeFalsy();
      });
    });
  });

  describe('signOut', () => {
    it('responds with nothing when no cookie', async () => {
      event.httpMethod = 'POST';
      event.body = 'mutation signMeOut { signOut }';

      const res = await handler(config)(event);

      const body = JSON.parse(res.body);
      expect(body.data.signOut).toBe(true);
    });

    it('responds with empty cookie', async () => {
      event.httpMethod = 'POST';
      event.body = 'mutation signOut { signOut }';
      const { id } = exampleUser;
      const secret = `someWrongSecret${config.secret}`;
      const expiresIn = config.sessionLifespan;
      const signInCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      event.headers = { ...event.headers, ...{ cookie: signInCookie } };

      const res = await handler(config)(event);

      const body = JSON.parse(res.body);
      const cookieHeader = res.headers && res.headers['Set-Cookie'];
      // TODO: next error
      const cookieParsed = cookie.parse(cookieHeader as string);
      expect(body.data.signOut).toBe(true);
      expect(cookieParsed['Max-Age']).toBe('0');
    });
  });
});

describe('getIdentity', () => {
  describe('no relevant cookies', () => {
    it('is null with no cookies', async () => {
      const result = await getIdentity(config)({ event });
      expect(result).toBeNull();
    });

    it('is null with no related cookies', async () => {
      event.headers = { ...event.headers, ...{ cookie: 'blah=nothing' } };

      const result = await getIdentity(config)({ event });
      expect(result).toBeNull();
    });
  });

  describe('valid cookie', () => {
    it('is an identity', async () => {
      const { id } = exampleUser;
      const { secret } = config;
      const expiresIn = config.sessionLifespan;
      const signInCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      event.headers = { ...event.headers, ...{ cookie: signInCookie } };

      const result = await getIdentity(config)({ event });
      expect(result).toBe(exampleUser);
    });
  });

  describe('incorrectly signed cookie', () => {
    it('is null', async () => {
      const { id } = exampleUser;
      const secret = `someWrongSecretAddedTo${config.secret}`;
      const expiresIn = config.sessionLifespan;
      const signInCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      event.headers = { ...event.headers, ...{ cookie: signInCookie } };
      const result = await getIdentity(config)({ event });
      expect(result).toBeNull();
    });
  });
});
