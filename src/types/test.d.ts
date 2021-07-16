declare namespace NodeJS {
  interface Global {
    testHelpers: {
      config: Required<import('.').ConfigOptions>;
      identities: any[];
      makeMockNextResponse: () => import('./mocks').MockNextResponse;
      makeMockExpressResponse: () => import('./mocks').MockExpressResponse;
    }
  }
}
