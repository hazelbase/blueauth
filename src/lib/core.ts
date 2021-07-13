import jwt from 'jsonwebtoken';
// import nodemailer from 'nodemailer';
import type { ConfigOptions, DefaultConfigOptions, GetConfigOptions } from '../types';

export const defaultConfigOptions: DefaultConfigOptions = {
  loginAfterRegistration: false,
  sessionLifespan: '7d',
  refreshSession: true,
  smtpFromName: 'Authentication',
  smtpSubject: 'Login',
  cookieNamePrefix: 'blueauth',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  },
  createLoginEmailStrings: ({ url }) => ({
    // TODO: improve default email templates
    text: `log in at ${url}`,
  }),
};

export async function sendLoginEmail({
  config,
  toEmail,
  token,
}: {
  config: Required<ConfigOptions>,
  toEmail: string,
  token: string,
}) {
  // const url = `http://localhost:3000/api/authV2?token=${token}`;
  // ?query={me{name}}
  // ?query={completeLogin(token: token)}
  // http://localhost:3000/api/authV2?query={completeLogin(token: token)}
  // const url = `http://localhost:3000/api/authV2?query=${token}`;
  const urlUnencoded = `${config.authBaseURL}?query=mutation m1 { completeLogin(token: "${token}") }`;
  const url = encodeURI(urlUnencoded);
  const { text, html } = config.createLoginEmailStrings({ url });

  // eslint-disable-next-line no-console
  console.log('> lib email', {
    text,
    html,
    config,
    toEmail,
  });

  // const transporter = nodemailer.createTransport(config.smtpURL);
  // const info = await transporter.sendMail({
  //   from: `"${config.smtpFromName}" <${config.smtpFromAddress}>`, // sender address
  //   to: toEmail,
  //   subject: config.smtpSubject, // Subject line
  //   text,
  //   html,
  // });
  //
  // // eslint-disable-next-line no-console
  // console.log('> email info', info);
}

export async function loginStart({
  identityPayload,
  config,
}: {
  identityPayload: any,
  config: Required<ConfigOptions>,
}): Promise<void> {
  // TODO Future: have path to more login flows, like FIDO
  const existingIdentity = await config.findUniqueIdentity(identityPayload);
  if (!existingIdentity) throw new Error('no existing identity');

  const loginFlow = 'email';

  switch (loginFlow) {
    case 'email': {
      const { email } = existingIdentity;
      if (!email) throw new Error('missing email');
      const tokenBody: { email: string, redirectURL?: string } = { email };
      // TODO: is this the best place to pass redirectURL?
      if (identityPayload.redirectURL) tokenBody.redirectURL = identityPayload.redirectURL;
      const token = jwt.sign(tokenBody, config.secret, { expiresIn: '15m' });
      sendLoginEmail({ config, toEmail: email, token });
      break;
    }
    default:
      throw new Error(`sign in flow not implemented: ${loginFlow}`);
  }
}

interface LoginSubmit {
  token: string;
  redirectURL?: string;
}

export async function loginSubmit({
  jwtString,
  config,
}: {
  jwtString: string,
  config: Required<ConfigOptions>,
}): Promise<LoginSubmit> {
  const jwtDecoded = jwt.verify(jwtString, config.secret);
  if (typeof jwtDecoded === 'string') throw new Error('unable to decode JWT');

  const existingIdentity = await config.findUniqueIdentity(jwtDecoded);
  if (!existingIdentity) throw new Error('no matching identity');

  const token = jwt.sign(
    { id: existingIdentity.id },
    config.secret,
    { expiresIn: config.sessionLifespan },
  );

  const { redirectURL } = jwtDecoded;

  return { token, redirectURL };
}

export async function whoami({
  jwtString,
  config,
}: {
  jwtString: string,
  config: Required<GetConfigOptions>,
}) {
  const jwtDecoded = jwt.verify(jwtString, config.secret);
  if (typeof jwtDecoded === 'string') throw new Error('unable to decode JWT');
  console.log('> lib whoami jwtDecoded', jwtDecoded);

  // TODO: more strongly type JWTs
  const existingIdentity = await config.findUniqueIdentity(jwtDecoded);
  if (!existingIdentity) throw new Error('no matching identity');

  return existingIdentity;
}
