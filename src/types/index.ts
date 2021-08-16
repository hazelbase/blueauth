/* eslint-disable max-len */
import type { CookieSerializeOptions } from 'cookie';

// TODO must return an email on user currently, since the flow needs it
export interface FindUniqueIdentity {
  (identityPayload: any): Promise<any | undefined>;
}

export interface CreateIdentity {
  (identityPayload: any): Promise<any | undefined>;
}

export interface CreateSignInEmailStrings {
  ({ url, serviceName }: { url: string, serviceName?: string }): { text: string; html?: string; }
}

export type ConfigOptions = {
  /**
   * Used as a key to encrypt, decrypt, and sign data
   */
  secret: string;

  /**
   * Automatically sign someone in as soon as they register.
   * Note: this means their email is not yet verified.
   *
   * @default false
   */
  signInAfterRegistration?: boolean;

  /**
   * Refresh a signed in session each time the whoami query is hit.
   * Otherwise they will need to sign in when their original session expires.
   *
   * @default true
   */
  refreshSession?: boolean;

  /**
   * The absolute URL to the blueauth endpoint. Used in the links in the sign in emails
   *
   * @example
   * https://example.com/api/auth
   */
  authEndpoint: string;

  /**
   * Set how long a sign in session lasts.
   * Can provide a string like '7d', '24h', '30s'.
   * Can also provide number in milliseconds, for example 60000 is 1 minute.
   *
   * @default
   * 7d
   *
   * @example
   * 7d // 7 days
   *
   * @example
   * 60000 // 1 minute
   */
  sessionLifespan?: string | number;

  /**
   * The service name. This appears in emails, such as "Sign in to Rocket Rides".
   *
   * @example
   * Rocket Rides
   */
  serviceName?: string;

  /**
   * The SMTP URL to mail server to use to send emails
   *
   * @example
   * smtps://username:password@smtp.example.com/?pool=true
   */
  smtpURL: string;

  /**
   * The name to use as the from field in emails
   *
   * @example
   * AirBnB
   */
  smtpFromName?: string;

  /**
   * The email address to use as the from field in emails
   *
   * @example
   * no-reply@airbnb.com
   */
  smtpFromAddress: string;

  /**
   * The email subject to use in sign in emails
   *
   * @example
   * Sign In to AirBnb!
   *
   * @default
   * Sign In
   */
  smtpSubject?: string;

  /**
   * Set the cookie name prefix
   *
   * @default
   * blueauth
   */
  cookieNamePrefix?: string;

  /**
   * Cookie options, passed directly to [cookie](https://www.npmjs.com/package/cookie).
   * Will merge with defaults, but what you pass in will override any existing defaults.
   */
  cookieOptions?: CookieSerializeOptions;

  /**
   * Function that will be given an object with the URL a user must visit to be signed in,
   * and must return an object with "html" and "text" properties that are each strings.
   * "html" the the string that is the email sent as HTML, and "text" is the string sent as an email to text only
   *
   * @example
   * function makeEmail({ url }) {
   *   const html = `Click on this to sign in <a href="${url}">Click Here</a>`;
   *   const text = `Copy and paste this URL into your browser address bar to sign in: ${url}`;
   *   return { html, text };
   * }
   */
  createSignInEmailStrings?: CreateSignInEmailStrings;

  /**
   * Function that will be given whatever identity payload (from a sign in form for example) and returns a single matching identity / user if found;
   */
  findUniqueIdentity: FindUniqueIdentity;

  /**
   * Function that will be given whatever identity payload (from a sign up form for example) and creates and returns a single identity / user;
   */
  createIdentity: CreateIdentity;
};

export type GetConfigOptions = {
  /**
   * Used as a key to encrypt, decrypt, and sign data
   */
  secret: string;

  /**
   * Function that will be given whatever identity payload (from a sign in form for example) and returns a single matching identity / user if found;
   */
  findUniqueIdentity: FindUniqueIdentity;
};

export type DefaultConfigOptions = {
  signInAfterRegistration: boolean;
  sessionLifespan: string | number;
  refreshSession: boolean;
  smtpFromName: string;
  smtpSubject: string;
  cookieNamePrefix: string;
  cookieOptions: CookieSerializeOptions;
  createSignInEmailStrings: CreateSignInEmailStrings;
};

export type Config = Omit<Required<ConfigOptions>, 'serviceName'> & { serviceName?: string };

export type GraphQLContext = {
  config: Config,
  cookies: { [key: string]: string },
  setCookie: (payload: string) => void,
  // setRedirect: (url: string) => void,
};
