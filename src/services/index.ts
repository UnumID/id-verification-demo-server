import { Application } from '../declarations';
import AuthService from './auth/auth.service';
import EligibilityService from './eligibility/eligibility.service';
import GetAuthPathService from './getAuthPath/getAuthPath.service';
import GetAuthUrlService from './getAuthUrl/getAuthUrl.service';
import HyperVergeService from './hyperVerge/hyperVerge.service';
import HyperVergeAuth from './hyperVergeAuth/hyperVergeAuth.service';
import IdentityService from './identity/identity.service';
import IssuerService from './issuer/issuer.service';
import IssuerEntityService from './issuerEntity/issuerEntity.service';
import UserService from './user/user.service';
import UserCredentialRequestsService from './userCredentialRequests/userCredentialRequests.service';
import UserEntityService from './userEntity/userEntity.service';

// eslint-disable-next-line @typescript-eslint/no-empty-function
export default function (app: Application): void {
  app.configure(AuthService);
  app.configure(HyperVergeAuth);
  app.configure(UserEntityService);
  app.configure(UserService);
  app.configure(GetAuthUrlService);
  app.configure(GetAuthPathService);
  app.configure(EligibilityService);
  app.configure(IdentityService);
  app.configure(HyperVergeService);
  app.configure(IssuerEntityService);
  app.configure(IssuerService);
  app.configure(UserCredentialRequestsService);
}
