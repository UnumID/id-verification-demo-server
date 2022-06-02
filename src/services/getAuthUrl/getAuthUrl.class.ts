import { BadRequest } from '@feathersjs/errors';
import { Params } from '@feathersjs/feathers';
import { config } from '../../config';
// import { VerificationOptions, WalletUserDto } from '@unumid/web-wallet-types';
// import { EMAIL_CONTENT } from '../../constants';
import { v4 as uuidv4 } from 'uuid';

import { Application } from '../../declarations';
// import { UserEntity } from '../../entities/User';
import logger from '../../logger';
import { makeNetworkRequest, RESTData, RESTResponse } from '../../utils/networkRequestHelper';
import { Configuration } from '@mikro-orm/core';
// import { generateEmailVerificationToken } from '../../utils/generateEmailVerificationToken';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class GetAuthUrlService {
  app: Application;

  constructor (app: Application) {
    this.app = app;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async create (data: any, params?: Params): Promise<AuthTokens> {
      const authorization = data.authorization;

      const restData: RESTData = {
        method: 'POST',
        baseUrl: config.PROVE_SAAS_URL,
        endPoint: `/fortified/2015/06/01/getAuthUrl`,
        // header: { Authorization: authorization },
        data: {
          "RequestId": uuidv4(),
          "SessionId": "SubmittedSessionId", // TODO
          "ApiClientId": config.PROVE_CLIENT_ID,
          "SourceIp": "127.0.0.1", // TODO
          "FinalTargetUrl": "http://www.myurl.com/finish",
          "MobileNumber": data.mobileNumber,
      }
    };

    const response = await makeNetworkRequest<AuthTokens>(restData);

    return response.body;
  }
}
