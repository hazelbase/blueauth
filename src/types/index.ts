import type { CookieSerializeOptions } from 'cookie';

// TODO must return an email on user currently, since the flow needs it
export interface FindUniqueIdentity {
  (identityPayload: any): Promise<any | undefined>;
}

export interface CreateIdentity {
  (identityPayload: any): Promise<any | undefined>;
}

export interface CreateLoginEmailStrings {
  ({ url }: {
    url: string
  }): { text: string; html?: string; }
}

export type ConfigOptions = {
  /**
   * random characters used as a key
   */
  secret: string;

  /**
   * Automatically log someone in as soon as they registered.
   * Note: this means their email is not yet verified.
   */
  loginAfterRegistration?: boolean;

  /**
   * Refresh a signed in session each time the whoami query is hit.
   * Otherwise they will need to sign in when their original session expires.
   */
  refreshSession?: boolean;

  /**
   * The absolute URL to the blueauth endpoint. Used in the links in the sign in emails
   */
  authBaseURL: string;

  /**
   * Set how long a sign in session lasts
   * TODO: add documentation on how you can use a string. examples.
   */
  sessionLifespan?: string | number;
  smtpURL: string;
  smtpFromName?: string;
  smtpFromAddress: string;
  smtpSubject?: string;
  cookieNamePrefix?: string;
  cookieOptions?: CookieSerializeOptions;
  findUniqueIdentity: FindUniqueIdentity;
  createIdentity: CreateIdentity;
  createLoginEmailStrings?: CreateLoginEmailStrings;
};

export type GetConfigOptions = {
  /**
   * random characters used as a key
   */
  secret: string;
  findUniqueIdentity: FindUniqueIdentity;
};

export type DefaultConfigOptions = {
  loginAfterRegistration: boolean;
  sessionLifespan: string | number;
  refreshSession: boolean;
  smtpFromName: string;
  smtpSubject: string;
  cookieNamePrefix: string;
  cookieOptions: CookieSerializeOptions;
  createLoginEmailStrings: CreateLoginEmailStrings;
};

export type GraphQLContext = {
  config: Required<ConfigOptions>,
  cookies: { [key: string]: string },
  setCookie: (payload: string) => void,
  // setRedirect: (url: string) => void,
};
