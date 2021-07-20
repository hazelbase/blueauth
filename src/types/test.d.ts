declare namespace NodeJS {
  interface Global {
    testHelpers: {
      config: import('.').Config;
      identities: any[];
      makeMockNextResponse: () => import('./mocks').MockNextResponse;
      makeMockExpressResponse: () => import('./mocks').MockExpressResponse;
    }
  }
}
