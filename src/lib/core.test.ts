/* eslint-disable max-len */
import { ConfigOptions } from '../types';
import {
  // sendSignInEmail,
  makeConfig,
} from './core';

// const { config } = global.testHelpers;

describe('makeConfig', () => {
  it('combines with defaultConfigOptions, merging cookie options', async () => {
    const userConfig: ConfigOptions = {
      authEndpoint: 'http://test.com/auth',
      secret: 'someSecretString',
      smtpURL: 'someUrl',
      smtpFromAddress: 'fake@test.com',
      findUniqueIdentity: async () => null,
      createIdentity: async () => null,
      cookieOptions: {
        domain: 'test.com',
        secure: false,
      },
    };

    const finalConfig = makeConfig(userConfig);

    const cookieOptionsExpected = {
      secure: false,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 604800,
      domain: 'test.com',
      path: '/',
    };
    expect(finalConfig.signInAfterRegistration).toBeFalsy();
    expect(finalConfig.sessionLifespan).toBe('7d');
    expect(finalConfig.cookieOptions).toStrictEqual(cookieOptionsExpected);
  });

  it('removes cookie domain if it is localhost', async () => {
    const userConfig: ConfigOptions = {
      authEndpoint: 'http://test.com/auth',
      secret: 'someSecretString',
      smtpURL: 'someUrl',
      smtpFromAddress: 'fake@test.com',
      findUniqueIdentity: async () => null,
      createIdentity: async () => null,
      cookieOptions: {
        domain: 'localhost',
        secure: false,
      },
    };

    const finalConfig = makeConfig(userConfig);

    const cookieOptionsExpected = {
      secure: false,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 604800,
      path: '/',
    };
    expect(finalConfig.signInAfterRegistration).toBeFalsy();
    expect(finalConfig.sessionLifespan).toBe('7d');
    expect(finalConfig.cookieOptions).toStrictEqual(cookieOptionsExpected);
  });
});

// describe('sendSignInEmail', () => {
//   it('returns true', async () => {
//     const result = await sendSignInEmail({ config, toEmail: 'fake@test.com', token: 'someString' });
//     expect(result).toBe(true);
//   });
// });
